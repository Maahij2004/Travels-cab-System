const express = require("express");

const {
    createTicket,
    getMyTickets,
    getAllTickets,
    getTicketById,
    updateTicket,
} = require("../controllers/SupportTicketController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();


// Customer / Driver create ticket
router.post(
    "/",
    protect,
    authorizeRoles("customer", "driver"),
    createTicket
);


// Customer / Driver own tickets
router.get(
    "/my",
    protect,
    authorizeRoles("customer", "driver"),
    getMyTickets
);


// Admin all tickets
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllTickets
);


// Single ticket
router.get(
    "/:id",
    protect,
    getTicketById
);


// Admin update ticket
router.patch(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    updateTicket
);


module.exports = router;