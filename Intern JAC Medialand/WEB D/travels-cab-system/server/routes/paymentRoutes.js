const express = require("express");

const {
    createPayment,
    verifyPayment,
    getMyPayments,
    getAllPayments,
    markPaymentPaid,
    refund,
    confirmCashByDriver,
    getDriverTripPayment,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// Customer creates payment
router.post(
    "/",
    protect,
    authorizeRoles("customer"),
    createPayment
);

// Customer verifies Razorpay payment
router.post(
    "/verify",
    protect,
    authorizeRoles("customer"),
    verifyPayment
);

router.get("/driver/trip/:tripId", protect, authorizeRoles("driver"), getDriverTripPayment);
router.patch("/:id/driver-confirm", protect, authorizeRoles("driver"), confirmCashByDriver);
// Backward-compatible alias for previously downloaded clients.
router.patch("/:id/confirm-cash", protect, authorizeRoles("driver"), confirmCashByDriver);

// Customer payment history
router.get(
    "/my",
    protect,
    authorizeRoles("customer"),
    getMyPayments
);

// Admin/Super Admin - all payments
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllPayments
);

// Admin/Super Admin - mark cash payment as paid
router.patch(
    "/:id/paid",
    protect,
    authorizeRoles("admin", "superadmin"),
    markPaymentPaid
);

// Admin/Super Admin - refund
router.patch(
    "/:id/refund",
    protect,
    authorizeRoles("admin", "superadmin"),
    refund
);

module.exports = router;