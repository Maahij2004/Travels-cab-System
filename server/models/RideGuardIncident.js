const mongoose = require("mongoose");

const rideGuardIncidentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },
  reportedByRole: { type: String, enum: ["customer", "driver", "admin", "superadmin"], required: true },
  type: { type: String, enum: ["driver_not_moving", "driver_asked_cancel", "extra_fare", "payment_refusal", "driver_unresponsive", "driver_no_show", "fare_dispute", "vehicle_issue", "safety", "cancellation", "other"], required: true },
  severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
  description: { type: String, default: "", trim: true, maxlength: 2000 },
  requestedAmount: { type: Number, default: null, min: 0 },
  lockedFare: { type: Number, default: null, min: 0 },
  status: { type: String, enum: ["Open", "Investigating", "Resolved", "Rejected"], default: "Open" },
  resolution: { type: String, default: "", trim: true },
  adminNotes: { type: String, default: "", trim: true, maxlength: 2000 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

rideGuardIncidentSchema.index({ booking: 1, createdAt: -1 });
rideGuardIncidentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.RideGuardIncident || mongoose.model("RideGuardIncident", rideGuardIncidentSchema);
