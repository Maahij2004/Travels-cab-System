const Booking = require("../models/booking");
const Trip = require("../models/trip");
const Payment = require("../models/payment");
const Rating = require("../models/rating");

const buildDateFilter = (from, to, field = "createdAt") => {
    if (!from && !to) return {};

    const filter = {};

    if (from) {
        filter.$gte = new Date(from);
    }

    if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.$lte = end;
    }

    return { [field]: filter };
};

// ==========================================
// BOOKING REPORT
// Supports date/status/driver/vehicle filters
// ==========================================
const getBookingReport = async (req, res) => {
    try {
        const {
            from,
            to,
            status,
            driverId,
            vehicleId,
        } = req.query;

        const match = {
            ...buildDateFilter(from, to),
        };

        if (status) match.status = status;
        if (driverId) match.assignedDriver = driverId;
        if (vehicleId) match.assignedVehicle = vehicleId;

        const report = await Booking.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$tripType",
                    totalBookings: { $sum: 1 },
                    totalFare: { $sum: "$estimatedFare" },
                },
            },
            { $sort: { totalBookings: -1 } },
        ]);

        res.status(200).json({
            success: true,
            filters: { from, to, status, driverId, vehicleId },
            report,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// TRIP REPORT
// Supports date/status/driver/vehicle filters
// ==========================================
const getTripReport = async (req, res) => {
    try {
        const {
            from,
            to,
            status,
            driverId,
            vehicleId,
        } = req.query;

        const match = {
            ...buildDateFilter(from, to),
        };

        if (status) match.status = status;
        if (driverId) match.driver = driverId;
        if (vehicleId) match.vehicle = vehicleId;

        const report = await Trip.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$status",
                    trips: { $sum: 1 },
                    distance: { $sum: "$actualDistanceKm" },
                    revenue: { $sum: "$finalFare" },
                },
            },
            { $sort: { trips: -1 } },
        ]);

        res.status(200).json({
            success: true,
            filters: { from, to, status, driverId, vehicleId },
            report,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// PAYMENT REPORT
// Supports date/method/status filters
// ==========================================
const getPaymentReport = async (req, res) => {
    try {
        const {
            from,
            to,
            method,
            status,
        } = req.query;

        const match = {
            ...buildDateFilter(from, to),
        };

        if (method) match.method = method;
        if (status) match.status = status;

        const report = await Payment.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$method",
                    transactions: { $sum: 1 },
                    amount: { $sum: "$amount" },
                },
            },
            { $sort: { amount: -1 } },
        ]);

        res.status(200).json({
            success: true,
            filters: { from, to, method, status },
            report,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// RATING REPORT
// Supports date/rating/driver filters
// ==========================================
const getRatingReport = async (req, res) => {
    try {
        const {
            from,
            to,
            rating,
            driverId,
        } = req.query;

        const match = {
            ...buildDateFilter(from, to),
        };

        if (rating) match.rating = Number(rating);
        if (driverId) match.driver = driverId;

        const report = await Rating.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$rating",
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.status(200).json({
            success: true,
            filters: { from, to, rating, driverId },
            report,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    getBookingReport,
    getTripReport,
    getPaymentReport,
    getRatingReport,
};
