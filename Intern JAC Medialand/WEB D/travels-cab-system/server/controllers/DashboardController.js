const User = require("../models/user");
const Customer = require("../models/customer");
const Driver = require("../models/driver");
const Vehicle = require("../models/Vehicle");
const Booking = require("../models/booking");
const Trip = require("../models/trip");
const Payment = require("../models/payment");


// ==========================================
// ADMIN DASHBOARD
// ==========================================
const getDashboardStats = async (req, res) => {
    try {
        const [
            totalCustomers,
            totalDrivers,
            totalVehicles,
            totalBookings,
            pendingBookings,
            ongoingTrips,
            completedTrips,
            cancelledBookings,
            paidPayments,
            pendingPayments,
        ] = await Promise.all([
            Customer.countDocuments({ isActive: true }),

            Driver.countDocuments({ isActive: true }),

            Vehicle.countDocuments(),

            Booking.countDocuments(),

            Booking.countDocuments({
                status: "Pending",
            }),

            Trip.countDocuments({
                status: {
                    $in: [
                        "Started",
                        "Customer Picked Up",
                        "Ongoing",
                        "Destination Reached",
                    ],
                },
            }),

            Trip.countDocuments({
                status: "Completed",
            }),

            Booking.countDocuments({
                status: "Cancelled",
            }),

            Payment.countDocuments({
                status: "Paid",
            }),

            Payment.countDocuments({
                status: "Pending",
            }),
        ]);

        const revenueResult = await Payment.aggregate([
            {
                $match: {
                    status: "Paid",
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: "$amount",
                    },
                },
            },
        ]);

        const totalRevenue =
            revenueResult.length > 0
                ? revenueResult[0].totalRevenue
                : 0;

        const availableDrivers = await Driver.countDocuments({
            isActive: true,
            availability: true,
            status: "Available",
        });

        const availableVehicles = await Vehicle.countDocuments({
            availability: true,
            status: "Available",
        });

        return res.status(200).json({
            success: true,
            dashboard: {
                customers: totalCustomers,
                drivers: totalDrivers,
                vehicles: totalVehicles,
                bookings: totalBookings,

                pendingBookings,
                ongoingTrips,
                completedTrips,
                cancelledBookings,

                paidPayments,
                pendingPayments,

                availableDrivers,
                availableVehicles,

                totalRevenue,
            },
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// BOOKING STATUS SUMMARY
// ==========================================
const getBookingStatusSummary = async (req, res) => {
    try {
        const summary = await Booking.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: {
                        $sum: 1,
                    },
                },
            },
            {
                $sort: {
                    count: -1,
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            summary,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// TRIP STATUS SUMMARY
// ==========================================
const getTripStatusSummary = async (req, res) => {
    try {
        const summary = await Trip.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: {
                        $sum: 1,
                    },
                },
            },
            {
                $sort: {
                    count: -1,
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            summary,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// REVENUE SUMMARY
// ==========================================
const getRevenueSummary = async (req, res) => {
    try {
        const revenue = await Payment.aggregate([
            {
                $match: {
                    status: "Paid",
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: "$amount",
                    },
                    paymentCount: {
                        $sum: 1,
                    },
                    averagePayment: {
                        $avg: "$amount",
                    },
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            revenue:
                revenue.length > 0
                    ? revenue[0]
                    : {
                        totalRevenue: 0,
                        paymentCount: 0,
                        averagePayment: 0,
                    },
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// RECENT BOOKINGS
// ==========================================
const getRecentBookings = async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("customer")
            .populate("vehicleCategory")
            .populate("assignedDriver")
            .populate("assignedVehicle")
            .sort({ createdAt: -1 })
            .limit(10);

        return res.status(200).json({
            success: true,
            bookings,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    getDashboardStats,
    getBookingStatusSummary,
    getTripStatusSummary,
    getRevenueSummary,
    getRecentBookings,
};