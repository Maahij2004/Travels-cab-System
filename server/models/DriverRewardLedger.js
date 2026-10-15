const mongoose = require("mongoose");

const driverRewardLedgerSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
  points: { type: Number, required: true },
  balanceAfter: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  source: { type: String, enum: ["admin", "system", "trip", "rating", "reliability"], default: "admin" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

driverRewardLedgerSchema.index({ driver: 1, createdAt: -1 });

module.exports = mongoose.models.DriverRewardLedger || mongoose.model("DriverRewardLedger", driverRewardLedgerSchema);
