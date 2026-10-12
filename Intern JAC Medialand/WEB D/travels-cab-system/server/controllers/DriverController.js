const bcrypt = require("bcryptjs");

const User = require("../models/user");
const Driver = require("../models/driver");
const Vehicle = require("../models/Vehicle");
const Booking = require("../models/booking");
const Trip = require("../models/trip");
const Rating = require("../models/rating");
const SOS = require("../models/SOS");
const SupportTicket = require("../models/SupportTicket");

// ============================================
// CREATE DRIVER
// ============================================

const createDriver = async (req, res) => {
    try {
        const {
            fullName,
            email,
            phone,
            password,
            profileImage,
            address,
            licenseNumber,
            licenseExpiry,
            experienceYears,
            assignedVehicle,
            notes,
        } = req.body;

        if (
            !fullName ||
            !email ||
            !phone ||
            !password ||
            !licenseNumber ||
            !licenseExpiry
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Name, email, phone, password, license number and license expiry are required",
            });
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanPhone = phone.trim();
        const cleanLicense = licenseNumber.toUpperCase().trim();

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters",
            });
        }

        if (new Date(licenseExpiry) <= new Date()) {
            return res.status(400).json({
                success: false,
                message: "License expiry must be a future date",
            });
        }

        // Check existing login account by both unique identifiers.
        const existingUser = await User.findOne({
            $or: [{ email: cleanEmail }, { phone: cleanPhone }],
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: existingUser.email === cleanEmail
                    ? "A user with this email already exists"
                    : "A user with this phone number already exists",
            });
        }

        // Check license
        const existingLicense = await Driver.findOne({
            licenseNumber: cleanLicense,
        });

        if (existingLicense) {
            return res.status(409).json({
                success: false,
                message: "License number already exists",
            });
        }

        // Validate vehicle if supplied
        let vehicle = null;

        if (assignedVehicle) {
            vehicle = await Vehicle.findById(assignedVehicle);

            if (!vehicle) {
                return res.status(404).json({
                    success: false,
                    message: "Assigned vehicle not found",
                });
            }

            if (
                vehicle.status !== "Available" ||
                !vehicle.availability
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Vehicle is not available",
                });
            }
        }

        // Create login account
        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const user = await User.create({
            name: fullName,
            email: cleanEmail,
            phone: cleanPhone,
            password: hashedPassword,
            role: "driver",
            profileImage: profileImage || "",
            isActive: true,
        });

        // Generate driver ID
        const count = await Driver.countDocuments();

        const driverId = `DRV-${String(count + 1).padStart(
            4,
            "0"
        )}`;

        const driver = await Driver.create({
            driverId,
            user: user._id,
            fullName,
            profileImage: profileImage || "",
            phone,
            email: cleanEmail,
            address,
            licenseNumber: cleanLicense,
            licenseExpiry,
            experienceYears: experienceYears || 0,
            assignedVehicle: assignedVehicle || null,
            availability: assignedVehicle ? false : true,
            status: assignedVehicle
                ? "Assigned"
                : "Available",
            isActive: true,
            // Drivers created by an authenticated administrator are approved for
            // dispatch. Future verification workflows can explicitly revoke this.
            isVerified: true,
            notes,
            createdBy: req.user._id,
        });

        // If vehicle assigned, update vehicle
        if (vehicle) {
            vehicle.status = "Assigned";
            vehicle.availability = false;
            await vehicle.save();
        }

        const result = await Driver.findById(driver._id)
            .populate(
                "user",
                "name email phone role isActive"
            )
            .populate(
                "assignedVehicle",
                "vehicleId name vehicleNumber brand model status"
            )
            .populate(
                "createdBy",
                "name email"
            );

        res.status(201).json({
            success: true,
            message: "Driver created successfully",
            driver: result,
        });
    } catch (error) {
        console.error("Create driver error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create driver",
            error: error.message,
        });
    }
};

// ============================================
// GET ALL DRIVERS
// ============================================

const getAllDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find()
            .populate(
                "user",
                "name email phone role isActive"
            )
            .populate(
                "assignedVehicle",
                "vehicleId name vehicleNumber brand model status"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch drivers",
            error: error.message,
        });
    }
};

// ============================================
// GET AVAILABLE DRIVERS
// ============================================

const getAvailableDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find({
            availability: true,
            status: "Available",
            isActive: true,
            isVerified: true,
            licenseExpiry: { $gt: new Date() },
        })
            .populate(
                "assignedVehicle",
                "vehicleId name vehicleNumber brand model status"
            )
            .sort({ fullName: 1 });

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch available drivers",
            error: error.message,
        });
    }
};

// ============================================
// GET DRIVER BY ID
// ============================================

const getDriverById = async (req, res) => {
    try {
        const driver = await Driver.findById(
            req.params.id
        )
            .populate(
                "user",
                "name email phone role isActive"
            )
            .populate(
                "assignedVehicle",
                "vehicleId name vehicleNumber brand model status"
            )
            .populate(
                "createdBy",
                "name email"
            );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        const [bookings, trips, ratings, sosAlerts, tickets] = await Promise.all([
            Booking.find({ assignedDriver: driver._id }).populate("customer", "customerId fullName phone email").populate("assignedVehicle", "vehicleNumber brand model").sort({ createdAt: -1 }).lean(),
            Trip.find({ driver: driver._id }).populate("booking", "bookingId customer travelDate").populate("vehicle", "vehicleNumber brand model").sort({ createdAt: -1 }).lean(),
            Rating.find({ driver: driver._id }).sort({ createdAt: -1 }).lean(),
            SOS.find({ driver: driver._id }).sort({ createdAt: -1 }).lean(),
            SupportTicket.find({ driver: driver._id }).sort({ createdAt: -1 }).lean(),
        ]);

        res.status(200).json({
            success: true,
            driver,
            adminDetails: { bookings, trips, ratings, sosAlerts, supportTickets: tickets },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch driver",
            error: error.message,
        });
    }
};

// ============================================
// UPDATE DRIVER
// ============================================

const updateDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(
            req.params.id
        );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        const oldVehicleId =
            driver.assignedVehicle?.toString();

        const newVehicleId =
            req.body.assignedVehicle !== undefined
                ? req.body.assignedVehicle
                : oldVehicleId;

        // Validate new vehicle
        if (
            newVehicleId &&
            newVehicleId !== oldVehicleId
        ) {
            const vehicle = await Vehicle.findById(
                newVehicleId
            );

            if (!vehicle) {
                return res.status(404).json({
                    success: false,
                    message: "Vehicle not found",
                });
            }

            if (
                vehicle.status !== "Available" ||
                !vehicle.availability
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Selected vehicle is not available",
                });
            }

            // Release old vehicle
            if (oldVehicleId) {
                await Vehicle.findByIdAndUpdate(
                    oldVehicleId,
                    {
                        status: "Available",
                        availability: true,
                    }
                );
            }

            // Assign new vehicle
            vehicle.status = "Assigned";
            vehicle.availability = false;
            await vehicle.save();
        }

        // Update fields
        Object.assign(driver, req.body);

        if (req.body.licenseNumber) {
            const duplicate = await Driver.findOne({
                licenseNumber:
                    req.body.licenseNumber.toUpperCase(),
                _id: { $ne: driver._id },
            });

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "License number already exists",
                });
            }

            driver.licenseNumber =
                req.body.licenseNumber.toUpperCase();
        }

        if (newVehicleId) {
            driver.assignedVehicle = newVehicleId;
            driver.status = "Assigned";
            driver.availability = false;
        } else {
            driver.assignedVehicle = null;

            if (
                driver.status === "Assigned"
            ) {
                driver.status = "Available";
                driver.availability = true;
            }
        }

        await driver.save();

        // Update login user information
        if (driver.user) {
            const user = await User.findById(
                driver.user
            );

            if (user) {
                if (req.body.fullName) {
                    user.name = req.body.fullName;
                }

                if (req.body.email) {
                    user.email =
                        req.body.email.toLowerCase();
                }

                if (req.body.phone) {
                    user.phone = req.body.phone;
                }

                if (req.body.profileImage) {
                    user.profileImage =
                        req.body.profileImage;
                }

                await user.save();
            }
        }

        const updatedDriver =
            await Driver.findById(driver._id)
                .populate(
                    "user",
                    "name email phone role isActive"
                )
                .populate(
                    "assignedVehicle",
                    "vehicleId name vehicleNumber brand model status"
                );

        res.status(200).json({
            success: true,
            message: "Driver updated successfully",
            driver: updatedDriver,
        });
    } catch (error) {
        console.error("Update driver error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update driver",
            error: error.message,
        });
    }
};

