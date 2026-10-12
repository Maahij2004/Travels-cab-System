const mongoose = require("mongoose");

const lostFoundSchema = new mongoose.Schema(
    {
        itemId: {
            type: String,
            unique: true,
            required: true,
            trim: true,
        },

        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
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

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            default: null,
        },

        trip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
            default: null,
        },

        itemName: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            required: true,
            trim: true,
        },

        pickupLocation: {
            type: String,
            trim: true,
        },

        contactPhone: {
            type: String,
            trim: true,
        },

        status: {
            type: String,
            enum: [
                "Reported",
                "Found",
                "Contacted",
                "Returned",
                "Closed",
            ],
            default: "Reported",
        },

        adminNotes: {
            type: String,
            default: "",
            trim: true,
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
    mongoose.models.LostFound ||
    mongoose.model("LostFound", lostFoundSchema);