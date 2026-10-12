const LostFound = require("../models/LostFound");
const Customer = require("../models/customer");
const Driver = require("../models/driver");
const Booking = require("../models/booking");
const Trip = require("../models/trip");


// ==========================================
// GENERATE ITEM ID
// ==========================================
const generateItemId = async () => {
    const lastItem = await LostFound.findOne()
        .sort({ createdAt: -1 })
        .select("itemId");

    if (!lastItem) {
        return "LF-00001";
    }

    const number = parseInt(
        lastItem.itemId.replace("LF-", ""),
        10
    );

    return `LF-${String(number + 1).padStart(5, "0")}`;
};


// ==========================================
// REPORT LOST ITEM
// ==========================================
const reportLostItem = async (req, res) => {
    try {
        const {
            itemName,
            description,
            booking,
            trip,
            pickupLocation,
            contactPhone,
        } = req.body;

        if (!itemName || !description) {
            return res.status(400).json({
                success: false,
                message: "Item name and description are required",
            });
        }

        let customer = null;
        let driver = null;

        if (req.user.role === "customer") {
            const profile = await Customer.findOne({
                user: req.user._id,
            });

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: "Customer profile not found",
                });
            }

            customer = profile._id;
        }

        if (req.user.role === "driver") {
            const profile = await Driver.findOne({
                user: req.user._id,
            });

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: "Driver profile not found",
                });
            }

            driver = profile._id;
        }

        if (booking) {
            const bookingDoc = await Booking.findById(booking);

            if (!bookingDoc) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found",
                });
            }

            if (
                req.user.role === "customer" &&
                bookingDoc.customer.toString() !== customer.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to reference this booking",
                });
            }

            if (
                req.user.role === "driver" &&
                (!bookingDoc.assignedDriver ||
                    bookingDoc.assignedDriver.toString() !== driver.toString())
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to reference this booking",
                });
            }
        }

        if (trip) {
            const tripDoc = await Trip.findById(trip);

            if (!tripDoc) {
                return res.status(404).json({
                    success: false,
                    message: "Trip not found",
                });
            }

            if (req.user.role === "customer") {
                const tripBooking = await Booking.findById(tripDoc.booking);

                if (
                    !tripBooking ||
                    tripBooking.customer.toString() !== customer.toString()
                ) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not authorized to reference this trip",
                    });
                }
            }

            if (
                req.user.role === "driver" &&
                (!tripDoc.driver ||
                    tripDoc.driver.toString() !== driver.toString())
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to reference this trip",
                });
            }
        }

        const itemId = await generateItemId();

        const item = await LostFound.create({
            itemId,
            reportedBy: req.user._id,
            customer,
            driver,
            booking: booking || null,
            trip: trip || null,
            itemName,
            description,
            pickupLocation,
            contactPhone,
        });

        return res.status(201).json({
            success: true,
            message: "Lost item reported successfully",
            item,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// MY REPORTS
// ==========================================
const getMyReports = async (req, res) => {
    try {
        const items = await LostFound.find({
            reportedBy: req.user._id,
        })
            .populate("booking")
            .populate("trip")
            .populate("driver")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: items.length,
            items,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// ALL REPORTS - ADMIN
// ==========================================
const getAllReports = async (req, res) => {
    try {
        const items = await LostFound.find()
            .populate("reportedBy", "name email phone role")
            .populate("customer")
            .populate("driver")
            .populate("booking")
            .populate("trip")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: items.length,
            items,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET SINGLE REPORT
// ==========================================
const getReportById = async (req, res) => {
    try {
        const item = await LostFound.findById(req.params.id)
            .populate("reportedBy", "name email phone role")
            .populate("customer")
            .populate("driver")
            .populate("booking")
            .populate("trip");

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Lost & Found report not found",
            });
        }

        const isAdmin =
            req.user.role === "admin" ||
            req.user.role === "superadmin";

        if (
            !isAdmin &&
            item.reportedBy._id.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this report",
            });
        }

        return res.status(200).json({
            success: true,
            item,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// UPDATE REPORT - ADMIN
// ==========================================
const updateReport = async (req, res) => {
    try {
        const item = await LostFound.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Lost & Found report not found",
            });
        }

        const {
            status,
            adminNotes,
        } = req.body;

        if (status) {
            item.status = status;

            if (
                status === "Returned" ||
                status === "Closed"
            ) {
                item.resolvedAt = new Date();
            }
        }

        if (adminNotes !== undefined) {
            item.adminNotes = adminNotes;
        }

        await item.save();

        return res.status(200).json({
            success: true,
            message: "Lost & Found report updated successfully",
            item,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    reportLostItem,
    getMyReports,
    getAllReports,
    getReportById,
    updateReport,
};