const mongoose = require("mongoose");

const tripShareSchema = new mongoose.Schema(
    {
        trip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
            required: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },

        shareToken: {
            type: String,
            required: true,
            unique: true,
        },

        sharedWithName: {
            type: String,
            default: "",
            trim: true,
        },

        sharedWithPhone: {
            type: String,
            default: "",
            trim: true,
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.TripShare ||
    mongoose.model("TripShare", tripShareSchema);