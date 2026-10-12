const express = require("express");

const {
    createTrip,
    getAllTrips,
    getMyDriverTrips,
    getMyCustomerTrips,
    getTripById,
    changeTripStatus,
    generatePickupOtp,
    verifyPickupOtp,
    cancelDriverTrip,
    getCustomerPickupOtp,
} = require("../controllers/tripController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Create trip from assigned booking
router.post(
    "/booking/:bookingId",
    protect,
    authorizeRoles("admin", "superadmin"),
    createTrip
);

// Admin - all trips
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllTrips
);

// Driver - own trips
router.get(
    "/driver/my",
    protect,
    authorizeRoles("driver"),
    getMyDriverTrips
);

// Customer - own trips
router.get(
    "/customer/my",
    protect,
    authorizeRoles("customer"),
    getMyCustomerTrips
);

// Trip details
router.get(
    "/:id",
    protect,
    getTripById
);

// Driver pickup OTP flow
router.post("/:id/pickup-otp", protect, authorizeRoles("driver"), generatePickupOtp);
router.post("/:id/verify-pickup-otp", protect, authorizeRoles("driver"), verifyPickupOtp);
router.post("/:id/driver-cancel", protect, authorizeRoles("driver"), cancelDriverTrip);
router.get("/:id/pickup-otp", protect, authorizeRoles("customer"), getCustomerPickupOtp);

// Update trip status
router.patch(
    "/:id/status",
    protect,
    authorizeRoles("driver", "admin", "superadmin"),
    changeTripStatus
);

module.exports = router;