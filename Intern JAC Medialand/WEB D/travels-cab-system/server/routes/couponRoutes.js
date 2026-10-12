const express = require("express");

const {
    createCoupon,
    getAllCoupons,
    validateCoupon,
    updateCoupon,
    deleteCoupon,
} = require("../controllers/CouponController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    createCoupon
);

router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllCoupons
);

router.post(
    "/validate",
    protect,
    authorizeRoles("customer", "admin", "superadmin"),
    validateCoupon
);

router.put(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateCoupon
);

router.delete(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    deleteCoupon
);

module.exports = router;