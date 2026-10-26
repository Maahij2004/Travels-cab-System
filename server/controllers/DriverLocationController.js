const DriverLocation = require("../models/DriverLocation");
const Driver = require("../models/driver");
const Trip = require("../models/trip");
const Customer = require("../models/customer");
const Booking = require("../models/booking");
const { emitToUser } = require("../services/socketService");


// ==========================================
// UPDATE DRIVER LOCATION
// Driver only
// ==========================================
const updateDriverLocation = async (req, res) => {
    try {
        const {
            latitude,
            longitude,
            accuracy,
            heading,
            speed,
            tripId,
        } = req.body;

        if (
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required",
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

        let trip = null;

        if (tripId) {
            trip = await Trip.findById(tripId);

            if (!trip) {
                return res.status(404).json({
                    success: false,
                    message: "Trip not found",
                });
            }

            if (
                trip.driver.toString() !==
                driver._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Trip is not assigned to this driver",
                });
            }

            if (
                ![
                    "Scheduled",
                    "Started",
                    "Customer Picked Up",
                    "Ongoing",
                ].includes(trip.status)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Location cannot be updated for this trip status",
                });
            }
        }

        const location = await DriverLocation.findOneAndUpdate(
            {
                driver: driver._id,
            },
            {
                driver: driver._id,
                trip: trip ? trip._id : null,
                latitude,
                longitude,
                accuracy:
                    accuracy !== undefined ? accuracy : null,
                heading:
                    heading !== undefined ? heading : null,
                speed:
                    speed !== undefined ? speed : null,
                updatedAtLocation: new Date(),
                isActive: true,
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        )
            .populate("driver")
            .populate("trip");

        if (trip) {
            try {
                const b = await Booking.findById(trip.booking).select("customer").lean();
                const c = b?.customer ? await Customer.findById(b.customer).select("user").lean() : null;
                if (c?.user) {
                    emitToUser(c.user, "driver:location", {
                        driverId: driver._id,
                        tripId: trip._id,
                        latitude,
                        longitude,
                        accuracy,
                        heading,
                        speed,
                    });
                }
            } catch { /* ignore location emit error */ }
        }

        return res.status(200).json({
            success: true,
            message: "Driver location updated successfully",
            location,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET DRIVER LOCATION
// Customer / Driver / Admin
// ==========================================
const getDriverLocation = async (req, res) => {
    try {
        const location = await DriverLocation.findOne({
            driver: req.params.driverId,
            isActive: true,
        })
            .populate("driver")
            .populate("trip");

        if (!location) {
            return res.status(404).json({
                success: false,
                message: "Driver location not available",
            });
        }

        if (req.user.role === "customer") {
            const customer = await Customer.findOne({
                user: req.user._id,
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer profile not found",
                });
            }

            const activeTrips = await Trip.find({
                driver: req.params.driverId,
                status: {
                    $in: [
                        "Scheduled",
                        "Started",
                        "Customer Picked Up",
                        "Ongoing",
                        "Destination Reached",
                    ],
                },
            }).select("booking");

            const bookingIds = activeTrips.map((trip) => trip.booking);

            const ownsTrip = await Booking.exists({
                _id: { $in: bookingIds },
                customer: customer._id,
            });

            if (!ownsTrip) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this driver's location",
                });
            }
        }

        return res.status(200).json({
            success: true,
            location,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET MY LOCATION
// Driver only
// ==========================================
const getMyLocation = async (req, res) => {
    try {
        const driver = await Driver.findOne({
            user: req.user._id,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found",
            });
        }

        const location = await DriverLocation.findOne({
            driver: driver._id,
        }).populate("trip");

        return res.status(200).json({
            success: true,
            location,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// STOP LOCATION SHARING
// ==========================================
const stopLocationSharing = async (req, res) => {
    try {
        const driver = await Driver.findOne({
            user: req.user._id,
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found",
            });
        }

        const location = await DriverLocation.findOneAndUpdate(
            {
                driver: driver._id,
            },
            {
                isActive: false,
                trip: null,
            },
            {
                new: true,
            }
        );

        return res.status(200).json({
            success: true,
            message: "Location sharing stopped",
            location,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    updateDriverLocation,
    getDriverLocation,
    getMyLocation,
    stopLocationSharing,
};