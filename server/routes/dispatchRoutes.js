const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { startBookingDispatch, getDriverOffer, acceptDriverOffer, declineDriverOffer } = require("../controllers/dispatchController");

const router = express.Router();

router.post("/booking/:bookingId/start", protect, authorizeRoles("admin", "superadmin"), startBookingDispatch);
router.get("/driver/current", protect, authorizeRoles("driver"), getDriverOffer);
router.post("/driver/:offerId/accept", protect, authorizeRoles("driver"), acceptDriverOffer);
router.post("/driver/:offerId/decline", protect, authorizeRoles("driver"), declineDriverOffer);

module.exports = router;
