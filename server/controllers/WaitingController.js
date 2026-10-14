const WaitingSession = require("../models/WaitingSession");
const Trip = require("../models/trip");
const Driver = require("../models/driver");
const Customer = require("../models/customer");
const Booking = require("../models/booking");
const Pricing = require("../models/pricing");
const Vehicle = require("../models/Vehicle");
const VehicleCategory = require("../models/VehicleCategory");
const { cancelTrip } = require("../services/tripService");

// ==========================================
// START WAITING
// ==========================================
const startWaiting = async (req, res) => {
    try {
        const { tripId } = req.body;

        if (!tripId) {
            return res.status(400).json({
                success: false,
                message: "tripId is required",
            });
        }

        const trip = await Trip.findById(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        const driver = await Driver.findOne({
            user: req.user._id,
            isActive: true,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found",
            });
        }

        if (
            !trip.driver ||
            trip.driver.toString() !== driver._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "Trip is not assigned to this driver",
            });
        }

        if (!["Started", "Customer Picked Up"].includes(trip.status)) {
            return res.status(400).json({
                success: false,
                message: "Waiting can only start during an active pickup/trip",
            });
        }

        const booking = await Booking.findById(trip.booking);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        let waiting = await WaitingSession.findOne({
            trip: trip._id,
        });

        if (waiting && waiting.status === "Waiting") {
            return res.status(400).json({
                success: false,
                message: "Waiting session already active",
            });
        }

        if (!waiting) {
            waiting = await WaitingSession.create({
                trip: trip._id,
                booking: booking._id,
                driver: driver._id,
                customer: booking.customer,
                startedAt: new Date(),
                status: "Waiting",
            });
        } else {
            waiting.driver = driver._id;
            waiting.customer = booking.customer;
            waiting.startedAt = new Date();
            waiting.endedAt = null;
            waiting.waitingMinutes = 0;
            waiting.waitingCharge = 0;
            waiting.status = "Waiting";
            await waiting.save();
        }

        return res.status(201).json({
            success: true,
            message: "Waiting time started",
            waiting,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// STOP WAITING
// ==========================================
const stopWaiting = async (req, res) => {
    try {
        const { tripId } = req.body;

        const driver = await Driver.findOne({
            user: req.user._id,
            isActive: true,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found",
            });
        }

        const waiting = await WaitingSession.findOne({
            trip: tripId,
            status: "Waiting",
            driver: driver._id,
        });

        if (!waiting) {
            return res.status(404).json({
                success: false,
                message: "Active waiting session not found",
            });
        }

        const endedAt = new Date();
        const waitingMinutes = Math.max(
            0,
            Math.ceil((endedAt - waiting.startedAt) / 60000)
        );

        const trip = await Trip.findById(waiting.trip)
            .populate({
                path: "vehicle",
                populate: {
                    path: "category",
                },
            });

        if (!trip || !trip.vehicle || !trip.vehicle.category) {
            return res.status(404).json({
                success: false,
                message: "Trip vehicle/category not found",
            });
        }

        const pricing = await Pricing.findOne({
            vehicleGroup: trip.vehicle.category.pricingGroup,
            isActive: true,
        }).sort({ effectiveFrom: -1 });

        const waitingRate = pricing?.waitingChargePerMinute || 0;
        const waitingCharge =
            waitingMinutes * waitingRate;

        waiting.endedAt = endedAt;
        waiting.waitingMinutes = waitingMinutes;
        waiting.waitingCharge = waitingCharge;
        waiting.status = "Completed";

        await waiting.save();

        // Add waiting charge to current trip fare.
        trip.finalFare =
            Number(trip.finalFare || trip.estimatedFare || 0) +
            Number(waitingCharge);

        await trip.save();

        return res.status(200).json({
            success: true,
            message: "Waiting time stopped",
            waiting,
            waitingRate,
            updatedFare: trip.finalFare,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// CUSTOMER NO-SHOW
// ==========================================
const markNoShow = async (req, res) => {
    try {
        const { tripId } = req.body;

        const waiting = await WaitingSession.findOne({
            trip: tripId,
        });

        if (!waiting) {
            return res.status(404).json({
                success: false,
                message: "Waiting session not found",
            });
        }

        if (!waiting.startedAt) {
            return res.status(400).json({
                success: false,
                message: "Waiting session has not started",
            });
        }

        if (
            req.user.role === "driver"
        ) {
            const driver = await Driver.findOne({
                user: req.user._id,
            });

            if (
                !driver ||
                waiting.driver.toString() !== driver._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not assigned to this waiting session",
                });
            }
        }

        const elapsedMinutes = Math.floor(
            (Date.now() - waiting.startedAt.getTime()) / 60000
        );

        if (elapsedMinutes < waiting.noShowLimitMinutes) {
            return res.status(400).json({
                success: false,
                message:
                    `Customer can be marked no-show only after ${waiting.noShowLimitMinutes} minutes`,
                elapsedMinutes,
            });
        }

        waiting.waitingMinutes = elapsedMinutes;
        waiting.endedAt = new Date();
        waiting.status = "No Show";
        await waiting.save();

        const trip = await Trip.findById(tripId);

        if (trip && !["Completed", "Cancelled"].includes(trip.status)) {
            await cancelTrip(
                trip,
                "Customer no-show after waiting period"
            );
        } else {
            await Booking.findByIdAndUpdate(
                waiting.booking,
                {
                    status: "Cancelled",
                    cancellationReason:
                        "Customer no-show after waiting period",
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Customer marked as no-show",
            waiting,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET WAITING SESSION
// ==========================================
const getWaitingSession = async (req, res) => {
    try {
        const waiting = await WaitingSession.findOne({
            trip: req.params.tripId,
        })
            .populate("trip")
            .populate("driver")
            .populate("customer")
            .populate("booking");

        if (!waiting) {
            return res.status(404).json({
                success: false,
                message: "Waiting session not found",
            });
        }

        if (req.user.role === "customer") {
            const customer = await Customer.findOne({
                user: req.user._id,
            });

            if (
                !customer ||
                waiting.customer._id.toString() !== customer._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this waiting session",
                });
            }
        }

        if (req.user.role === "driver") {
            const driver = await Driver.findOne({
                user: req.user._id,
            });

            if (
                !driver ||
                waiting.driver._id.toString() !== driver._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this waiting session",
                });
            }
        }

        return res.status(200).json({
            success: true,
            waiting,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    startWaiting,
    stopWaiting,
    markNoShow,
    getWaitingSession,
};
