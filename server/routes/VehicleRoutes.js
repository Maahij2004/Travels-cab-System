const express = require("express");

const {
    createVehicle,
    getAllVehicles,
    getAvailableVehicles,
    getVehicleById,
    updateVehicle,
    updateVehicleStatus,
    deleteVehicle,
} = require("../controllers/VehicleController");

const {
    protect,
} = require("../middleware/authMiddleware");

const {
    authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

// Available vehicles
router.get(
    "/available",
    protect,
    getAvailableVehicles
);

// Admin vehicle list
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllVehicles
);

// Create
router.post(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    createVehicle
);

// Get single
router.get(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    getVehicleById
);

// Update
router.put(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateVehicle
);

// Status
router.patch(
    "/:id/status",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateVehicleStatus
);

// Delete
router.delete(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    deleteVehicle
);

module.exports = router;