const express = require("express");

const {
    reportLostItem,
    getMyReports,
    getAllReports,
    getReportById,
    updateReport,
} = require("../controllers/LostFoundController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();


// Customer / Driver report item
router.post(
    "/",
    protect,
    authorizeRoles("customer", "driver"),
    reportLostItem
);


// Customer / Driver own reports
router.get(
    "/my",
    protect,
    authorizeRoles("customer", "driver"),
    getMyReports
);


// Admin all reports
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllReports
);


// Single report
router.get(
    "/:id",
    protect,
    getReportById
);


// Admin update
router.patch(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateReport
);

module.exports = router;