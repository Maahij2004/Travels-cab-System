require("dotenv").config();

const mongoose = require("mongoose");

const Vehicle = require("./models/Vehicle");
const VehicleCategory = require("./models/VehicleCategory");

const MONGO_URI = process.env.MONGO_URI;

const vehicleData = {
    Mini: {
        brand: "Maruti Suzuki",
        models: ["Swift", "WagonR", "Celerio", "Alto K10"],
        fuelType: "Petrol",
        seats: 4,
    },

    Sedan: {
        brand: "Honda",
        models: ["Amaze", "City", "Hyundai Aura", "Hyundai Verna"],
        fuelType: "Petrol",
        seats: 4,
    },

    SUV: {
        brand: "Mahindra",
        models: ["XUV700", "Scorpio N", "Kia Seltos", "Hyundai Creta"],
        fuelType: "Diesel",
        seats: 6,
    },

    Premium: {
        brand: "Toyota",
        models: ["Camry", "Hyundai Ioniq 5", "Toyota Innova Hycross"],
        fuelType: "Hybrid",
        seats: 4,
    },

    Traveller: {
        brand: "Force",
        models: ["Traveller 12 Seater", "Traveller 17 Seater"],
        fuelType: "Diesel",
        seats: 12,
    },
};

const seedVehicles = async () => {
    try {
        await mongoose.connect(MONGO_URI);

        console.log("MongoDB connected");

        let totalCreated = 0;
        let totalSkipped = 0;

        const categories = await VehicleCategory.find({
            isActive: true,
        });

        if (!categories.length) {
            throw new Error(
                "No active vehicle categories found. Run seedInitialData.js first."
            );
        }

        for (const [categoryName, data] of Object.entries(vehicleData)) {
            const category = categories.find(
                (item) =>
                    item.name.toLowerCase() === categoryName.toLowerCase()
            );

            if (!category) {
                console.log(
                    `Category not found: ${categoryName}`
                );
                continue;
            }

            console.log(
                `\nCreating vehicles for ${categoryName}...`
            );

            for (let i = 1; i <= 7; i++) {
                const number = String(i).padStart(2, "0");

                const vehicleNumber =
                    `TN33${categoryName
                        .substring(0, 2)
                        .toUpperCase()}${number}`;

                const vehicleId =
                    `VEH-${categoryName
                        .substring(0, 3)
                        .toUpperCase()}-${number}`;

                const existing = await Vehicle.findOne({
                    vehicleNumber,
                });

                if (existing) {
                    console.log(
                        `Skipped existing: ${vehicleNumber}`
                    );

                    totalSkipped++;
                    continue;
                }

                const model =
                    data.models[
                    (i - 1) % data.models.length
                    ];

                await Vehicle.create({
                    vehicleId,

                    name: `${categoryName} ${number}`,

                    vehicleNumber,

                    vehicleType:
                        categoryName === "Traveller"
                            ? "Traveller"
                            : "Car",

                    category: category._id,

                    brand: data.brand,

                    model,

                    seatingCapacity: data.seats,

                    fuelType: data.fuelType,

                    registrationNumber: vehicleNumber,

                    registrationExpiry: new Date(
                        "2028-12-31"
                    ),

                    insuranceNumber:
                        `INS-${categoryName
                            .substring(0, 3)
                            .toUpperCase()}-${number}`,

                    insuranceExpiry: new Date(
                        "2027-12-31"
                    ),

                    availability: true,

                    status: "Available",

                    notes:
                        "Initial Travels fleet vehicle",
                });

                console.log(
                    `Created: ${vehicleId} | ${vehicleNumber}`
                );

                totalCreated++;
            }
        }

        console.log("\n--------------------------------");
        console.log("Vehicle seeding completed");
        console.log("--------------------------------");
        console.log(`Created: ${totalCreated}`);
        console.log(`Skipped: ${totalSkipped}`);
        console.log(`Total expected fleet: 35`);
        console.log("--------------------------------");

        await mongoose.connection.close();

        process.exit(0);
    } catch (error) {
        console.error(
            "Vehicle seeding failed:",
            error.message
        );

        await mongoose.connection.close();

        process.exit(1);
    }
};

seedVehicles();