const Pricing = require("../models/pricing");

// ========================================
// CREATE PRICING
// ========================================
const createPricing = async (req, res) => {
    try {
        const pricing = await Pricing.create({
            ...req.body,
            updatedBy: req.user._id,
        });

        return res.status(201).json({
            success: true,
            message: "Pricing created successfully",
            pricing,
        });
    } catch (error) {
        console.error("Create pricing error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create pricing",
            error: error.message,
        });
    }
};

// ========================================
// GET ALL PRICING
// ========================================
const getAllPricing = async (req, res) => {
    try {
        const pricing = await Pricing.find()
            .populate("updatedBy", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: pricing.length,
            pricing,
        });
    } catch (error) {
        console.error("Get pricing error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch pricing",
        });
    }
};

// ========================================
// GET ACTIVE PRICING
// ========================================
const getActivePricing = async (req, res) => {
    try {
        const pricing = await Pricing.find({
            isActive: true,
        });

        return res.status(200).json({
            success: true,
            pricing,
        });
    } catch (error) {
        console.error("Get active pricing error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch active pricing",
        });
    }
};

// ========================================
// GET SINGLE PRICING
// ========================================
const getPricingById = async (req, res) => {
    try {
        const pricing = await Pricing.findById(req.params.id);

        if (!pricing) {
            return res.status(404).json({
                success: false,
                message: "Pricing not found",
            });
        }

        return res.status(200).json({
            success: true,
            pricing,
        });
    } catch (error) {
        console.error("Get pricing by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch pricing",
        });
    }
};

// ========================================
// UPDATE PRICING
// ========================================
const updatePricing = async (req, res) => {
    try {
        const pricing = await Pricing.findById(req.params.id);

        if (!pricing) {
            return res.status(404).json({
                success: false,
                message: "Pricing not found",
            });
        }

        Object.assign(pricing, req.body);

        pricing.updatedBy = req.user._id;

        await pricing.save();

        return res.status(200).json({
            success: true,
            message: "Pricing updated successfully",
            pricing,
        });
    } catch (error) {
        console.error("Update pricing error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update pricing",
            error: error.message,
        });
    }
};

// ========================================
// DELETE PRICING
// ========================================
const deletePricing = async (req, res) => {
    try {
        const pricing = await Pricing.findById(req.params.id);

        if (!pricing) {
            return res.status(404).json({
                success: false,
                message: "Pricing not found",
            });
        }

        await pricing.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Pricing deleted successfully",
        });
    } catch (error) {
        console.error("Delete pricing error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete pricing",
        });
    }
};

module.exports = {
    createPricing,
    getAllPricing,
    getActivePricing,
    getPricingById,
    updatePricing,
    deletePricing,
};