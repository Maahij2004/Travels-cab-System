const express = require("express");

const {
    autoAssign,
    manualAssign,
    releaseAssignmentController,
    getAssignment,
} = require("../controllers/assignmentController");

const {
    protect,
} = require("../middleware/authMiddleware");

const {
    authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

const adminRoles = authorizeRoles(
    "admin",
    "superadmin"
);

// Automatic assignment
router.post(
    "/:bookingId/auto",
    protect,
    adminRoles,
    autoAssign
);

// Manual assignment
router.post(
    "/:bookingId/manual",
    protect,
    adminRoles,
    manualAssign
);

// View assignment
router.get(
    "/:bookingId",
    protect,
    getAssignment
);

// Release
router.post(
    "/:bookingId/release",
    protect,
    adminRoles,
    releaseAssignmentController
);

module.exports = router;