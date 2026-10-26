require("dotenv").config();

console.log("================================");
console.log("Starting Driver Seeder...");
console.log("================================");

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/user");
const Driver = require("./models/driver");
const VehicleCategory = require("./models/VehicleCategory");

const driverGroups = {
  Mini: 7,
  Sedan: 7,
  SUV: 7,
  Premium: 7,
  Traveller: 7,
};

async function seedDrivers() {
  console.log("Step 1: Connecting to MongoDB...");

  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Step 2: MongoDB connected successfully");

    let created = 0;
    let skipped = 0;

    for (const [category, count] of Object.entries(driverGroups)) {
      console.log(
        `\n========== ${category} DRIVERS ==========`
      );

      for (let i = 1; i <= count; i++) {
        const number = String(i).padStart(2, "0");

        const driverId =
          `DRV-${category.substring(0, 3).toUpperCase()}-${number}`;

        const email =
          `${category.toLowerCase()}${number}@driver.travels.com`;

        const phoneNumber =
          9000000000 + created + skipped + 1;

        const phone = String(phoneNumber);

        const licenseNumber =
          `TNDRV${category.substring(0, 3).toUpperCase()}${number}`;

        console.log(`\nProcessing ${driverId}...`);

        // Check driver
        const existingDriver = await Driver.findOne({
          driverId,
        });

        if (existingDriver) {
          // Existing demo fleet was originally seeded without isVerified=true.
          // Repair it so local dispatch tests can receive requests.
          if (existingDriver.isVerified !== true) {
            existingDriver.isVerified = true;
            await existingDriver.save();
            console.log(`Verified existing demo driver → ${driverId}`);
          } else {
            console.log(`Already exists → ${driverId}`);
          }
          skipped++;
          continue;
        }

        // Check user
        let user = await User.findOne({
          email,
        });

        if (!user) {
          console.log(`Creating user → ${email}`);

          const password = await bcrypt.hash(
            "Driver@12345",
            10
          );

          user = await User.create({
            name: `${category} Driver ${number}`,
            email,
            phone,
            password,
            role: "driver",
            isActive: true,
          });

          console.log(`User created → ${user._id}`);
        } else {
          console.log(`User already exists → ${email}`);
        }

        // Create driver
        console.log(`Creating driver → ${driverId}`);
        const vehicleCategory = await VehicleCategory.findOne({ name: category, isActive: true });
        if (!vehicleCategory) throw new Error(`Vehicle category not found: ${category}`);

        const driver = await Driver.create({
          driverId,

          user: user._id,

          fullName:
            `${category} Driver ${number}`,

          phone,

          email,

          address:
            "Travels Driver Hub, Tamil Nadu",

          licenseNumber,

          licenseExpiry:
            new Date("2029-12-31"),

          experienceYears:
            2 + (i % 8),

          assignedVehicle: null,
          vehicleCategory: vehicleCategory._id,

          availability: true,

          status: "Available",

          isActive: true,

          isVerified: true,

          notes:
            `Initial ${category} driver fleet`,
        });

        console.log(
          `✅ Driver created: ${driver.driverId}`
        );

        created++;
      }
    }

    console.log("\n================================");
    console.log("DRIVER SEEDING COMPLETED");
    console.log("================================");
    console.log(`Created : ${created}`);
    console.log(`Skipped : ${skipped}`);
    console.log(`Total   : ${created + skipped}`);
    console.log("================================");

  } catch (error) {
    console.error("\n❌ DRIVER SEEDING FAILED");
    console.error("Message:", error.message);
    console.error(error);
  } finally {
    console.log("\nClosing MongoDB connection...");

    await mongoose.connection.close();

    console.log("MongoDB connection closed.");
  }
}

seedDrivers()
  .then(() => {
    console.log("\nSeeder process finished.");
  })
  .catch((error) => {
    console.error("\nUnexpected seeder error:", error);
  });