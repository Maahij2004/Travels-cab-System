const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const User = require("./models/user");

const createSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");

        const existingAdmin = await User.findOne({
            email: "superadmin@travels.com",
        });

        if (existingAdmin) {
            console.log("Super Admin already exists.");
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash("Admin@12345", 10);

        const superAdmin = await User.create({
            name: "Travels Super Admin",
            email: "superadmin@travels.com",
            phone: "9999999999",
            password: hashedPassword,
            role: "superadmin",
            isActive: true,
        });

        console.log("=================================");
        console.log("Super Admin created successfully");
        console.log("=================================");
        console.log("Email    : superadmin@travels.com");
        console.log("Password : Admin@12345");
        console.log("Role     : superadmin");
        console.log("=================================");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("Failed to create Super Admin:");
        console.error(error.message);

        await mongoose.connection.close();
        process.exit(1);
    }
};

createSuperAdmin();