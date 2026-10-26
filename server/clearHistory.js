const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const Trip = require("./models/trip");
const Booking = require("./models/booking");
const Payment = require("./models/payment");
const Invoice = require("./models/invoice");
const Rating = require("./models/rating");
const DispatchOffer = require("./models/DispatchOffer");
const RideGuardIncident = require("./models/RideGuardIncident");
const DriverLocation = require("./models/DriverLocation");
const Driver = require("./models/driver");
const Vehicle = require("./models/Vehicle");

const clearHistory = async () => {
  try {
    await connectDB();

    console.log("Starting cleanup of trips and payment history...");

    // 1. Clear Trips
    const tripResult = await Trip.deleteMany({});
    console.log(`✓ Deleted ${tripResult.deletedCount} trips.`);

    // 2. Clear Bookings
    const bookingResult = await Booking.deleteMany({});
    console.log(`✓ Deleted ${bookingResult.deletedCount} bookings.`);

    // 3. Clear Payments
    const paymentResult = await Payment.deleteMany({});
    console.log(`✓ Deleted ${paymentResult.deletedCount} payments.`);

    // 4. Clear Invoices
    const invoiceResult = await Invoice.deleteMany({});
    console.log(`✓ Deleted ${invoiceResult.deletedCount} invoices.`);

    // 5. Clear Ratings
    const ratingResult = await Rating.deleteMany({});
    console.log(`✓ Deleted ${ratingResult.deletedCount} ratings.`);

    // 6. Clear Dispatch Offers
    const offerResult = await DispatchOffer.deleteMany({});
    console.log(`✓ Deleted ${offerResult.deletedCount} dispatch offers.`);

    // 7. Clear RideGuard Incidents
    const incidentResult = await RideGuardIncident.deleteMany({});
    console.log(`✓ Deleted ${incidentResult.deletedCount} RideGuard incidents.`);

    // 8. Reset Driver Locations
    const locationResult = await DriverLocation.deleteMany({});
    console.log(`✓ Reset ${locationResult.deletedCount} driver location records.`);

    // 9. Reset Driver statuses to Available without deleting any driver accounts
    const driverResetResult = await Driver.updateMany(
      { isActive: true },
      {
        $set: {
          status: "Available",
          availability: true,
          assignedVehicle: null,
        },
      }
    );
    console.log(`✓ Reset ${driverResetResult.modifiedCount} drivers to Available (accounts preserved).`);

    // 10. Reset Vehicle statuses to Available without deleting any vehicles
    const vehicleResetResult = await Vehicle.updateMany(
      {},
      {
        $set: {
          status: "Available",
          availability: true,
        },
      }
    );
    console.log(`✓ Reset ${vehicleResetResult.modifiedCount} vehicles to Available.`);

    console.log("\nCleanup successfully completed! All drivers and customer accounts remain untouched.");
    process.exit(0);
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
};

clearHistory();
