const crypto = require("crypto");

const TripShare = require("../models/tripshare");
const Trip = require("../models/trip");
const Customer = require("../models/customer");
const Booking = require("../models/booking");


// ==========================================
// CREATE TRIP SHARE
// ==========================================
const createTripShare = async (req, res) => {
    try {
        const {
            tripId,
            sharedWithName,
            sharedWithPhone,
        } = req.body;

        if (!tripId) {
            return res.status(400).json({
                success: false,
                message: "tripId is required",
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

        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        // Verify trip belongs to logged-in customer
        const booking = await Booking.findById(trip.booking);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (
            booking.customer.toString() !==
            customer._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not authorized to share this trip",
            });
        }

        const shareToken = crypto
            .randomBytes(24)
            .toString("hex");

        const share = await TripShare.create({
            trip: trip._id,
            customer: customer._id,
            shareToken,
            sharedWithName: sharedWithName || "",
            sharedWithPhone: sharedWithPhone || "",
            expiresAt: new Date(
                Date.now() + 24 * 60 * 60 * 1000
            ),
        });

        return res.status(201).json({
            success: true,
            message: "Trip sharing link created successfully",
            share,
            shareUrl: `/shared-trip/${shareToken}`,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET SHARED TRIP
// Public
// ==========================================
const getSharedTrip = async (req, res) => {
    try {
        const share = await TripShare.findOne({
            shareToken: req.params.token,
            isActive: true,
        })
            .populate({
                path: "trip",
                populate: [
                    {
                        path: "driver",
                    },
                    {
                        path: "vehicle",
                    },
                    {
                        path: "booking",
                    },
                ],
            });

        if (!share) {
            return res.status(404).json({
                success: false,
                message: "Shared trip not found",
            });
        }

        // Check expiration
        if (
            !share.expiresAt ||
            new Date() > share.expiresAt
        ) {
            share.isActive = false;
            await share.save();

            return res.status(410).json({
                success: false,
                message: "Trip sharing link has expired",
            });
        }

        return res.status(200).json({
            success: true,
            trip: share.trip,
            sharedWithName: share.sharedWithName,
            expiresAt: share.expiresAt,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    createTripShare,
    getSharedTrip,
};