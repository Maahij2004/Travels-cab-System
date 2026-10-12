const mongoose = require("mongoose");
const dotenv = require("dotenv");

const VehicleCategory = require("./models/VehicleCategory");
const Pricing = require("./models/pricing");

dotenv.config();

const seedInitialData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");
        console.log("Starting initial data setup...");

        // ============================================
        // 1. VEHICLE CATEGORIES
        // ============================================

        const categories = [
            {
                name: "Mini",
                code: "mini",
                description: "Compact and economical vehicles",
                pricingGroup: "mini_sedan",
                seatingCapacity: 4,
            },
            {
                name: "Sedan",
                code: "sedan",
                description: "Comfortable vehicles for everyday travel",
                pricingGroup: "mini_sedan",
                seatingCapacity: 4,
            },
            {
                name: "SUV",
                code: "suv",
                description: "Spacious vehicles for family and group travel",
                pricingGroup: "suv_premium",
                seatingCapacity: 6,
            },
            {
                name: "Premium",
                code: "premium",
                description: "Premium vehicles with enhanced comfort",
                pricingGroup: "suv_premium",
                seatingCapacity: 4,
            },
            {
                name: "Traveller",
                code: "traveller",
                description: "Large vehicle for group travel",
                pricingGroup: "traveller",
                seatingCapacity: 12,
            },
        ];

        for (const category of categories) {
            await VehicleCategory.findOneAndUpdate(
                { code: category.code },
                {
                    $set: category,
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                }
            );
        }

        console.log("✓ Vehicle categories created/updated");

        // ============================================
        // 2. PRICING CONFIGURATIONS
        // ============================================

        const pricingConfigurations = [
            {
                name: "Mini Sedan Standard Pricing",
                vehicleGroup: "mini_sedan",

                firstKmFare: 90,
                additionalKmFare: 12,
                minimumFare: 90,

                nightCharge: 50,
                waitingChargePerMinute: 2,
                airportCharge: 100,
                parkingCharge: 0,
                permitCharge: 0,

                tollHandling: true,

                surgeEnabled: false,
                surgeMultiplier: 1,

                hourlyPackages: [
                    {
                        hours: 4,
                        includedKm: 40,
                        packageFare: 800,
                        extraKmFare: 15,
                        extraHourFare: 150,
                        isActive: true,
                    },
                    {
                        hours: 8,
                        includedKm: 80,
                        packageFare: 1400,
                        extraKmFare: 15,
                        extraHourFare: 150,
                        isActive: true,
                    },
                    {
                        hours: 12,
                        includedKm: 120,
                        packageFare: 1900,
                        extraKmFare: 15,
                        extraHourFare: 150,
                        isActive: true,
                    },
                ],

                isActive: true,
            },

            {
                name: "SUV Premium Standard Pricing",
                vehicleGroup: "suv_premium",

                firstKmFare: 140,
                additionalKmFare: 18,
                minimumFare: 140,

                nightCharge: 80,
                waitingChargePerMinute: 3,
                airportCharge: 150,
                parkingCharge: 0,
                permitCharge: 0,

                tollHandling: true,

                surgeEnabled: false,
                surgeMultiplier: 1,

                hourlyPackages: [
                    {
                        hours: 4,
                        includedKm: 40,
                        packageFare: 1200,
                        extraKmFare: 20,
                        extraHourFare: 200,
                        isActive: true,
                    },
                    {
                        hours: 8,
                        includedKm: 80,
                        packageFare: 2100,
                        extraKmFare: 20,
                        extraHourFare: 200,
                        isActive: true,
                    },
                    {
                        hours: 12,
                        includedKm: 120,
                        packageFare: 2900,
                        extraKmFare: 20,
                        extraHourFare: 200,
                        isActive: true,
                    },
                ],

                isActive: true,
            },

            {
                name: "Traveller Standard Pricing",
                vehicleGroup: "traveller",

                firstKmFare: 200,
                additionalKmFare: 25,
                minimumFare: 200,

                nightCharge: 100,
                waitingChargePerMinute: 5,
                airportCharge: 200,
                parkingCharge: 0,
                permitCharge: 0,

                tollHandling: true,

                surgeEnabled: false,
                surgeMultiplier: 1,

                hourlyPackages: [
                    {
                        hours: 4,
                        includedKm: 40,
                        packageFare: 1800,
                        extraKmFare: 25,
                        extraHourFare: 300,
                        isActive: true,
                    },
                    {
                        hours: 8,
                        includedKm: 80,
                        packageFare: 3200,
                        extraKmFare: 25,
                        extraHourFare: 300,
                        isActive: true,
                    },
                    {
                        hours: 12,
                        includedKm: 120,
                        packageFare: 4500,
                        extraKmFare: 25,
                        extraHourFare: 300,
                        isActive: true,
                    },
                ],

                isActive: true,
            },
        ];

        for (const pricing of pricingConfigurations) {
            await Pricing.findOneAndUpdate(
                {
                    vehicleGroup: pricing.vehicleGroup,
                },
                {
                    $set: pricing,
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                }
            );
        }

        console.log("✓ Pricing configurations created/updated");

        // ============================================
        // 3. DISPLAY SUMMARY
        // ============================================

        const categoryCount = await VehicleCategory.countDocuments({
            isActive: true,
        });

        const pricingCount = await Pricing.countDocuments({
            isActive: true,
        });

        console.log("");
        console.log("======================================");
        console.log(" INITIAL DATA SETUP COMPLETED");
        console.log("======================================");
        console.log(`Vehicle Categories : ${categoryCount}`);
        console.log(`Pricing Configs    : ${pricingCount}`);
        console.log("======================================");
        console.log("");
        console.log("Vehicle Categories:");

        const savedCategories = await VehicleCategory.find({
            isActive: true,
        }).sort({ name: 1 });

        savedCategories.forEach((category) => {
            console.log(
                `- ${category.name} → ${category.pricingGroup} → ${category.seatingCapacity} seats`
            );
        });

        console.log("");
        console.log("Pricing Groups:");

        const savedPricing = await Pricing.find({
            isActive: true,
        }).sort({ vehicleGroup: 1 });

        savedPricing.forEach((pricing) => {
            console.log(
                `- ${pricing.name} → ${pricing.vehicleGroup}`
            );
        });

        console.log("");
        console.log("You can now start the server normally.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("");
        console.error("Initial data setup failed:");
        console.error(error.message);

        await mongoose.connection.close();
        process.exit(1);
    }
};

seedInitialData();