const SOS = require("../models/SOS");
const Trip = require("../models/trip");
const Driver = require("../models/driver");
const Customer = require("../models/customer");
const User = require("../models/user");
const Booking = require("../models/booking");

const {
    createNotification,
} = require("../services/notificationService");


// ==========================================
// TRIGGER SOS
// ==========================================
const triggerSOS = async (req, res) => {
    try {
        const {
            tripId,
            reason,
            latitude,
            longitude,
        } = req.body;

        if (!tripId) {
            return res.status(400).json({
                success: false,
                message: "tripId is required",
            });
        }

        const trip = await Trip.findById(tripId)
            .populate("driver");

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        if (["Completed", "Cancelled"].includes(trip.status)) {
            return res.status(400).json({
                success: false,
                message: "SOS can only be triggered for an active trip",
            });
        }

        const booking = await Booking.findById(trip.booking);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        let customer = null;
        let driver = null;
        let triggeredBy = null;

        // ======================================
        // CUSTOMER SOS
        // ======================================
        if (req.user.role === "customer") {
            customer = await Customer.findOne({
                user: req.user._id,
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer profile not found",
                });
            }

            // Verify trip belongs to this customer
            if (
                booking.customer.toString() !==
                customer._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You are not authorized to trigger SOS for this trip",
                });
            }

            triggeredBy = "Customer";
        }


        // ======================================
        // DRIVER SOS
        // ======================================
        if (req.user.role === "driver") {
            driver = await Driver.findOne({
                user: req.user._id,
            });

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    message: "Driver profile not found",
                });
            }

            if (
                !trip.driver ||
                driver._id.toString() !==
                trip.driver._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You are not assigned to this trip",
                });
            }

            customer = await Customer.findById(booking.customer);

            triggeredBy = "Driver";
        }


        // ======================================
        // CREATE SOS
        // ======================================
        const sos = await SOS.create({
            trip: trip._id,
            booking: trip.booking,
            customer: customer?._id || null,
            driver:
                driver?._id ||
                trip.driver?._id ||
                null,
            triggeredBy,
            reason: reason || "Emergency",
            latitude: latitude ?? null,
            longitude: longitude ?? null,
        });


        // ======================================
        // FIND ADMINS
        // ======================================
        const admins = await User.find({
            role: {
                $in: ["admin", "superadmin"],
            },
            isActive: true,
        }).select("_id");


        // ======================================
        // NOTIFY ADMINS
        // ======================================
        for (const admin of admins) {
            await createNotification({
                recipient: admin._id,
                title: "Emergency Alert",
                message:
                    `SOS triggered for trip ${trip.tripId}.`,
                type: "SOS",
                booking: trip.booking,
                trip: trip._id,
            });
        }


        // ======================================
        // CUSTOMER → NOTIFY DRIVER
        // DRIVER → NOTIFY CUSTOMER
        // ======================================
        if (
            triggeredBy === "Customer" &&
            trip.driver?.user
        ) {
            await createNotification({
                recipient: trip.driver.user,
                title: "Emergency Alert",
                message:
                    `Customer has triggered SOS for trip ${trip.tripId}.`,
                type: "SOS",
                booking: trip.booking,
                trip: trip._id,
            });
        }


        if (
            triggeredBy === "Driver" &&
            customer
        ) {
            await createNotification({
                recipient: customer.user,
                title: "Emergency Alert",
                message:
                    `Driver has triggered SOS for trip ${trip.tripId}.`,
                type: "SOS",
                booking: trip.booking,
                trip: trip._id,
            });
        }


        return res.status(201).json({
            success: true,
            message: "SOS alert triggered successfully",
            sos,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET ALL SOS
// ==========================================
const getAllSOS = async (req, res) => {
    try {
        const alerts = await SOS.find()
            .populate("customer")
            .populate("driver")
            .populate("trip")
            .populate("booking")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: alerts.length,
            alerts,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// RESOLVE SOS
// ==========================================
const resolveSOS = async (req, res) => {
    try {
        const sos = await SOS.findById(req.params.id);

        if (!sos) {
            return res.status(404).json({
                success: false,
                message: "SOS alert not found",
            });
        }

        sos.status = "Resolved";
        sos.resolvedAt = new Date();

        await sos.save();

        return res.status(200).json({
            success: true,
            message: "SOS resolved successfully",
            sos,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    triggerSOS,
    getAllSOS,
    resolveSOS,
};