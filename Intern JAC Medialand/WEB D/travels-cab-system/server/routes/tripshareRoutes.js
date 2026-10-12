const express = require("express");

const {
    createTripShare,
    getSharedTrip,
} = require("../controllers/tripshareController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
    "/",
    protect,
    authorizeRoles("customer"),
    createTripShare
);

router.get(
    "/shared/:token",
    getSharedTrip
);

module.exports = router;