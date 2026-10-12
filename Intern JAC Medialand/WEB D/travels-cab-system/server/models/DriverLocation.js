const mongoose = require("mongoose");

const driverLocationSchema = new mongoose.Schema(
    {
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            required: true,
            unique: true,
        },

        trip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Trip",
            default: null,
        },

        latitude: {
            type: Number,
            required: true,
            min: -90,
            max: 90,
        },

        longitude: {
            type: Number,
            required: true,
            min: -180,
            max: 180,
        },

        accuracy: {
            type: Number,
            default: null,
            min: 0,
        },

        heading: {
            type: Number,
            default: null,
            min: 0,
            max: 360,
        },

        speed: {
            type: Number,
            default: null,
            min: 0,
        },

        updatedAtLocation: {
            type: Date,
            default: Date.now,
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
    mongoose.models.DriverLocation ||
    mongoose.model("DriverLocation", driverLocationSchema);