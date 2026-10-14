const crypto = require("crypto");
const Razorpay = require("razorpay");

const Payment = require("../models/payment");
const Invoice = require("../models/invoice");
const Booking = require("../models/booking");
const Trip = require("../models/trip");

const razorpay =
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET
        ? new Razorpay({
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
          })
        : null;

/*
|--------------------------------------------------------------------------
| Generate Payment ID
|--------------------------------------------------------------------------
*/

const generatePaymentId = async () => {
    const lastPayment = await Payment.findOne()
        .sort({ createdAt: -1 })
        .select("paymentId");

    if (!lastPayment) {
        return "PAY-00001";
    }

    const number = parseInt(
        lastPayment.paymentId.replace("PAY-", ""),
        10
    );

    return `PAY-${String(number + 1).padStart(5, "0")}`;
};

/*
|--------------------------------------------------------------------------
| Generate Invoice Number
|--------------------------------------------------------------------------
*/

const finalizePaidTrip = async (payment) => {
    const trip = await Trip.findById(payment.trip); if (!trip) throw new Error("Trip not found");
    if (trip.status !== "Destination Reached") throw new Error("Trip must reach destination before payment is finalized");
    const booking = await Booking.findById(payment.booking); if (!booking) throw new Error("Booking not found");
    booking.paymentStatus = "Paid"; booking.status = "Completed"; await booking.save();
    trip.status = "Completed"; trip.completedAt = new Date(); await trip.save();
    const Driver = require("../models/driver"); const Vehicle = require("../models/Vehicle");
    const driver = await Driver.findById(trip.driver); if (driver) { driver.status="Available"; driver.availability=true; driver.assignedVehicle=null; await driver.save(); }
    const vehicle = await Vehicle.findById(trip.vehicle); if (vehicle) { vehicle.status="Available"; vehicle.availability=true; await vehicle.save(); }
    return trip;
};

const generateInvoiceNumber = async () => {
    const lastInvoice = await Invoice.findOne()
        .sort({ createdAt: -1 })
        .select("invoiceNumber");

    if (!lastInvoice) {
        return "INV-00001";
    }

    const number = parseInt(
        lastInvoice.invoiceNumber.replace("INV-", ""),
        10
    );

    return `INV-${String(number + 1).padStart(5, "0")}`;
};

/*
|--------------------------------------------------------------------------
| Create Cash Payment
|--------------------------------------------------------------------------
*/

const createCashPayment = async ({
    bookingId,
    tripId,
    customerId,
    amount,
}) => {
    const paymentId = await generatePaymentId();

    const payment = await Payment.create({
        paymentId,
        booking: bookingId,
        trip: tripId,
        customer: customerId,
        amount,
        method: "Cash",
        status: "Pending",
    });

    return payment;
};

/*
|--------------------------------------------------------------------------
| Create Razorpay Order
|--------------------------------------------------------------------------
*/

const createRazorpayOrder = async ({
    bookingId,
    tripId,
    customerId,
    amount,
    method,
}) => {
    const paymentId = await generatePaymentId();

    const payment = await Payment.create({
        paymentId,
        booking: bookingId,
        trip: tripId,
        customer: customerId,
        amount,
        method,
        status: "Pending",
    });

    if (!razorpay) {
        throw new Error(
            "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
        );
    }

    const order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: paymentId,
        notes: {
            bookingId: bookingId.toString(),
            tripId: tripId.toString(),
        },
    });

    payment.razorpayOrderId = order.id;

    await payment.save();

    return {
        payment,
        order,
    };
};

/*
|--------------------------------------------------------------------------
| Verify Razorpay Payment
|--------------------------------------------------------------------------
*/

const verifyRazorpayPayment = async ({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    customerId,
}) => {
    const payment = await Payment.findOne({
        razorpayOrderId,
    });

    if (!payment) {
        throw new Error("Payment record not found");
    }

    if (
        customerId &&
        payment.customer.toString() !== customerId.toString()
    ) {
        throw new Error("You are not authorized to verify this payment");
    }

    if (payment.status === "Paid") {
        throw new Error("Payment has already been verified");
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
        throw new Error(
            "Razorpay secret is not configured"
        );
    }

    const generatedSignature = crypto
        .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET
        )
        .update(
            `${razorpayOrderId}|${razorpayPaymentId}`
        )
        .digest("hex");

    if (generatedSignature !== razorpaySignature) {
        payment.status = "Failed";
        payment.failureReason = "Invalid Razorpay signature";

        await payment.save();

        throw new Error("Invalid payment signature");
    }

    payment.status = "Paid";
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.paidAt = new Date();

    await payment.save();

    // Gateway verification records the true online payment status, but the
    // trip is not finalized until the assigned driver verifies that status.
    return { payment, invoice: null };
};

