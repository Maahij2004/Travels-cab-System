const express = require("express");

const {
    setCommission,
    getAllCommissions,
    getDriverCommission,
    updateCommissionStatus,
    calculateCommission,
} = require("../controllers/CommissionController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();


// Admin configures commission
router.post(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    setCommission
);


// Admin views all commissions
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllCommissions
);


// Driver/Admin views commission configuration
router.get(
    "/driver/:driverId",
    protect,
    authorizeRoles("admin", "superadmin", "driver"),
    getDriverCommission
);


// Admin activates/deactivates commission
router.patch(
    "/:id/status",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateCommissionStatus
);


// Calculate commission
router.post(
    "/calculate",
    protect,
    authorizeRoles("admin", "superadmin"),
    calculateCommission
);

module.exports = router;