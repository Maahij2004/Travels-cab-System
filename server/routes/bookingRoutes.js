const express = require("express");

const {
    createBooking,
    getAllBookings,
    getMyBookings,
    getBookingById,
    updateBookingStatus,
    cancelBooking,
} = require("../controllers/bookingController");

const {
    protect,
} = require("../middleware/authMiddleware");

const {
    authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

// Customer creates booking
router.post(
    "/",
    protect,
    authorizeRoles("customer"),
    createBooking
);

// Customer booking history
router.get(
    "/my",
    protect,
    authorizeRoles("customer"),
    getMyBookings
);

// Admin all bookings
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllBookings
);

// Booking details
router.get(
    "/:id",
    protect,
    authorizeRoles(
        "customer",
        "admin",
        "superadmin",
        "driver"
    ),
    getBookingById
);

// Admin status update
router.patch(
    "/:id/status",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateBookingStatus
);

// Customer cancellation
router.patch(
    "/:id/cancel",
    protect,
    authorizeRoles("customer"),
    cancelBooking
);

module.exports = router;