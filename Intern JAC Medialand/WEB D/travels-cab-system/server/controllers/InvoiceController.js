const Invoice = require("../models/invoice");
const Customer = require("../models/customer");


// ==========================================
// GET MY INVOICES - CUSTOMER
// ==========================================
const getMyInvoices = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            user: req.user._id,
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        const invoices = await Invoice.find({
            customer: customer._id,
        })
            .populate("booking")
            .populate("trip")
            .populate("payment")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: invoices.length,
            invoices,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET ALL INVOICES - ADMIN
// ==========================================
const getAllInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find()
            .populate("customer")
            .populate("booking")
            .populate("trip")
            .populate("payment")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: invoices.length,
            invoices,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET SINGLE INVOICE
// ==========================================
const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate("customer")
            .populate("booking")
            .populate("trip")
            .populate("payment");

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found",
            });
        }

        // Admin/Super Admin can view any invoice
        if (
            req.user.role === "admin" ||
            req.user.role === "superadmin"
        ) {
            return res.status(200).json({
                success: true,
                invoice,
            });
        }

        // Customer can only view their own invoice
        if (req.user.role === "customer") {
            const customer = await Customer.findOne({
                user: req.user._id,
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer profile not found",
                });
            }

            if (
                invoice.customer._id.toString() !==
                customer._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this invoice",
                });
            }
        }

        return res.status(200).json({
            success: true,
            invoice,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    getMyInvoices,
    getAllInvoices,
    getInvoiceById,
};