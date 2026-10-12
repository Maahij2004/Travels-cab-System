const express = require("express");

const {
    createCategory,
    getAllCategories,
    getActiveCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
} = require("../controllers/VehicleCategoryController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/active",
    protect,
    getActiveCategories
);

router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllCategories
);

router.post(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    createCategory
);

router.get(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    getCategoryById
);

router.put(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateCategory
);

router.delete(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    deleteCategory
);

module.exports = router;