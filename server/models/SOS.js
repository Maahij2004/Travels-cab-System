const mongoose = require("mongoose");

const sosSchema = new mongoose.Schema(
    {
        trip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
            required: true,
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            default: null,
        },

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
        },

        triggeredBy: {
            type: String,
            enum: ["Customer", "Driver"],
            required: true,
        },

        reason: {
            type: String,
            default: "Emergency",
            trim: true,
        },

        latitude: {
            type: Number,
            default: null,
        },

        longitude: {
            type: Number,
            default: null,
        },

        status: {
            type: String,
            enum: ["Active", "Acknowledged", "Resolved"],
            default: "Active",
        },

        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.SOS ||
    mongoose.model("SOS", sosSchema);