const mongoose = require("mongoose");

const dispatchOfferSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },
    sequence: { type: Number, required: true, min: 1 },
    round: { type: Number, required: true, min: 1, default: 1 },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Declined", "Expired", "Cancelled"],
      default: "Pending",
    },
    offeredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
    distanceToPickupKm: { type: Number, default: null, min: 0 },
    responseReason: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

dispatchOfferSchema.index({ booking: 1, sequence: 1 }, { unique: true });
dispatchOfferSchema.index({ booking: 1, driver: 1, round: 1 });
dispatchOfferSchema.index({ driver: 1, status: 1, expiresAt: 1 });
dispatchOfferSchema.index({ booking: 1, status: 1 });

module.exports = mongoose.models.DispatchOffer || mongoose.model("DispatchOffer", dispatchOfferSchema);
