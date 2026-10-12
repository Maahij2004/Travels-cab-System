const express = require("express");

const {
    createDriver,
    getMyDriverProfile,
    updateMyDriverStatus,
    getAllDrivers,
    getAvailableDrivers,
    getDriverById,
    updateDriver,
    updateDriverStatus,
    deleteDriver,
} = require("../controllers/DriverController");

const {
    protect,
} = require("../middleware/authMiddleware");

const {
    authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

// Driver self-service profile routes.
router.get("/me", protect, authorizeRoles("driver"), getMyDriverProfile);
router.patch("/me/status", protect, authorizeRoles("driver"), updateMyDriverStatus);

// Available drivers
router.get(
    "/available",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAvailableDrivers
);

// All drivers
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllDrivers
);

// Create driver + login account
router.post(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    createDriver
);

// Single driver
router.get(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    getDriverById
);

// Update
router.put(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateDriver
);

// Status
router.patch(
    "/:id/status",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateDriverStatus
);

// Delete
router.delete(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    deleteDriver
);

module.exports = router;