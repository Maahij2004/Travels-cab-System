const Commission = require("../models/Commission");
const Driver = require("../models/driver");
const Trip = require("../models/trip");
const Payment = require("../models/payment");


// ==========================================
// CREATE / SET COMMISSION
// ==========================================
const setCommission = async (req, res) => {
    try {
        const {
            driverId,
            commissionType,
            commissionValue,
        } = req.body;

        if (
            !driverId ||
            commissionValue === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Driver and commission value are required",
            });
        }

        const driver = await Driver.findById(driverId);

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found",
            });
        }

        if (
            commissionType === "Percentage" &&
            commissionValue > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Commission percentage cannot exceed 100",
            });
        }

        const commission = await Commission.findOneAndUpdate(
            {
                driver: driver._id,
            },
            {
                driver: driver._id,
                commissionType:
                    commissionType || "Fixed",
                commissionValue,
                isActive: true,
                effectiveFrom: new Date(),
                updatedBy: req.user._id,
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        );

        return res.status(200).json({
            success: true,
            message: "Commission configured successfully",
            commission,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET ALL COMMISSIONS
// ==========================================
const getAllCommissions = async (req, res) => {
    try {
        const commissions = await Commission.find()
            .populate("driver")
            .populate("updatedBy", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: commissions.length,
            commissions,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET DRIVER COMMISSION
// ==========================================
const getDriverCommission = async (req, res) => {
    try {
        const commission = await Commission.findOne({
            driver: req.params.driverId,
            isActive: true,
        }).populate("driver");

        if (!commission) {
            return res.status(404).json({
                success: false,
                message: "Commission configuration not found",
            });
        }

        return res.status(200).json({
            success: true,
            commission,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// UPDATE COMMISSION STATUS
// ==========================================
const updateCommissionStatus = async (req, res) => {
    try {
        const commission = await Commission.findById(
            req.params.id
        );

        if (!commission) {
            return res.status(404).json({
                success: false,
                message: "Commission not found",
            });
        }

        commission.isActive = req.body.isActive;

        await commission.save();

        return res.status(200).json({
            success: true,
            message: "Commission status updated successfully",
            commission,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// CALCULATE DRIVER COMMISSION
// ==========================================
const calculateCommission = async (req, res) => {
    try {
        const { driverId, tripId } = req.body;

        const commission = await Commission.findOne({
            driver: driverId,
            isActive: true,
        });

        if (!commission) {
            return res.status(404).json({
                success: false,
                message: "Active commission configuration not found",
            });
        }

        const trip = await Trip.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Trip not found",
            });
        }

        const fare =
            trip.finalFare ??
            trip.estimatedFare ??
            0;

        let commissionAmount = 0;

        if (commission.commissionType === "Percentage") {
            commissionAmount =
                (fare * commission.commissionValue) / 100;
        } else {
            commissionAmount =
                commission.commissionValue;
        }

        commissionAmount = Math.min(
            commissionAmount,
            fare
        );

        const driverAmount =
            fare - commissionAmount;

        return res.status(200).json({
            success: true,
            tripId,
            fare,
            commissionType: commission.commissionType,
            commissionValue: commission.commissionValue,
            commissionAmount,
            driverAmount,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    setCommission,
    getAllCommissions,
    getDriverCommission,
    updateCommissionStatus,
    calculateCommission,
};