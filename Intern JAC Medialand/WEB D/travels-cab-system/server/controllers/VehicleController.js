const Vehicle = require("../models/Vehicle");
const VehicleCategory = require("../models/VehicleCategory");

// ============================================
// CREATE VEHICLE
// ============================================

const createVehicle = async (req, res) => {
    try {
        const {
            name,
            vehicleNumber,
            vehicleType,
            category,
            brand,
            model,
            seatingCapacity,
            fuelType,
            image,
            registrationNumber,
            registrationExpiry,
            insuranceNumber,
            insuranceExpiry,
            notes,
        } = req.body;

        if (
            !name ||
            !vehicleNumber ||
            !vehicleType ||
            !category ||
            !brand ||
            !model ||
            !seatingCapacity ||
            !fuelType
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required vehicle details",
            });
        }

        // Check category
        const vehicleCategory = await VehicleCategory.findOne({
            _id: category,
            isActive: true,
        });

        if (!vehicleCategory) {
            return res.status(404).json({
                success: false,
                message: "Vehicle category not found or inactive",
            });
        }

        // Validate seating capacity
        if (
            Number(seatingCapacity) <
            Number(vehicleCategory.seatingCapacity)
        ) {
            return res.status(400).json({
                success: false,
                message: `Seating capacity must be at least ${vehicleCategory.seatingCapacity}`,
            });
        }

        // Check duplicate vehicle number
        const existingVehicle = await Vehicle.findOne({
            vehicleNumber: vehicleNumber.toUpperCase(),
        });

        if (existingVehicle) {
            return res.status(409).json({
                success: false,
                message: "Vehicle number already exists",
            });
        }

        // Generate vehicle ID
        const count = await Vehicle.countDocuments();

        const vehicleId = `VEH-${String(count + 1).padStart(
            4,
            "0"
        )}`;

        const vehicle = await Vehicle.create({
            vehicleId,
            name,
            vehicleNumber: vehicleNumber.toUpperCase(),
            vehicleType,
            category,
            brand,
            model,
            seatingCapacity,
            fuelType,
            image,
            registrationNumber,
            registrationExpiry,
            insuranceNumber,
            insuranceExpiry,
            availability: true,
            status: "Available",
            notes,
            createdBy: req.user._id,
        });

        const populatedVehicle =
            await Vehicle.findById(vehicle._id)
                .populate("category", "name code pricingGroup seatingCapacity")
                .populate("createdBy", "name email");

        res.status(201).json({
            success: true,
            message: "Vehicle created successfully",
            vehicle: populatedVehicle,
        });
    } catch (error) {
        console.error("Create vehicle error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create vehicle",
            error: error.message,
        });
    }
};

// ============================================
// GET ALL VEHICLES
// ============================================

const getAllVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find()
            .populate(
                "category",
                "name code pricingGroup seatingCapacity"
            )
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: vehicles.length,
            vehicles,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch vehicles",
            error: error.message,
        });
    }
};

// ============================================
// GET AVAILABLE VEHICLES
// ============================================

const getAvailableVehicles = async (req, res) => {
    try {
        const {
            category,
            passengers,
        } = req.query;

        const filter = {
            availability: true,
            status: "Available",
        };

        if (category) {
            filter.category = category;
        }

        if (passengers) {
            filter.seatingCapacity = {
                $gte: Number(passengers),
            };
        }

        const vehicles = await Vehicle.find(filter)
            .populate(
                "category",
                "name code pricingGroup seatingCapacity"
            )
            .sort({
                seatingCapacity: 1,
            });

        res.status(200).json({
            success: true,
            count: vehicles.length,
            vehicles,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch available vehicles",
            error: error.message,
        });
    }
};

// ============================================
// GET VEHICLE BY ID
// ============================================

const getVehicleById = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id)
            .populate(
                "category",
                "name code pricingGroup seatingCapacity"
            )
            .populate("createdBy", "name email");

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }

        res.status(200).json({
            success: true,
            vehicle,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch vehicle",
            error: error.message,
        });
    }
};

// ============================================
// UPDATE VEHICLE
// ============================================

const updateVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(
            req.params.id
        );

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }

        // If category is changing, validate it
        if (req.body.category) {
            const category =
                await VehicleCategory.findOne({
                    _id: req.body.category,
                    isActive: true,
                });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Vehicle category not found or inactive",
                });
            }

            const capacity =
                req.body.seatingCapacity ||
                vehicle.seatingCapacity;

            if (
                Number(capacity) <
                Number(category.seatingCapacity)
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Seating capacity must be at least ${category.seatingCapacity}`,
                });
            }
        }

        // Prevent duplicate vehicle number
        if (req.body.vehicleNumber) {
            const vehicleNumber =
                req.body.vehicleNumber.toUpperCase();

            const duplicate =
                await Vehicle.findOne({
                    vehicleNumber,
                    _id: { $ne: vehicle._id },
                });

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Another vehicle already uses this vehicle number",
                });
            }

            req.body.vehicleNumber = vehicleNumber;
        }

        Object.assign(vehicle, req.body);

        // Keep availability synchronized with status
        if (vehicle.status !== "Available") {
            vehicle.availability = false;
        }

        if (vehicle.status === "Available") {
            vehicle.availability = true;
        }

        await vehicle.save();

        const updatedVehicle =
            await Vehicle.findById(vehicle._id)
                .populate(
                    "category",
                    "name code pricingGroup seatingCapacity"
                )
                .populate("createdBy", "name email");

        res.status(200).json({
            success: true,
            message: "Vehicle updated successfully",
            vehicle: updatedVehicle,
        });
    } catch (error) {
        console.error("Update vehicle error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update vehicle",
            error: error.message,
        });
    }
};

// ============================================
// UPDATE VEHICLE STATUS
// ============================================

const updateVehicleStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "Available",
            "Assigned",
            "On Trip",
            "Under Maintenance",
            "Inactive",
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid vehicle status",
            });
        }

        const vehicle = await Vehicle.findById(
            req.params.id
        );

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }

        vehicle.status = status;
        vehicle.availability =
            status === "Available";

        await vehicle.save();

        res.status(200).json({
            success: true,
            message: "Vehicle status updated successfully",
            vehicle,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update vehicle status",
            error: error.message,
        });
    }
};

// ============================================
// DELETE VEHICLE
// ============================================

const deleteVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(
            req.params.id
        );

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }

        if (
            vehicle.status === "Assigned" ||
            vehicle.status === "On Trip"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Assigned or active-trip vehicles cannot be deleted",
            });
        }

        await Vehicle.findByIdAndDelete(
            req.params.id
        );

        res.status(200).json({
            success: true,
            message: "Vehicle deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete vehicle",
            error: error.message,
        });
    }
};

module.exports = {
    createVehicle,
    getAllVehicles,
    getAvailableVehicles,
    getVehicleById,
    updateVehicle,
    updateVehicleStatus,
    deleteVehicle,
};