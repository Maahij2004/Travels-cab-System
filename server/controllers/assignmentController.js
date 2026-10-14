const Booking = require("../models/booking");
const Customer = require("../models/customer");
const Driver = require("../models/driver");
const Vehicle = require("../models/Vehicle");

const {
    assignDriverAndVehicle,
    releaseAssignment,
} = require("../services/assignmentService");

// ============================================
// AUTOMATIC ASSIGNMENT
// ============================================

const autoAssign = async (req, res) => {
    try {
        const result =
            await assignDriverAndVehicle(
                req.params.bookingId
            );

        res.status(200).json({
            success: true,
            message:
                "Driver and vehicle assigned successfully",
            booking: result.booking,
            driver: result.driver,
            vehicle: result.vehicle,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================
// ADMIN MANUAL ASSIGNMENT
// ============================================

const manualAssign = async (req, res) => {
    try {
        const {
            driverId,
            vehicleId,
        } = req.body;

        if (!driverId || !vehicleId) {
            return res.status(400).json({
                success: false,
                message:
                    "Driver ID and Vehicle ID are required",
            });
        }

        const booking =
            await Booking.findById(
                req.params.bookingId
            );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (
            booking.status === "Completed" ||
            booking.status === "Cancelled" ||
            booking.status === "Ongoing"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This booking cannot be reassigned",
            });
        }

        const driver =
            await Driver.findById(driverId);

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        const vehicle =
            await Vehicle.findById(vehicleId);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }

        // ============================================
        // DRIVER VALIDATION
        // ============================================

        if (
            !driver.isActive ||
            !driver.availability ||
            driver.status !== "Available"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Selected driver is not available",
            });
        }

        // ============================================
        // VEHICLE VALIDATION
        // ============================================

        if (
            !vehicle.availability ||
            vehicle.status !== "Available"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Selected vehicle is not available",
            });
        }

        // ============================================
        // CATEGORY VALIDATION
        // ============================================

        if (
            vehicle.category.toString() !==
            booking.vehicleCategory.toString()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Vehicle category does not match booking category",
            });
        }

        // ============================================
        // SEATING VALIDATION
        // ============================================

        if (
            Number(vehicle.seatingCapacity) <
            Number(booking.passengerCount)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Vehicle seating capacity is insufficient",
            });
        }

        // ============================================
        // ASSIGN
        // ============================================

        vehicle.status = "Assigned";
        vehicle.availability = false;

        driver.status = "Assigned";
        driver.availability = false;
        driver.assignedVehicle =
            vehicle._id;

        booking.assignedVehicle =
            vehicle._id;

        booking.assignedDriver =
            driver._id;

        booking.status = "Trip Scheduled";

        await vehicle.save();
        await driver.save();
        await booking.save();

        res.status(200).json({
            success: true,
            message:
                "Driver and vehicle manually assigned successfully",
            booking,
            driver,
            vehicle,
        });
    } catch (error) {
        console.error(
            "Manual assignment error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to assign driver and vehicle",
            error: error.message,
        });
    }
};

// ============================================
// RELEASE ASSIGNMENT
// ============================================

const releaseAssignmentController =
    async (req, res) => {
        try {
            const booking =
                await releaseAssignment(
                    req.params.bookingId
                );

            res.status(200).json({
                success: true,
                message:
                    "Driver and vehicle assignment released",
                booking,
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    };

// ============================================
// GET ASSIGNMENT
// ============================================

const getAssignment = async (req, res) => {
    try {
        const booking =
            await Booking.findById(
                req.params.bookingId
            )
                .populate(
                    "customer",
                    "customerId fullName phone email"
                )
                .populate(
                    "vehicleCategory",
                    "name code seatingCapacity"
                )
                .populate(
                    "assignedDriver",
                    "driverId fullName phone email status availability"
                )
                .populate(
                    "assignedVehicle",
                    "vehicleId name vehicleNumber brand model seatingCapacity status availability"
                );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (req.user.role === "customer") {
            const customer = await Customer.findOne({
                user: req.user._id,
            });

            if (
                !customer ||
                booking.customer._id.toString() !== customer._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this assignment",
                });
            }
        }

        if (req.user.role === "driver") {
            const driver = await Driver.findOne({
                user: req.user._id,
            });

            if (
                !driver ||
                !booking.assignedDriver ||
                booking.assignedDriver._id.toString() !== driver._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this assignment",
                });
            }
        }

        res.status(200).json({
            success: true,
            assignment: {
                bookingId: booking.bookingId,
                status: booking.status,
                driver: booking.assignedDriver,
                vehicle: booking.assignedVehicle,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Failed to fetch assignment",
            error: error.message,
        });
    }
};

module.exports = {
    autoAssign,
    manualAssign,
    releaseAssignmentController,
    getAssignment,
};