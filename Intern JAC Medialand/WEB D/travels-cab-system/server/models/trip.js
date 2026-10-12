const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
    {
        tripId: {
            type: String,
            unique: true,
            required: true,
            trim: true,
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            unique: true,
        },

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            required: true,
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
        },

        pickupLocation: {
            type: String,
            required: true,
            trim: true,
        },

        dropLocation: {
            type: String,
            required: true,
            trim: true,
        },

        scheduledDate: {
            type: Date,
            required: true,
        },

        startedAt: {
            type: Date,
            default: null,
        },

        pickedUpAt: {
            type: Date,
            default: null,
        },

        destinationReachedAt: {
            type: Date,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: [
                "Scheduled",
                "Started",
                "Customer Picked Up",
                "Ongoing",
                "Destination Reached",
                "Completed",
                "Cancelled",
            ],
            default: "Scheduled",
        },

        distanceKm: {
            type: Number,
            default: 0,
            min: 0,
        },

        actualDistanceKm: {
            type: Number,
            default: 0,
            min: 0,
        },

        estimatedFare: {
            type: Number,
            default: 0,
            min: 0,
        },

        finalFare: {
            type: Number,
            default: 0,
            min: 0,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
        },

        cancellationReason: {
            type: String,
            default: "",
            trim: true,
        },
        startOtpHash: { type: String, default: null, select: false },
        startOtpCiphertext: { type: String, default: null, select: false },
        startOtpExpiresAt: { type: Date, default: null },
        startOtpAttempts: { type: Number, default: 0, min: 0 },
        startOtpUsedAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.Trip || mongoose.model("Trip", tripSchema);