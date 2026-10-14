const express = require("express");

const {
    createCustomerProfile,
    getAllCustomers,
    getMyProfile,
    getCustomerById,
    updateCustomer,
} = require("../controllers/customerController");

const {
    protect,
} = require("../middleware/authMiddleware");

const {
    authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/me",
    protect,
    authorizeRoles("customer"),
    getMyProfile
);

router.post(
    "/profile",
    protect,
    authorizeRoles("customer"),
    createCustomerProfile
);

router.get(
    "/",
    protect,
    authorizeRoles("admin", "superadmin"),
    getAllCustomers
);

router.get(
    "/:id",
    protect,
    authorizeRoles("admin", "superadmin"),
    getCustomerById
);

router.put(
    "/:id",
    protect,
    authorizeRoles(
        "customer",
        "admin",
        "superadmin"
    ),
    updateCustomer
);

module.exports = router;