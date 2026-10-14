const mongoose = require("mongoose");

const vehicleCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        code: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            lowercase: true,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        pricingGroup: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },

        seatingCapacity: {
            type: Number,
            required: true,
            min: 1,
        },

        image: {
            type: String,
            default: "",
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Prevent Mongoose OverwriteModelError
module.exports =
    mongoose.models.VehicleCategory ||
    mongoose.model("VehicleCategory", vehicleCategorySchema);