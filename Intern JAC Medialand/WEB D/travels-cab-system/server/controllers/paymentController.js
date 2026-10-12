const Payment = require("../models/payment");
const Booking = require("../models/booking");
const Trip = require("../models/trip");
const Customer = require("../models/customer");

const {
    createCashPayment,
    createRazorpayOrder,
    verifyRazorpayPayment,
    markCashPaymentPaid,
    refundPayment,
} = require("../services/paymentService");
const Driver = require("../models/driver");


/*
|--------------------------------------------------------------------------
| CREATE PAYMENT
|--------------------------------------------------------------------------
*/

const createPayment = async (req, res) => {
    try {
        const { tripId, method } = req.body;

        if (!tripId || !method) {
            return res.status(400).json({
                success: false,
                message: "tripId and payment method are required",
            });
        }

        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        if (trip.status !== "Destination Reached") return res.status(400).json({ success:false, message:"Payment can be made after the destination is reached" });

        const booking = await Booking.findById(trip.booking);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const customer = await Customer.findOne({
            user: req.user._id,
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        if (booking.customer.toString() !== customer._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to pay for this trip",
            });
        }

        const amount = Number(trip.finalFare > 0 ? trip.finalFare : (trip.estimatedFare || booking.estimatedFare || 0));
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid trip fare",
            });
        }

        let existingPayment = await Payment.findOne({ trip: trip._id, status: { $in: ["Pending", "Paid"] } });

        if (existingPayment) {
            if (existingPayment.status === "Paid") {
                return res.status(200).json({
                    success: true,
                    message: existingPayment.driverVerifiedAt ? "Payment is verified and the trip is completed" : "Payment is verified and awaiting driver payment-status confirmation",
                    payment: existingPayment,
                });
            }

            // Existing Pending Payment: Update method
            existingPayment.method = method;

            if (method === "Cash") {
                await existingPayment.save();
                return res.status(200).json({
                    success: true,
                    message: "Cash payment selected",
                    payment: existingPayment,
                });
            }

            // Online payment requested on existing pending payment
            const { razorpay } = require("../services/paymentService");
            if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && razorpay) {
                const order = await razorpay.orders.create({
                    amount: Math.round(amount * 100),
                    currency: "INR",
                    receipt: existingPayment.paymentId,
                    notes: { bookingId: booking._id.toString(), tripId: trip._id.toString() },
                });
                existingPayment.razorpayOrderId = order.id;
                await existingPayment.save();
                return res.status(200).json({
                    success: true,
                    message: "Razorpay order created",
                    payment: existingPayment,
                    order,
                    razorpayKey: process.env.RAZORPAY_KEY_ID,
                });
            } else {
                await existingPayment.save();
                return res.status(200).json({
                    success: true,
                    message: "Online payment order initiated (Demo Mode)",
                    payment: existingPayment,
                    order: { id: `order_demo_${Date.now()}`, amount: Math.round(amount * 100), currency: "INR" },
                    razorpayKey: process.env.RAZORPAY_KEY_ID || "rzp_test_demo",
                });
            }
        }

        if (method === "Cash") {
            const payment = await createCashPayment({
                bookingId: booking._id,
                tripId: trip._id,
                customerId: customer._id,
                amount,
            });

            return res.status(201).json({
                success: true,
                message: "Cash payment created",
                payment,
            });
        }

        if (!["UPI", "Card", "Wallet"].includes(method)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method",
            });
        }

        const result = await createRazorpayOrder({
            bookingId: booking._id,
            tripId: trip._id,
            customerId: customer._id,
            amount,
            method,
        });

        res.status(201).json({
            success: true,
            message: "Razorpay order created",
            payment: result.payment,
            order: result.order,
            razorpayKey: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


/*
|--------------------------------------------------------------------------
| VERIFY ONLINE PAYMENT
|--------------------------------------------------------------------------
*/

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
        } = req.body;

        if (
            !razorpayOrderId ||
            !razorpayPaymentId ||
            !razorpaySignature
        ) {
            return res.status(400).json({
                success: false,
                message: "Razorpay verification details are required",
            });
        }

        const customer = await Customer.findOne({
            user: req.user._id,
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        const result = await verifyRazorpayPayment({
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            customerId: customer._id,
        });

        res.json({
            success: true,
            message: "Online payment verified successfully. Waiting for the assigned driver to verify the payment status and complete the trip.",
            payment: result.payment,
            invoice: result.invoice,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


/*
|--------------------------------------------------------------------------
| MY PAYMENTS
|--------------------------------------------------------------------------
*/

const getMyPayments = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            user: req.user._id,
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        const payments = await Payment.find({
            customer: customer._id,
        })
            .populate("booking")
            .populate("trip")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: payments.length,
            payments,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


/*
|--------------------------------------------------------------------------
| ALL PAYMENTS
|--------------------------------------------------------------------------
*/

const getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate("customer")
            .populate("booking")
            .populate("trip")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: payments.length,
            payments,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


/*
|--------------------------------------------------------------------------
| MARK CASH PAYMENT AS PAID
|--------------------------------------------------------------------------
*/

const markPaymentPaid = async (req, res) => {
    try {
        const result = await markCashPaymentPaid(
            req.params.id
        );

        res.json({
            success: true,
            message: "Cash payment marked as Paid by admin. The assigned driver must still verify the status to complete the trip.",
            payment: result.payment,
            invoice: result.invoice,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


/*
|--------------------------------------------------------------------------
| REFUND
|--------------------------------------------------------------------------
*/

const refund = async (req, res) => {
    try {
        const payment = await refundPayment(
            req.params.id,
            req.body.refundId
        );

        res.json({
            success: true,
            message: "Payment refunded successfully",
            payment,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


const getDriverTripPayment = async (req,res) => {
    try {
        const driver=await Driver.findOne({user:req.user._id,isActive:true});
        const trip=await Trip.findById(req.params.tripId);
        if(!driver||!trip||String(trip.driver)!==String(driver._id)) return res.status(403).json({success:false,message:"You are not assigned to this trip"});
        const payment=await Payment.findOne({trip:trip._id}).sort({createdAt:-1});
        res.json({success:true,payment});
    } catch(error){res.status(400).json({success:false,message:error.message});}
};

const confirmCashByDriver = async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id, isActive: true });
        if (!driver) return res.status(404).json({ success: false, message: "Driver profile not found" });

        // Accept either a payment ID (current client) or a trip ID (legacy client).
        let payment = await Payment.findById(req.params.id);
        if (!payment) {
            const trip = await Trip.findById(req.params.id);
            if (!trip) return res.status(404).json({ success: false, message: "Payment or trip record not found" });
            if (String(trip.driver) !== String(driver._id)) {
                return res.status(403).json({ success: false, message: "You are not assigned to this trip" });
            }
            payment = await Payment.findOne({ trip: trip._id }).sort({ createdAt: -1 });
        }

        if (!payment) {
            return res.status(404).json({ success: false, message: "No payment record exists for this trip yet. Ask the customer to select a payment method first." });
        }

        const trip = await Trip.findById(payment.trip);
        if (!trip || String(trip.driver) !== String(driver._id)) {
            return res.status(403).json({ success: false, message: "You are not assigned to this trip" });
        }
        if (payment.method !== "Cash" && payment.status !== "Paid") {
            return res.status(400).json({ success: false, message: "Online payment is not verified as Paid yet. Refresh the status before confirming." });
        }

        const result = await markCashPaymentPaid(payment._id, driver._id);
        res.json({
            success: true,
            message: `Payment status verified (${result.payment.method}). Trip completed and invoice generated.`,
            payment: result.payment,
            invoice: result.invoice,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    createPayment,
    verifyPayment,
    getMyPayments,
    getAllPayments,
    markPaymentPaid,
    refund,
    confirmCashByDriver,
    getDriverTripPayment,
};