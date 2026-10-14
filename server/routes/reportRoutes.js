const express = require("express");

const {
    getBookingReport,
    getTripReport,
    getPaymentReport,
    getRatingReport,
} = require("../controllers/ReportController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/bookings",
    protect,
    authorizeRoles("admin", "superadmin"),
    getBookingReport
);

router.get(
    "/trips",
    protect,
    authorizeRoles("admin", "superadmin"),
    getTripReport
);

router.get(
    "/payments",
    protect,
    authorizeRoles("admin", "superadmin"),
    getPaymentReport
);

router.get(
    "/ratings",
    protect,
    authorizeRoles("admin", "superadmin"),
    getRatingReport
);

module.exports = router;