/*
|--------------------------------------------------------------------------
| Driver verifies payment status and finalizes the trip
|--------------------------------------------------------------------------
*/

const markCashPaymentPaid = async (paymentId, driverId) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error("Payment not found");

    const trip = await Trip.findById(payment.trip);
    if (!trip || trip.status !== "Destination Reached") {
        throw new Error("Payment can only be verified after destination is reached");
    }
    if (driverId && String(trip.driver) !== String(driverId)) {
        throw new Error("Only the assigned driver can verify this payment");
    }
    if (["Failed", "Refunded"].includes(payment.status)) {
        throw new Error(`This payment is ${payment.status.toLowerCase()} and cannot complete the trip`);
    }

    // An admin may record a cash payment as Paid, but only the assigned driver
    // can verify the status and finalize the trip.
    if (!driverId) {
        if (payment.method !== "Cash") throw new Error("Online payment status must be verified by the payment gateway");
        if (payment.status !== "Paid") {
            payment.status = "Paid";
            payment.paidAt = new Date();
            await payment.save();
        }
        return { payment, invoice: null };
    }

    if (payment.method === "Cash") {
        // Cash remains Pending until the driver confirms actual receipt.
        if (payment.status !== "Paid") {
            payment.status = "Paid";
            payment.paidAt = new Date();
        }
    } else if (payment.status !== "Paid") {
        // For online methods, only the verified gateway callback may set Paid.
        throw new Error("Online payment is not verified as Paid yet. Refresh the payment status and ask the customer to finish payment.");
    }

    if (driverId) {
        payment.driverVerifiedAt = new Date();
        payment.driverVerifiedBy = driverId;
    }
    await payment.save();

    await finalizePaidTrip(payment);
    const invoice = await generateInvoice(payment);
    return { payment, invoice };
};

/*
|--------------------------------------------------------------------------
| Generate Invoice
|--------------------------------------------------------------------------
*/

const generateInvoice = async (payment) => {
    // Prevent duplicate invoice
    const existingInvoice = await Invoice.findOne({
        payment: payment._id,
    });

    if (existingInvoice) {
        return existingInvoice;
    }

    // Verify trip exists
    const trip = await Trip.findById(payment.trip);

    if (!trip) {
        throw new Error("Trip not found");
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Use actual final fare when available
    const fare =
        trip.finalFare ??
        trip.estimatedFare ??
        payment.amount;

    const invoice = await Invoice.create({
        invoiceNumber,
        payment: payment._id,
        booking: payment.booking,
        trip: payment.trip,
        customer: payment.customer,
        subtotal: fare,
        additionalCharges: 0,
        discount: 0,
        totalAmount: payment.amount,
        paymentMethod: payment.method,
    });

    return invoice;
};

/*
|--------------------------------------------------------------------------
| Refund Payment
|--------------------------------------------------------------------------
*/

const refundPayment = async (
    paymentId,
    refundId = null
) => {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
        throw new Error("Payment not found");
    }

    if (payment.status !== "Paid") {
        throw new Error(
            "Only paid payments can be refunded"
        );
    }

    let actualRefundId = refundId;

    if (payment.method !== "Cash") {
        if (!razorpay) {
            throw new Error(
                "Razorpay is not configured for online refunds"
            );
        }

        if (!payment.razorpayPaymentId) {
            throw new Error(
                "Razorpay payment ID is missing; online refund cannot be processed"
            );
        }

        const refund = await razorpay.payments.refund(
            payment.razorpayPaymentId,
            {
                amount: Math.round(payment.amount * 100),
            }
        );

        actualRefundId = refund.id;
    }

    payment.status = "Refunded";
    payment.refundId = actualRefundId;
    payment.refundedAt = new Date();

    await payment.save();

    await Booking.findByIdAndUpdate(
        payment.booking,
        {
            paymentStatus: "Refunded",
        }
    );

    return payment;
};

module.exports = {
    generatePaymentId,
    generateInvoiceNumber,
    createCashPayment,
    createRazorpayOrder,
    verifyRazorpayPayment,
    markCashPaymentPaid,
    generateInvoice,
    refundPayment,
    finalizePaidTrip,
};
