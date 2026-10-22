const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Customer = require("../models/customer");

const BCRYPT_ROUNDS = Math.max(10, Number(process.env.BCRYPT_ROUNDS || 10));

// Generate JWT
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );
};

// ===============================
// CUSTOMER REGISTRATION
// ===============================
const register = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Validation
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, phone and password are required",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters",
            });
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanPhone = phone.trim();

        // Check existing user
        const existingUser = await User.findOne({
            $or: [
                { email: cleanEmail },
                { phone: cleanPhone },
            ],
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email or phone number already registered",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create customer
        const user = await User.create({
            name: name.trim(),
            email: cleanEmail,
            phone: cleanPhone,
            password: hashedPassword,
            role: "customer",
        });

        // Create the linked customer profile at registration time so every
        // newly registered account is immediately usable by booking, trip,
        // rating, payment and invoice modules.
        const customerCount = await Customer.countDocuments();
        await Customer.create({
            customerId: `CUS-${String(customerCount + 1).padStart(4, "0")}`,
            user: user._id,
            fullName: user.name,
            email: user.email,
            phone: user.phone,
            profileImage: user.profileImage || "",
            createdBy: user._id,
        });

        // Generate token
        const token = generateToken(user);

        return res.status(201).json({
            success: true,
            message: "Registration successful",

            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Registration failed",
        });
    }
};

// ===============================
// LOGIN
// ===============================
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Find user
        const user = await User.findOne({
            email: cleanEmail,
        }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Check active status
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive",
            });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Keep login responsive. If an older account was created with a higher
        // bcrypt cost, upgrade it after the response path instead of making the
        // current login wait for a second password hash.
        const storedRounds = Number((user.password || "").split("$")[2]) || 0;
        if (storedRounds > BCRYPT_ROUNDS) {
            bcrypt.hash(password, BCRYPT_ROUNDS)
                .then((newHash) => User.findByIdAndUpdate(user._id, { password: newHash }))
                .catch((error) => console.warn("Password cost upgrade skipped:", error.message));
        }

        // Generate token
        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: "Login successful",

            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed",
        });
    }
};

// ===============================
// GET CURRENT USER
// ===============================
const getMe = async (req, res) => {
    return res.status(200).json({
        success: true,

        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: req.user.role,
            profileImage: req.user.profileImage,
            isActive: req.user.isActive,
            createdAt: req.user.createdAt,
        },
    });
};

module.exports = {
    register,
    login,
    getMe,
};