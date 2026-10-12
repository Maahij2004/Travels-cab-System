const express = require("express");

const {
    updateDriverLocation,
    getDriverLocation,
    getMyLocation,
    stopLocationSharing,
} = require("../controllers/DriverLocationController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();


// Driver updates location
router.post(
    "/update",
    protect,
    authorizeRoles("driver"),
    updateDriverLocation
);


// Driver views own location
router.get(
    "/my",
    protect,
    authorizeRoles("driver"),
    getMyLocation
);


// Customer/Admin views driver location
router.get(
    "/driver/:driverId",
    protect,
    authorizeRoles("customer", "admin", "superadmin", "driver"),
    getDriverLocation
);


// Driver stops location sharing
router.patch(
    "/stop",
    protect,
    authorizeRoles("driver"),
    stopLocationSharing
);


module.exports = router;