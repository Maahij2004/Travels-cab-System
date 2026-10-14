const mongoose = require("mongoose");

const waitingSessionSchema = new mongoose.Schema(
    {
        trip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
            required: true,
            unique: true,
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            required: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },

        startedAt: {
            type: Date,
            default: null,
        },

        endedAt: {
            type: Date,
            default: null,
        },

        waitingMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        waitingCharge: {
            type: Number,
            default: 0,
            min: 0,
        },

        noShowLimitMinutes: {
            type: Number,
            default: 20,
        },

        status: {
            type: String,
            enum: [
                "Not Started",
                "Waiting",
                "Completed",
                "No Show",
                "Cancelled",
            ],
            default: "Not Started",
        },

        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.WaitingSession ||
    mongoose.model("WaitingSession", waitingSessionSchema);