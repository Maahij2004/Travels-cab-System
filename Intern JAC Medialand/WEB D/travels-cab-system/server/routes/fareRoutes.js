const express = require("express");

const {
    calculateFare,
} = require("../controllers/FareController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
    "/calculate",
    protect,
    calculateFare
);

module.exports = router;