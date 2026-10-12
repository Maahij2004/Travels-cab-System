const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
    {
        vehicleId: {
            type: String,
            unique: true,
            trim: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        vehicleNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        vehicleType: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VehicleCategory",
            required: true,
        },

        brand: {
            type: String,
            required: true,
            trim: true,
        },

        model: {
            type: String,
            required: true,
            trim: true,
        },

        seatingCapacity: {
            type: Number,
            required: true,
            min: 1,
        },

        fuelType: {
            type: String,
            required: true,
            enum: [
                "Petrol",
                "Diesel",
                "CNG",
                "Electric",
                "Hybrid",
            ],
        },

        image: {
            type: String,
            default: "",
        },

        registrationNumber: {
            type: String,
            trim: true,
            default: "",
        },

        registrationExpiry: {
            type: Date,
            default: null,
        },

        insuranceNumber: {
            type: String,
            trim: true,
            default: "",
        },

        insuranceExpiry: {
            type: Date,
            default: null,
        },

        availability: {
            type: Boolean,
            default: true,
        },

        status: {
            type: String,
            enum: [
                "Available",
                "Assigned",
                "On Trip",
                "Under Maintenance",
                "Inactive",
            ],
            default: "Available",
        },

        notes: {
            type: String,
            trim: true,
            default: "",
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

module.exports =
    mongoose.models.Vehicle ||
    mongoose.model("Vehicle", vehicleSchema);