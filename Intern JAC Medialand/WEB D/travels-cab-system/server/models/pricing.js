const mongoose = require("mongoose");

const hourlyPackageSchema = new mongoose.Schema(
    {
        hours: {
            type: Number,
            required: true,
            min: 1,
        },

        includedKm: {
            type: Number,
            required: true,
            min: 0,
        },

        packageFare: {
            type: Number,
            required: true,
            min: 0,
        },

        extraKmFare: {
            type: Number,
            required: true,
            min: 0,
        },

        extraHourFare: {
            type: Number,
            required: true,
            min: 0,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        _id: true,
    }
);

const pricingSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        /*
          Pricing group is intentionally NOT an enum.
    
          Examples:
          mini_sedan
          suv_premium
          traveller
          luxury
          electric
          executive
        */
        vehicleGroup: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        firstKmFare: {
            type: Number,
            required: true,
            min: 0,
            default: 90,
        },

        additionalKmFare: {
            type: Number,
            required: true,
            min: 0,
            default: 12,
        },

        minimumFare: {
            type: Number,
            required: true,
            min: 0,
            default: 90,
        },

        hourlyPackages: {
            type: [hourlyPackageSchema],
            default: [],
        },

        nightCharge: {
            type: Number,
            default: 0,
            min: 0,
        },

        waitingChargePerMinute: {
            type: Number,
            default: 0,
            min: 0,
        },

        airportCharge: {
            type: Number,
            default: 0,
            min: 0,
        },

        parkingCharge: {
            type: Number,
            default: 0,
            min: 0,
        },

        permitCharge: {
            type: Number,
            default: 0,
            min: 0,
        },

        tollHandling: {
            type: Boolean,
            default: true,
        },

        surgeEnabled: {
            type: Boolean,
            default: false,
        },

        surgeMultiplier: {
            type: Number,
            default: 1,
            min: 1,
        },

        effectiveFrom: {
            type: Date,
            default: Date.now,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Pricing", pricingSchema);