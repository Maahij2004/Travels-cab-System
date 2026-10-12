const Rating = require("../models/rating");
const Trip = require("../models/trip");
const Booking = require("../models/booking");
const Customer = require("../models/customer");
const Driver = require("../models/driver");


// ==========================================
// CREATE RATING
// Customer can rate only their own
// completed trip
// ==========================================
const createRating = async (req, res) => {
    try {
        const { tripId, rating, review } = req.body;

        // Validate input
        if (!tripId || rating === undefined) {
            return res.status(400).json({
                success: false,
                message: "tripId and rating are required",
            });
        }

        const numericRating = Number(rating);

        if (
            !Number.isFinite(numericRating) ||
            numericRating < 1 ||
            numericRating > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5",
            });
        }

        // Find customer profile
        const customer = await Customer.findOne({
            user: req.user._id,
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        // Find trip
        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        // Rating only after completion
        if (trip.status !== "Completed") {
            return res.status(400).json({
                success: false,
                message:
                    "You can rate a trip only after completion",
            });
        }

        // Find booking
        const booking = await Booking.findById(
            trip.booking
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // IMPORTANT:
        // Verify that this booking belongs
        // to the logged-in customer
        if (
            booking.customer.toString() !==
            customer._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not authorized to rate this trip",
            });
        }

        // Driver must exist
        if (!trip.driver) {
            return res.status(400).json({
                success: false,
                message:
                    "No driver is assigned to this trip",
            });
        }

        // Prevent duplicate rating
        const existingRating = await Rating.findOne({
            trip: trip._id,
        });

        if (existingRating) {
            return res.status(409).json({
                success: false,
                message:
                    "This trip has already been rated",
            });
        }

        // Create rating
        const ratingRecord = await Rating.create({
            trip: trip._id,
            booking: booking._id,
            customer: customer._id,
            driver: trip.driver,
            rating: numericRating,
            review: review ? review.trim() : "",
        });

        return res.status(201).json({
            success: true,
            message: "Rating submitted successfully",
            rating: ratingRecord,
        });

    } catch (error) {
        console.error("Create Rating Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET DRIVER RATINGS
// ==========================================
const getDriverRatings = async (req, res) => {
    try {
        const driver = await Driver.findById(
            req.params.driverId
        );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        const ratings = await Rating.find({
            driver: driver._id,
        })
            .populate(
                "customer",
                "fullName profileImage"
            )
            .populate(
                "trip",
                "tripId status"
            )
            .sort({
                createdAt: -1,
            });

        // Calculate average rating
        const summaryResult = await Rating.aggregate([
            {
                $match: {
                    driver: driver._id,
                },
            },
            {
                $group: {
                    _id: "$driver",
                    averageRating: {
                        $avg: "$rating",
                    },
                    totalRatings: {
                        $sum: 1,
                    },
                },
            },
        ]);

        let averageRating = 0;
        let totalRatings = 0;

        if (summaryResult.length > 0) {
            averageRating =
                Math.round(
                    summaryResult[0].averageRating * 10
                ) / 10;

            totalRatings =
                summaryResult[0].totalRatings;
        }

        return res.status(200).json({
            success: true,

            summary: {
                averageRating,
                totalRatings,
            },

            ratings,
        });

    } catch (error) {
        console.error("Get Driver Ratings Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET CUSTOMER'S RATING FOR A TRIP
// ==========================================
const getMyTripRating = async (req, res) => {
    try {
        // Find customer
        const customer = await Customer.findOne({
            user: req.user._id,
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        // Find customer's rating for this trip
        const rating = await Rating.findOne({
            trip: req.params.tripId,
            customer: customer._id,
        })
            .populate(
                "driver",
                "driverId fullName profileImage"
            )
            .populate(
                "trip",
                "tripId status"
            );

        return res.status(200).json({
            success: true,
            rating: rating || null,
        });

    } catch (error) {
        console.error("Get My Trip Rating Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    createRating,
    getDriverRatings,
    getMyTripRating,
};