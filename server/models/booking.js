const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        bookingId: {
            type: String,
            unique: true,
            trim: true,
        },

        // Short lease used to serialize dispatch offer creation across the
        // booking API and the background worker. These fields are internal.
        dispatchLockUntil: { type: Date, default: null, select: false },
        dispatchLockToken: { type: String, default: null, select: false },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        bookingForSomeoneElse: { type: Boolean, default: false },
        passengerName: { type: String, default: "", trim: true },
        passengerPhone: { type: String, default: "", trim: true },

        bookingForSomeoneElse: { type: Boolean, default: false },
        passengerName: { type: String, default: "", trim: true },
        passengerPhone: { type: String, default: "", trim: true },

        bookingDate: {
            type: Date,
            default: Date.now,
        },

        travelDate: {
            type: Date,
            required: true,
        },

        travelTime: {
            type: String,
            required: true,
        },

        pickupLocation: {
            type: String,
            required: true,
            trim: true,
        },

        pickupLatitude: { type: Number, default: null, min: -90, max: 90 },
        pickupLongitude: { type: Number, default: null, min: -180, max: 180 },
        dropLatitude: { type: Number, default: null, min: -90, max: 90 },
        dropLongitude: { type: Number, default: null, min: -180, max: 180 },

        dropLocation: {
            type: String,
            required: true,
            trim: true,
        },

        vehicleCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VehicleCategory",
            required: true,
        },

        passengerCount: {
            type: Number,
            required: true,
            min: 1,
        },

        tripType: {
            type: String,
            enum: [
                "one_way",
                "round_trip",
                "hourly",
                "local_travel",
                "outstation_travel",
                "airport_pickup",
                "airport_drop",
            ],
            required: true,
        },

        specialRequirements: {
            type: String,
            default: "",
            trim: true,
        },

        distanceKm: {
            type: Number,
            default: 0,
            min: 0,
        },

        durationHours: {
            type: Number,
            default: 0,
            min: 0,
        },

        estimatedFare: {
            type: Number,
            required: true,
            min: 0,
        },

        // RideGuard Phase 1 + 2
        lockedFare: { type: Number, default: null, min: 0 },
        fareLockedAt: { type: Date, default: null },
        fareLockReason: { type: String, default: "Booking fare locked at confirmation" },
        driverAcceptedAt: { type: Date, default: null },
        commitmentDeadlineAt: { type: Date, default: null },
        rescueTriggeredAt: { type: Date, default: null },
        rescueCount: { type: Number, default: 0, min: 0 },

        couponCode: {
            type: String,
            default: null,
            trim: true,
            uppercase: true,
        },

        couponDiscount: {
            type: Number,
            default: 0,
            min: 0,
        },

        assignedVehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },

        assignedDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
        },

        status: {
            type: String,
            enum: [
                "Pending",
                "Confirmed",
                "Driver Assigned",
                "Vehicle Assigned",
                "Trip Scheduled",
                "Ongoing",
                "Destination Reached",
                "Completed",
                "Cancelled",
            ],
            default: "Pending",
        },

        cancellationReason: {
            type: String,
            default: "",
        },

        paymentStatus: {
            type: String,
            enum: [
                "Pending",
                "Paid",
                "Failed",
                "Refunded",
            ],
            default: "Pending",
        },

        notes: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.Booking ||
    mongoose.model("Booking", bookingSchema);