const express = require("express");

const {
    getDashboardStats,
    getBookingStatusSummary,
    getTripStatusSummary,
    getRevenueSummary,
    getRecentBookings,
} = require("../controllers/DashboardController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/stats",
    protect,
    authorizeRoles("admin", "superadmin"),
    getDashboardStats
);

router.get(
    "/booking-status",
    protect,
    authorizeRoles("admin", "superadmin"),
    getBookingStatusSummary
);

router.get(
    "/trip-status",
    protect,
    authorizeRoles("admin", "superadmin"),
    getTripStatusSummary
);

router.get(
    "/revenue",
    protect,
    authorizeRoles("admin", "superadmin"),
    getRevenueSummary
);

router.get(
    "/recent-bookings",
    protect,
    authorizeRoles("admin", "superadmin"),
    getRecentBookings
);

module.exports = router;