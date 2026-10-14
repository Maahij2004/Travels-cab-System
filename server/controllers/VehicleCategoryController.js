const VehicleCategory = require("../models/VehicleCategory");

const createCategory = async (req, res) => {
    try {
        const {
            name,
            code,
            description,
            pricingGroup,
            seatingCapacity,
            image,
        } = req.body;

        if (
            !name ||
            !code ||
            !pricingGroup ||
            !seatingCapacity
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Name, code, pricing group and seating capacity are required",
            });
        }

        const existingCategory = await VehicleCategory.findOne({
            $or: [
                { name },
                { code: code.toLowerCase() },
            ],
        });

        if (existingCategory) {
            return res.status(409).json({
                success: false,
                message: "Vehicle category already exists",
            });
        }

        const category = await VehicleCategory.create({
            name,
            code: code.toLowerCase(),
            description,
            pricingGroup: pricingGroup.toLowerCase(),
            seatingCapacity,
            image,
            createdBy: req.user._id,
        });

        res.status(201).json({
            success: true,
            message: "Vehicle category created successfully",
            category,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to create vehicle category",
            error: error.message,
        });
    }
};

const getAllCategories = async (req, res) => {
    try {
        const categories = await VehicleCategory.find()
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch vehicle categories",
            error: error.message,
        });
    }
};

const getActiveCategories = async (req, res) => {
    try {
        const categories = await VehicleCategory.find({
            isActive: true,
        }).sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch active vehicle categories",
            error: error.message,
        });
    }
};

const getCategoryById = async (req, res) => {
    try {
        const category = await VehicleCategory.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Vehicle category not found",
            });
        }

        res.status(200).json({
            success: true,
            category,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch vehicle category",
            error: error.message,
        });
    }
};

const updateCategory = async (req, res) => {
    try {
        const category = await VehicleCategory.findById(
            req.params.id
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Vehicle category not found",
            });
        }

        Object.assign(category, req.body);

        if (category.code) {
            category.code = category.code.toLowerCase();
        }

        if (category.pricingGroup) {
            category.pricingGroup =
                category.pricingGroup.toLowerCase();
        }

        await category.save();

        res.status(200).json({
            success: true,
            message: "Vehicle category updated successfully",
            category,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update vehicle category",
            error: error.message,
        });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const category = await VehicleCategory.findByIdAndDelete(
            req.params.id
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Vehicle category not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Vehicle category deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete vehicle category",
            error: error.message,
        });
    }
};

module.exports = {
    createCategory,
    getAllCategories,
    getActiveCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
};