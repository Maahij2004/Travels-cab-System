const SupportTicket = require("../models/SupportTicket");
const Customer = require("../models/customer");
const Driver = require("../models/driver");
const Booking = require("../models/booking");
const Trip = require("../models/trip");


// ==========================================
// GENERATE TICKET ID
// ==========================================
const generateTicketId = async () => {
    const lastTicket = await SupportTicket.findOne()
        .sort({ createdAt: -1 })
        .select("ticketId");

    if (!lastTicket) {
        return "TKT-00001";
    }

    const number = parseInt(
        lastTicket.ticketId.replace("TKT-", ""),
        10
    );

    return `TKT-${String(number + 1).padStart(5, "0")}`;
};


// ==========================================
// CREATE TICKET
// ==========================================
const createTicket = async (req, res) => {
    try {
        const {
            subject,
            description,
            category,
            priority,
            booking,
            trip,
        } = req.body;

        if (!subject || !description) {
            return res.status(400).json({
                success: false,
                message: "Subject and description are required",
            });
        }

        const ticketId = await generateTicketId();

        let customer = null;
        let driver = null;

        if (req.user.role === "customer") {
            customer = await Customer.findOne({
                user: req.user._id,
            });
        }

        if (req.user.role === "driver") {
            driver = await Driver.findOne({
                user: req.user._id,
            });
        }

        const ticket = await SupportTicket.create({
            ticketId,
            user: req.user._id,
            customer: customer?._id || null,
            driver: driver?._id || null,
            booking: booking || null,
            trip: trip || null,
            subject,
            description,
            category,
            priority,
        });

        return res.status(201).json({
            success: true,
            message: "Support ticket created successfully",
            ticket,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// MY TICKETS
// ==========================================
const getMyTickets = async (req, res) => {
    try {
        const tickets = await SupportTicket.find({
            user: req.user._id,
        })
            .populate("booking")
            .populate("trip")
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: tickets.length,
            tickets,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// ALL TICKETS - ADMIN
// ==========================================
const getAllTickets = async (req, res) => {
    try {
        const tickets = await SupportTicket.find()
            .populate("user", "name email phone role")
            .populate("customer")
            .populate("driver")
            .populate("booking")
            .populate("trip")
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: tickets.length,
            tickets,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// GET SINGLE TICKET
// ==========================================
const getTicketById = async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id)
            .populate("user", "name email phone role")
            .populate("customer")
            .populate("driver")
            .populate("booking")
            .populate("trip")
            .populate("assignedTo", "name email");

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Support ticket not found",
            });
        }

        const isAdmin =
            req.user.role === "admin" ||
            req.user.role === "superadmin";

        if (
            !isAdmin &&
            ticket.user._id.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this ticket",
            });
        }

        return res.status(200).json({
            success: true,
            ticket,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// ==========================================
// UPDATE TICKET - ADMIN
// ==========================================
const updateTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: "Support ticket not found",
            });
        }

        const {
            status,
            priority,
            adminResponse,
            assignedTo,
        } = req.body;

        if (status) {
            ticket.status = status;

            if (status === "Resolved" || status === "Closed") {
                ticket.resolvedAt = new Date();
            }
        }

        if (priority) {
            ticket.priority = priority;
        }

        if (adminResponse !== undefined) {
            ticket.adminResponse = adminResponse;
        }

        if (assignedTo) {
            ticket.assignedTo = assignedTo;
        }

        await ticket.save();

        return res.status(200).json({
            success: true,
            message: "Support ticket updated successfully",
            ticket,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    createTicket,
    getMyTickets,
    getAllTickets,
    getTicketById,
    updateTicket,
};