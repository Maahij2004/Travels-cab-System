const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        description: {
            type: String,
            trim: true,
        },

        discountType: {
            type: String,
            enum: ["Percentage", "Fixed"],
            required: true,
        },

        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },

        maxDiscount: {
            type: Number,
            default: null,
            min: 0,
        },

        minimumFare: {
            type: Number,
            default: 0,
            min: 0,
        },

        usageLimit: {
            type: Number,
            default: null,
            min: 1,
        },

        perCustomerLimit: {
            type: Number,
            default: 1,
            min: 1,
        },

        usedCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        validFrom: {
            type: Date,
            required: true,
        },

        validUntil: {
            type: Date,
            required: true,
        },

        applicableTripTypes: {
            type: [String],
            default: [],
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.Coupon ||
    mongoose.model("Coupon", couponSchema);