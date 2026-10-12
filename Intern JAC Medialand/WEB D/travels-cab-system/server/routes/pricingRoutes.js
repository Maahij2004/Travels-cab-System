const express = require("express");

const {
    createPricing,
    getAllPricing,
    getActivePricing,
    getPricingById,
    updatePricing,
    deletePricing,
} = require("../controllers/pricingcontroller");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Active pricing
router.get(
    "/active",
    protect,
    authorizeRoles("admin", "superadmin"),
    getActivePricing
);

// All pricing
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllPricing
);

// Create pricing
router.post(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    createPricing
);

// Get pricing by ID
router.get(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    getPricingById
);

// Update pricing
router.put(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    updatePricing
);

// Delete pricing
router.delete(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    deletePricing
);

module.exports = router;