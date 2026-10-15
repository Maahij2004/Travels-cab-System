const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
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

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            required: true,
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: false,
            default: null,
        },

        // Legacy `rating` is kept as the driver rating so existing admin
        // reports and driver-rating queries continue to work.
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        driverRating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },

        vehicleRating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },

        review: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.Rating ||
    mongoose.model("Rating", ratingSchema);