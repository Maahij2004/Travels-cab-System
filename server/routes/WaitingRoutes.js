const express = require("express");

const {
    startWaiting,
    stopWaiting,
    markNoShow,
    getWaitingSession,
} = require("../controllers/WaitingController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
    "/start",
    protect,
    authorizeRoles("driver"),
    startWaiting
);

router.post(
    "/stop",
    protect,
    authorizeRoles("driver"),
    stopWaiting
);

router.post(
    "/no-show",
    protect,
    authorizeRoles("driver", "admin", "superadmin"),
    markNoShow
);

router.get(
    "/:tripId",
    protect,
    authorizeRoles("customer", "driver", "admin", "superadmin"),
    getWaitingSession
);

module.exports = router;