// ============================================
// UPDATE DRIVER STATUS
// ============================================

const updateDriverStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "Available",
            "Assigned",
            "On Trip",
            "On Leave",
            "Inactive",
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid driver status",
            });
        }

        const driver = await Driver.findById(
            req.params.id
        );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        driver.status = status;
        driver.availability =
            status === "Available";

        await driver.save();

        res.status(200).json({
            success: true,
            message: "Driver status updated successfully",
            driver,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update driver status",
            error: error.message,
        });
    }
};


// ============================================
// GET CURRENT DRIVER PROFILE
// ============================================

const getMyDriverProfile = async (req, res) => {
    try {
        const driver = await Driver.findOne({ user: req.user._id })
            .populate("user", "name email phone role isActive profileImage")
            .populate("assignedVehicle", "vehicleId name vehicleNumber brand model status");

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found. Please contact admin to create your driver profile.",
            });
        }

        res.status(200).json({ success: true, driver });
    } catch (error) {
        console.error("Get my driver profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch driver profile",
            error: error.message,
        });
    }
};

// ============================================
// UPDATE CURRENT DRIVER AVAILABILITY
// ============================================

const updateMyDriverStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ["Available", "On Leave"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Drivers can only switch between Available and On Leave.",
            });
        }

        const driver = await Driver.findOne({ user: req.user._id });
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found. Please contact admin.",
            });
        }

        if (["Assigned", "On Trip"].includes(driver.status)) {
            return res.status(400).json({
                success: false,
                message: "Availability cannot be changed while you have an active assignment or trip.",
            });
        }

        driver.status = status;
        driver.availability = status === "Available";
        await driver.save();

        const updated = await Driver.findById(driver._id)
            .populate("user", "name email phone role isActive profileImage")
            .populate("assignedVehicle", "vehicleId name vehicleNumber brand model status");

        res.status(200).json({
            success: true,
            message: `Driver status updated to ${status}`,
            driver: updated,
        });
    } catch (error) {
        console.error("Update my driver status error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update driver status",
            error: error.message,
        });
    }
};

// ============================================
// DELETE DRIVER
// ============================================

const deleteDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(
            req.params.id
        );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        if (
            driver.status === "On Trip" ||
            driver.status === "Assigned"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Assigned or active-trip driver cannot be deleted",
            });
        }

        // Release vehicle
        if (driver.assignedVehicle) {
            await Vehicle.findByIdAndUpdate(
                driver.assignedVehicle,
                {
                    status: "Available",
                    availability: true,
                }
            );
        }

        // Deactivate login account
        if (driver.user) {
            await User.findByIdAndUpdate(
                driver.user,
                {
                    isActive: false,
                }
            );
        }

        await Driver.findByIdAndDelete(
            req.params.id
        );

        res.status(200).json({
            success: true,
            message: "Driver deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete driver",
            error: error.message,
        });
    }
};

module.exports = {
    createDriver,
    getMyDriverProfile,
    updateMyDriverStatus,
    getAllDrivers,
    getAvailableDrivers,
    getDriverById,
    updateDriver,
    updateDriverStatus,
    deleteDriver,
};