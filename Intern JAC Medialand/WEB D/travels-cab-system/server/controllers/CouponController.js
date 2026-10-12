const Coupon = require("../models/Coupon");
const Customer = require("../models/customer");
const Booking = require("../models/booking");


// ==========================================
// CREATE COUPON
// ==========================================
const createCoupon = async (req, res) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            maxDiscount,
            minimumFare,
            usageLimit,
            perCustomerLimit,
            validFrom,
            validUntil,
            applicableTripTypes,
        } = req.body;

        if (
            !code ||
            !discountType ||
            discountValue === undefined ||
            !validFrom ||
            !validUntil
        ) {
            return res.status(400).json({
                success: false,
                message: "Required coupon fields are missing",
            });
        }

        if (discountType === "Percentage" && discountValue > 100) {
            return res.status(400).json({
                success: false,
                message: "Percentage discount cannot exceed 100",
            });
        }

        if (new Date(validUntil) <= new Date(validFrom)) {
            return res.status(400).json({
                success: false,
                message: "Invalid coupon validity period",
            });
        }

        const existing = await Coupon.findOne({
            code: code.toUpperCase(),
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Coupon code already exists",
            });
        }

        const coupon = await Coupon.create({
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue,
            maxDiscount,
            minimumFare,
            usageLimit,
            perCustomerLimit,
            validFrom,
            validUntil,
            applicableTripTypes,
            createdBy: req.user._id,
        });

        return res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            coupon,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET ALL COUPONS
// ==========================================
const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find()
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: coupons.length,
            coupons,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// VALIDATE COUPON
// ==========================================
const validateCoupon = async (req, res) => {
    try {
        const { code, fare, tripType } = req.body;

        if (!code || fare === undefined) {
            return res.status(400).json({
                success: false,
                message: "Coupon code and fare are required",
            });
        }

        let customer = null;

        if (req.user.role === "customer") {
            customer = await Customer.findOne({
                user: req.user._id,
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer profile not found",
                });
            }
        }

        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            isActive: true,
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Invalid coupon code",
            });
        }

        const now = new Date();

        if (
            now < coupon.validFrom ||
            now > coupon.validUntil
        ) {
            return res.status(400).json({
                success: false,
                message: "Coupon has expired or is not active yet",
            });
        }

        if (
            coupon.usageLimit !== null &&
            coupon.usedCount >= coupon.usageLimit
        ) {
            return res.status(400).json({
                success: false,
                message: "Coupon usage limit reached",
            });
        }

        if (customer) {
            const customerUsageCount = await Booking.countDocuments({
                    customer: customer._id,
                    couponCode: coupon.code,
                });

            if (customerUsageCount >= coupon.perCustomerLimit) {
                return res.status(400).json({
                    success: false,
                    message: "You have reached the usage limit for this coupon",
                });
            }
        }

        if (
            coupon.applicableTripTypes.length > 0 &&
            !coupon.applicableTripTypes.includes(tripType)
        ) {
            return res.status(400).json({
                success: false,
                message: "Coupon is not applicable to this trip type",
            });
        }

        if (fare < coupon.minimumFare) {
            return res.status(400).json({
                success: false,
                message:
                    `Minimum fare of ₹${coupon.minimumFare} required`,
            });
        }

        let discount = 0;

        if (coupon.discountType === "Percentage") {
            discount = (fare * coupon.discountValue) / 100;

            if (
                coupon.maxDiscount !== null &&
                discount > coupon.maxDiscount
            ) {
                discount = coupon.maxDiscount;
            }
        } else {
            discount = coupon.discountValue;
        }

        discount = Math.min(discount, fare);

        return res.status(200).json({
            success: true,
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
            },
            originalFare: fare,
            discount,
            finalFare: fare - discount,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// UPDATE COUPON
// ==========================================
const updateCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found",
            });
        }

        Object.assign(coupon, req.body);

        if (req.body.code) {
            coupon.code = req.body.code.toUpperCase();
        }

        await coupon.save();

        return res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            coupon,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// DELETE COUPON
// ==========================================
const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Coupon deleted successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    createCoupon,
    getAllCoupons,
    validateCoupon,
    updateCoupon,
    deleteCoupon,
};