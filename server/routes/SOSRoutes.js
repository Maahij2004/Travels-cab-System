const express = require("express");

const {
    triggerSOS,
    getAllSOS,
    resolveSOS,
} = require("../controllers/SOSController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
    "/",
    protect,
    authorizeRoles("customer", "driver"),
    triggerSOS
);

router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllSOS
);

router.patch(
    "/:id/resolve",
    protect,
    authorizeRoles("admin", "superadmin"),
    resolveSOS
);

module.exports = router;