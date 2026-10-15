const express = require("express");

const {
    createRating,
    getDriverRatings,
    getMyTripRating,
    getAllRatings,
} = require("../controllers/ratingController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();


// ==========================================
// CUSTOMER - RATE COMPLETED TRIP
// ==========================================
router.post(
    "/",
    protect,
    authorizeRoles("customer"),
    createRating
);


// ==========================================
// CUSTOMER - CHECK MY RATING
// FOR A PARTICULAR TRIP
// ==========================================
router.get(
    "/trip/:tripId",
    protect,
    authorizeRoles("customer"),
    getMyTripRating
);


// ==========================================
// VIEW DRIVER RATINGS
// ==========================================
// ==========================================
// ADMIN - VIEW ALL CUSTOMER RATINGS
// ==========================================
router.get(
    "/admin/all",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllRatings
);

router.get(
    "/driver/:driverId",
    protect,
    getDriverRatings
);


module.exports = router;