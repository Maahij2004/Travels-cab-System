const User = require("../models/user");
const Customer = require("../models/customer");
const Booking = require("../models/booking");
const Trip = require("../models/trip");
const Payment = require("../models/payment");
const Invoice = require("../models/invoice");
const Rating = require("../models/rating");
const SupportTicket = require("../models/SupportTicket");

const createCustomerProfile = async (req, res) => {
    try {
        const existing = await Customer.findOne({
            user: req.user._id,
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Customer profile already exists",
                customer: existing,
            });
        }

        const count = await Customer.countDocuments();

        const customer = await Customer.create({
            customerId: `CUS-${String(count + 1).padStart(
                4,
                "0"
            )}`,
            user: req.user._id,
            fullName: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            profileImage: req.user.profileImage || "",
            createdBy: req.user._id,
        });

        res.status(201).json({
            success: true,
            message: "Customer profile created successfully",
            customer,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to create customer profile",
            error: error.message,
        });
    }
};

// ============================================
// GET ALL CUSTOMERS
// ============================================

const getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.find()
            .populate(
                "user",
                "name email phone role isActive"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: customers.length,
            customers,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch customers",
            error: error.message,
        });
    }
};

// ============================================
// GET CURRENT CUSTOMER
// ============================================

const getMyProfile = async (req, res) => {
    try {
        let customer = await Customer.findOne({
            user: req.user._id,
        }).populate(
            "user",
            "name email phone role isActive profileImage"
        );

        // Automatically create profile if missing
        if (!customer) {
            const count = await Customer.countDocuments();

            customer = await Customer.create({
                customerId: `CUS-${String(
                    count + 1
                ).padStart(4, "0")}`,
                user: req.user._id,
                fullName: req.user.name,
                email: req.user.email,
                phone: req.user.phone,
                profileImage:
                    req.user.profileImage || "",
                createdBy: req.user._id,
            });

            customer = await Customer.findById(
                customer._id
            ).populate(
                "user",
                "name email phone role isActive profileImage"
            );
        }

        res.status(200).json({
            success: true,
            customer,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer profile",
            error: error.message,
        });
    }
};

// ============================================
// GET CUSTOMER BY ID
// ============================================

const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(
            req.params.id
        ).populate(
            "user",
            "name email phone role isActive profileImage"
        );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        const [bookings, trips, payments, invoices, ratings, tickets] = await Promise.all([
            Booking.find({ customer: customer._id }).populate("assignedDriver", "driverId fullName phone status").populate("assignedVehicle", "vehicleNumber brand model").populate("vehicleCategory", "name").sort({ createdAt: -1 }).lean(),
            Trip.find({ booking: { $in: await Booking.find({ customer: customer._id }).distinct("_id") } }).sort({ createdAt: -1 }).lean(),
            Payment.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
            Invoice.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
            Rating.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
            SupportTicket.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
        ]);

        res.status(200).json({
            success: true,
            customer,
            adminDetails: { bookings, trips, payments, invoices, ratings, supportTickets: tickets },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch customer",
            error: error.message,
        });
    }
};

// ============================================
// UPDATE CUSTOMER
// ============================================

const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(
            req.params.id
        );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        if (
            req.user.role === "customer" &&
            customer.user.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this profile",
            });
        }

        const {
            fullName,
            email,
            phone,
            address,
            profileImage,
        } = req.body;

        if (fullName) customer.fullName = fullName;
        if (email) customer.email = email.toLowerCase();
        if (phone) customer.phone = phone;
        if (address !== undefined)
            customer.address = address;
        if (profileImage !== undefined)
            customer.profileImage = profileImage;

        await customer.save();

        // Keep User account synchronized
        if (customer.user) {
            await User.findByIdAndUpdate(
                customer.user,
                {
                    ...(fullName && { name: fullName }),
                    ...(email && {
                        email: email.toLowerCase(),
                    }),
                    ...(phone && { phone }),
                    ...(profileImage !== undefined && {
                        profileImage,
                    }),
                }
            );
        }

        const updated =
            await Customer.findById(customer._id).populate(
                "user",
                "name email phone role isActive profileImage"
            );

        res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            customer: updated,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update customer",
            error: error.message,
        });
    }
};

module.exports = {
    createCustomerProfile,
    getAllCustomers,
    getMyProfile,
    getCustomerById,
    updateCustomer,
};