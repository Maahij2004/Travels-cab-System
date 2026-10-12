const express = require("express");

const {
    getMyInvoices,
    getAllInvoices,
    getInvoiceById,
} = require("../controllers/InvoiceController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();


// Customer invoices
router.get(
    "/my",
    protect,
    authorizeRoles("customer"),
    getMyInvoices
);


// Admin invoices
router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllInvoices
);


// Invoice details
router.get(
    "/:id",
    protect,
    authorizeRoles("customer", "admin", "superadmin"),
    getInvoiceById
);


module.exports = router;