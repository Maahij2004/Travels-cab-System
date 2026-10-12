const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in environment variables");
}

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const pricingRoutes = require("./routes/pricingRoutes");
const VehicleCategoryRoutes = require("./routes/VehicleCategoryRoutes");
const fareRoutes = require("./routes/fareRoutes");
const VehicleRoutes = require("./routes/VehicleRoutes");
const driverRoutes = require("./routes/driverRoutes");
const customerRoutes = require("./routes/customerRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const tripRoutes = require("./routes/tripRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const SOSRoutes = require("./routes/SOSRoutes");
const tripshareRoutes = require("./routes/tripshareRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const driverLocationRoutes = require("./routes/driverLocationRoutes");
const WaitingRoutes = require("./routes/WaitingRoutes");
const couponRoutes = require("./routes/couponRoutes");
const supportTicketRoutes = require("./routes/supportTicketRoutes");
const lostFoundRoutes = require("./routes/lostFoundRoutes");
const commissionRoutes = require("./routes/commissionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const dispatchRoutes = require("./routes/dispatchRoutes");
const { startDispatchWorker } = require("./services/dispatchService");

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection is awaited before the dispatch worker starts. This prevents
// startup dispatch attempts from racing MongoDB connection initialization.

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/vehicle-categories", VehicleCategoryRoutes);
app.use("/api/fares", fareRoutes);
app.use("/api/vehicles", VehicleRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/SOS", SOSRoutes);
app.use("/api/tripshare", tripshareRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/driver-location", driverLocationRoutes);
app.use("/api/waiting", WaitingRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/support", supportTicketRoutes);
app.use("/api/lost-found", lostFoundRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dispatch", dispatchRoutes);

// Home
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Travels Cab & Travel Booking API is running",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is healthy",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

// Start only after MongoDB has had a chance to connect, then repair legacy local
// test accounts that were created before the driver verification flag existed.
const startServer = async () => {
  await connectDB();

  if (mongoose.connection.readyState === 1) {
    // Older builds used booking+driver+sequence as a unique index. The
    // current dispatcher guarantees sequence uniqueness per booking instead,
    // so remove the legacy index if it still exists in an existing database.
    try {
      const DispatchOffer = require("./models/DispatchOffer");
      const indexes = await DispatchOffer.collection.indexes();
      if (indexes.some((index) => index.name === "booking_1_driver_1_sequence_1")) {
        await DispatchOffer.collection.dropIndex("booking_1_driver_1_sequence_1");
        console.log("[dispatch setup] Removed legacy dispatch-offer unique index.");
      }
      await DispatchOffer.syncIndexes();
    } catch (error) {
      console.warn(`[dispatch setup] Could not reconcile dispatch indexes: ${error.message}`);
    }
  }

  if (mongoose.connection.readyState === 1 && process.env.NODE_ENV !== "production") {
    const Driver = require("./models/driver");
    const result = await Driver.updateMany(
      { isActive: true, isVerified: { $ne: true } },
      { $set: { isVerified: true } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[dispatch setup] Verified ${result.modifiedCount} existing active driver account(s) for local testing.`);
    }
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (mongoose.connection.readyState === 1) startDispatchWorker();
    else console.warn("Dispatch worker not started because MongoDB is not connected.");
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});