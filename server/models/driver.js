const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
    {
        driverId: {
            type: String,
            unique: true,
            trim: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        profileImage: {
            type: String,
            default: "",
        },

        phone: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        address: {
            type: String,
            default: "",
            trim: true,
        },

        licenseNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        licenseExpiry: {
            type: Date,
            required: true,
        },

        experienceYears: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        assignedVehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },

        // Vehicle class this driver is eligible to receive. The driver can
        // still have a concrete assignedVehicle when a ride is accepted.
        vehicleCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VehicleCategory",
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
                "On Leave",
                "Inactive",
            ],
            default: "Available",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },

        // RideGuard Phase 3 — driver reliability and rewards
        reliabilityScore: { type: Number, default: 70, min: 0, max: 100 },
        trustedDriver: { type: Boolean, default: false },
        rewardPoints: { type: Number, default: 0, min: 0 },
        reliabilityUpdatedAt: { type: Date, default: null },

        notes: {
            type: String,
            default: "",
            trim: true,
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
    mongoose.models.Driver ||
    mongoose.model("Driver", driverSchema);