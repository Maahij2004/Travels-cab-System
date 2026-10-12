const express = require("express");

const {
    register,
    login,
    getMe,
} = require("../controllers/authcontroller");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Customer registration
router.post("/register", register);

// Login
router.post("/login", login);

// Current logged-in user
router.get("/me", protect, getMe);

module.exports = router;