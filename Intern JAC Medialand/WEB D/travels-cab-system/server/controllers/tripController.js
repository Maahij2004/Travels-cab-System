const Trip = require("../models/trip");
const Booking = require("../models/booking");
const Customer = require("../models/customer");
const Driver = require("../models/driver");
const Vehicle = require("../models/Vehicle");

const {
    createTripFromBooking,
    updateTripStatus,
    completeTrip,
    cancelTrip,
    generateStartOtp,
    verifyStartOtp,
    decryptOtp,
} = require("../services/tripService");
const { startDispatch } = require("../services/dispatchService");

// Create trip
const createTrip = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const trip = await createTripFromBooking(bookingId);

        await Booking.findByIdAndUpdate(bookingId, {
            status: "Trip Scheduled",
        });

        const populatedTrip = await Trip.findById(trip._id)
            .populate("booking")
            .populate("driver")
            .populate("vehicle");

        res.status(201).json({
            success: true,
            message: "Trip created successfully",
            trip: populatedTrip,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Get all trips
const getAllTrips = async (req, res) => {
    try {
        const trips = await Trip.find()
            .populate("booking")
            .populate("driver")
            .populate("vehicle")
            .sort({ createdAt: -1 });

        res.json({ success: true, count: trips.length, trips });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get driver's trips
const getMyDriverTrips = async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found",
            });
        }

        // Repair any assignment created before the automatic-dispatch fix
        // where the booking has a driver but the Trip document is missing.
        const assignedBookings = await Booking.find({
            assignedDriver: driver._id,
            status: { $nin: ["Cancelled", "Completed"] },
        });

        for (const booking of assignedBookings) {
            const existingTrip = await Trip.findOne({ booking: booking._id });
            if (!existingTrip && booking.assignedVehicle) {
                try {
                    await createTripFromBooking(booking._id);
                } catch (repairError) {
                    console.warn(
                        `Unable to repair trip for ${booking.bookingId}: ${repairError.message}`
                    );
                }
            }
        }

        const trips = await Trip.find({ driver: driver._id })
            .populate("booking")
            .populate("vehicle")
            .sort({ scheduledDate: 1, createdAt: -1 });

        res.json({ success: true, count: trips.length, trips });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get customer's trips
const getMyCustomerTrips = async (req, res) => {
    try {
        const customer = await Customer.findOne({ user: req.user._id });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        const bookings = await Booking.find({
            customer: customer._id,
        }).select("_id");

        const bookingIds = bookings.map((booking) => booking._id);

        const trips = await Trip.find({
            booking: { $in: bookingIds },
        })
            .populate("booking")
            .populate("driver")
            .populate("vehicle")
            .sort({ scheduledDate: -1 });

        res.json({ success: true, count: trips.length, trips });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get trip by ID with ownership protection
const getTripById = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id)
            .populate("booking")
            .populate("driver")
            .populate("vehicle");

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        if (req.user.role === "customer") {
            const customer = await Customer.findOne({
                user: req.user._id,
            });

            if (
                !customer ||
                !trip.booking ||
                trip.booking.customer.toString() !==
                    customer._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this trip",
                });
            }
        }

        if (req.user.role === "driver") {
            const driver = await Driver.findOne({
                user: req.user._id,
            });

            if (
                !driver ||
                !trip.driver ||
                trip.driver._id.toString() !== driver._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this trip",
                });
            }
        }

        res.json({ success: true, trip });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update trip status
const changeTripStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required",
            });
        }

        if (status === "Started" && req.user.role === "driver") {
            return res.status(400).json({ success:false, message:"Driver must verify the pickup OTP before starting the trip" });
        }

        const trip = await Trip.findById(req.params.id);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        if (req.user.role === "driver") {
            const driver = await Driver.findOne({
                user: req.user._id,
            });

            if (
                !driver ||
                !trip.driver ||
                driver._id.toString() !== trip.driver.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not assigned to this trip",
                });
            }
        }

        if (status === "Completed") {
            const updatedTrip = await completeTrip(trip);

            return res.json({
                success: true,
                message: "Trip completed successfully",
                trip: updatedTrip,
            });
        }

        if (status === "Cancelled") {
            const updatedTrip = await cancelTrip(
                trip,
                req.body.reason || ""
            );

            return res.json({
                success: true,
                message: "Trip cancelled successfully",
                trip: updatedTrip,
            });
        }

        const updatedTrip = await updateTripStatus(trip, status);

        if (
            status === "Started" ||
            status === "Customer Picked Up" ||
            status === "Ongoing"
        ) {
            await Booking.findByIdAndUpdate(trip.booking, {
                status: "Ongoing",
            });
        }

        if (status === "Destination Reached") {
            await Booking.findByIdAndUpdate(trip.booking, { status: "Destination Reached" });
        }

        if (status === "Started") {
            await Driver.findByIdAndUpdate(trip.driver, {
                status: "On Trip",
                availability: false,
            });

            await Vehicle.findByIdAndUpdate(trip.vehicle, {
                status: "On Trip",
                availability: false,
            });
        }

        res.json({
            success: true,
            message: `Trip status updated to ${status}`,
            trip: updatedTrip,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const generatePickupOtp = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id); const driver = await Driver.findOne({ user: req.user._id });
        if (!trip || !driver || String(trip.driver) !== String(driver._id)) return res.status(403).json({ success:false, message:"You are not assigned to this trip" });
        const result = await generateStartOtp(trip._id);
        // Never reveal the customer's start code to the driver API response.
        // The assigned customer retrieves it through the protected customer endpoint.
        res.json({ success:true, message:"Pickup OTP generated for the customer", expiresAt:result.expiresAt });
    } catch (error) { res.status(400).json({ success:false, message:error.message }); }
};
const verifyPickupOtp = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id); const driver = await Driver.findOne({ user: req.user._id });
        if (!trip || !driver || String(trip.driver) !== String(driver._id)) return res.status(403).json({ success:false, message:"You are not assigned to this trip" });
        if (!/^\d{6}$/.test(String(req.body.otp || ""))) return res.status(400).json({ success:false, message:"Enter the 6-digit pickup OTP" });
        const updatedTrip = await verifyStartOtp(trip._id, req.body.otp);
        res.json({ success:true, message:"OTP verified. Trip started.", trip:updatedTrip });
    } catch (error) { res.status(400).json({ success:false, message:error.message }); }
};
const getCustomerPickupOtp = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id).select("+startOtpCiphertext");
        const customer = await Customer.findOne({ user:req.user._id });
        if (!trip || !customer) return res.status(404).json({success:false,message:"Trip not found"});
        const booking = await Booking.findById(trip.booking);
        if (!booking || String(booking.customer)!==String(customer._id)) return res.status(403).json({success:false,message:"Not authorized"});
        if (!trip.startOtpCiphertext || trip.startOtpUsedAt || !trip.startOtpExpiresAt || trip.startOtpExpiresAt<=new Date()) return res.status(404).json({success:false,message:"Pickup OTP is not currently active"});
        res.json({success:true,otp:decryptOtp(trip.startOtpCiphertext),expiresAt:trip.startOtpExpiresAt});
    } catch(error){res.status(400).json({success:false,message:error.message});}
};

const cancelDriverTrip = async (req, res) => {
    try {
        const trip = await Trip.findById(req.params.id); const driver = await Driver.findOne({ user: req.user._id });
        if (!trip || !driver || String(trip.driver) !== String(driver._id)) return res.status(403).json({ success:false, message:"You are not assigned to this trip" });
        if (["Completed","Cancelled","Destination Reached"].includes(trip.status)) return res.status(400).json({ success:false, message:"This trip cannot be cancelled now" });
        const reason = req.body.reason || "Driver cancelled before pickup";
        await cancelTrip(trip, reason);
        const booking = await Booking.findById(trip.booking);
        if (booking) { booking.assignedDriver=null; booking.assignedVehicle=null; booking.status="Pending"; booking.cancellationReason=""; await booking.save(); try { await startDispatch(booking._id); } catch (e) { console.warn(`Re-dispatch failed: ${e.message}`); } }
        res.json({ success:true, message:"Trip cancelled and the system is searching for another nearby driver.", trip });
    } catch (error) { res.status(400).json({ success:false, message:error.message }); }
};

module.exports = {
    createTrip,
    getAllTrips,
    getMyDriverTrips,
    getMyCustomerTrips,
    getTripById,
    changeTripStatus,
    generatePickupOtp,
    verifyPickupOtp,
    cancelDriverTrip,
    getCustomerPickupOtp,
};
