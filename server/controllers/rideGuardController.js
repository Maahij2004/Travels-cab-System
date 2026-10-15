const Booking = require("../models/booking");
const Trip = require("../models/trip");
const Customer = require("../models/customer");
const RideGuardIncident = require("../models/RideGuardIncident");
const Driver = require("../models/driver");
const Vehicle = require("../models/Vehicle");
const { startDispatch } = require("../services/dispatchService");

const AUTO_RESCUE_TYPES = new Set(["driver_not_moving", "driver_asked_cancel", "driver_unresponsive", "driver_no_show"]);

const createIncident = async (req, res) => {
  try {
    const { bookingId, type, description = "", requestedAmount } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success:false, message:"Booking not found" });

    let customer = null;
    if (req.user.role === "customer") {
      customer = await Customer.findOne({ user: req.user._id });
      if (!customer || String(booking.customer) !== String(customer._id)) return res.status(403).json({ success:false, message:"Not authorized for this booking" });
    }
    const trip = await Trip.findOne({ booking: booking._id });
    const driver = booking.assignedDriver ? await Driver.findById(booking.assignedDriver) : null;
    const vehicle = booking.assignedVehicle ? await Vehicle.findById(booking.assignedVehicle) : null;
    if (type === "extra_fare" && (!Number.isFinite(Number(requestedAmount)) || Number(requestedAmount) < 0)) {
      return res.status(400).json({ success:false, message:"Requested extra fare amount is required" });
    }

    const incident = await RideGuardIncident.create({
      booking: booking._id, trip: trip?._id || null, customer: customer?._id || booking.customer,
      driver: driver?._id || null, vehicle: vehicle?._id || null, reportedByRole: req.user.role, type,
      severity: type === "driver_not_moving" || type === "driver_unresponsive" ? "high" : "medium",
      description: String(description).trim(), requestedAmount: type === "extra_fare" ? Number(requestedAmount) : null,
      lockedFare: booking.lockedFare ?? booking.estimatedFare ?? null
    });

    let autoRescue = false;
    if (AUTO_RESCUE_TYPES.has(type) && booking.assignedDriver && ["Trip Scheduled", "Driver Assigned", "Vehicle Assigned", "Confirmed"].includes(booking.status)) {
      autoRescue = true;
      const oldDriver = booking.assignedDriver;
      const oldVehicle = booking.assignedVehicle;
      await require("../models/DispatchOffer").updateMany({ booking: booking._id, status:"Pending" }, { $set:{ status:"Cancelled", respondedAt:new Date(), responseReason:"RideGuard Auto Rescue" } });
      if (trip && trip.status === "Scheduled") { trip.status = "Cancelled"; trip.cancellationReason = "RideGuard Auto Rescue"; await trip.save(); }
      if (oldDriver) await Driver.findByIdAndUpdate(oldDriver, { status:"Available", availability:true, assignedVehicle:null });
      if (oldVehicle) await Vehicle.findByIdAndUpdate(oldVehicle, { status:"Available", availability:true });
      booking.assignedDriver = null; booking.assignedVehicle = null; booking.status = "Pending";
      booking.rescueTriggeredAt = new Date(); booking.rescueCount = Number(booking.rescueCount || 0) + 1;
      booking.driverAcceptedAt = null; booking.commitmentDeadlineAt = null;
      await booking.save();
      incident.status = "Investigating";
      incident.resolution = "Auto Rescue activated. Booking returned to dispatch queue.";
      await incident.save();
      try { await startDispatch(booking._id); } catch (e) { console.warn("RideGuard redispatch failed:", e.message); }
    }
    return res.status(201).json({ success:true, incident, autoRescue });
  } catch (error) { return res.status(500).json({ success:false, message:error.message }); }
};

const getCustomerIncidents = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user:req.user._id });
    if (!customer) return res.status(404).json({ success:false, message:"Customer profile not found" });
    const incidents = await RideGuardIncident.find({ customer:customer._id }).populate("booking", "bookingId lockedFare estimatedFare").sort({ createdAt:-1 });
    res.json({ success:true, incidents });
  } catch (e) { res.status(500).json({ success:false, message:e.message }); }
};

const getAdminIncidents = async (req, res) => {
  try {
    const { status, severity, type } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (severity && severity !== "all") filter.severity = severity;
    if (type && type !== "all") filter.type = type;
    const incidents = await RideGuardIncident.find(filter)
      .populate("booking", "bookingId pickupLocation dropLocation lockedFare estimatedFare status couponDiscount")
      .populate("customer", "customerId fullName phone")
      .populate("driver", "driverId fullName phone")
      .populate("vehicle", "vehicleNumber brand model")
      .populate("assignedTo", "name email role")
      .sort({ createdAt:-1 });
    const all = await RideGuardIncident.find().select("status severity").lean();
    const summary = {
      total: all.length,
      open: all.filter(i => i.status === "Open").length,
      investigating: all.filter(i => i.status === "Investigating").length,
      resolved: all.filter(i => i.status === "Resolved").length,
      rejected: all.filter(i => i.status === "Rejected").length,
      critical: all.filter(i => i.severity === "critical").length,
      high: all.filter(i => i.severity === "high").length,
    };
    res.json({ success:true, incidents, summary });
  } catch (e) { res.status(500).json({ success:false, message:e.message }); }
};

const updateIncident = async (req, res) => {
  try {
    const { status, resolution, severity, adminNotes, assignedTo } = req.body;
    const incident = await RideGuardIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success:false, message:"Incident not found" });
    if (status) { incident.status = status; if (status === "Investigating" && !incident.assignedTo) incident.assignedTo = req.user._id; }
    if (resolution !== undefined) incident.resolution = String(resolution);
    if (severity) incident.severity = severity;
    if (adminNotes !== undefined) incident.adminNotes = String(adminNotes);
    if (assignedTo !== undefined) incident.assignedTo = assignedTo || null;
    if (["Resolved", "Rejected"].includes(incident.status)) { incident.resolvedAt = new Date(); incident.resolvedBy = req.user._id; }
    await incident.save(); res.json({ success:true, incident });
  } catch (e) { res.status(500).json({ success:false, message:e.message }); }
};

const getMyProtection = async (req,res) => {
  try {
    const customer = await Customer.findOne({ user:req.user._id });
    const bookings = customer ? await Booking.find({ customer:customer._id }).sort({createdAt:-1}).limit(10).select("bookingId status lockedFare fareLockedAt commitmentDeadlineAt rescueTriggeredAt rescueCount") : [];
    res.json({ success:true, bookings });
  } catch(e){ res.status(500).json({success:false,message:e.message}); }
};


// Phase 3 — Reliability score + smart dispatch support.
const calculateReliability = async (driverId) => {
  const Trip = require("../models/trip");
  const DispatchOffer = require("../models/DispatchOffer");
  const Rating = require("../models/rating");
  const driver = await Driver.findById(driverId);
  if (!driver) throw new Error("Driver not found");

  const [trips, offers, ratings, incidents] = await Promise.all([
    Trip.find({ driver: driver._id }).select("status").lean(),
    DispatchOffer.find({ driver: driver._id }).select("status").lean(),
    Rating.find({ driver: driver._id }).select("rating driverRating").lean(),
    RideGuardIncident.find({ driver: driver._id }).select("status severity").lean(),
  ]);

  const accepted = offers.filter(o => o.status === "Accepted").length;
  const expired = offers.filter(o => o.status === "Expired").length;
  const declined = offers.filter(o => o.status === "Declined").length;
  const completed = trips.filter(t => t.status === "Completed").length;
  const cancelled = trips.filter(t => t.status === "Cancelled").length;
  const avgRating = ratings.length ? ratings.reduce((sum, r) => sum + Number(r.driverRating ?? r.rating ?? 0), 0) / ratings.length : 4;
  const highIncidents = incidents.filter(i => i.severity === "high" && i.status !== "Rejected").length;
  const totalFinished = completed + cancelled;
  const cancellationRate = totalFinished ? cancelled / totalFinished : 0;
  const totalOffers = accepted + expired + declined;
  const responseRate = totalOffers ? accepted / totalOffers : 0.7;

  let score = 60;
  score += Math.min(20, completed * 0.8);
  score += Math.max(-10, Math.min(10, (avgRating - 3) * 8));
  score += Math.max(-8, Math.min(8, (responseRate - 0.7) * 25));
  score -= Math.min(15, cancellationRate * 30);
  score -= Math.min(20, expired * 1.5);
  score -= Math.min(25, highIncidents * 7);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const trusted = score >= 85 && avgRating >= 4.3 && highIncidents === 0;
  driver.reliabilityScore = score;
  driver.trustedDriver = trusted;
  driver.reliabilityUpdatedAt = new Date();
  await driver.save();

  return {
    driver,
    metrics: {
      score, trusted, avgRating: Math.round(avgRating * 10) / 10,
      completed, cancelled, accepted, expired, declined,
      responseRate: Math.round(responseRate * 100), highIncidents,
      cancellationRate: Math.round(cancellationRate * 100),
    },
  };
};

const getMyReliability = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) return res.status(404).json({ success: false, message: "Driver profile not found" });
    const result = await calculateReliability(driver._id);
    res.json({ success: true, reliability: result.metrics, rewardPoints: result.driver.rewardPoints, trustedDriver: result.driver.trustedDriver });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const getDriverReliability = async (req, res) => {
  try {
    const result = await calculateReliability(req.params.driverId);
    res.json({ success: true, reliability: result.metrics, rewardPoints: result.driver.rewardPoints, trustedDriver: result.driver.trustedDriver });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const updateDriverReward = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.driverId);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });
    const previousPoints = Number(driver.rewardPoints || 0);
    const nextPoints = Math.max(0, Number(req.body.points ?? previousPoints));
    driver.rewardPoints = nextPoints;
    if (req.body.trustedDriver !== undefined) driver.trustedDriver = Boolean(req.body.trustedDriver);
    await driver.save();
    if (nextPoints !== previousPoints || req.body.reason) {
      const RewardLedger = require("../models/DriverRewardLedger");
      await RewardLedger.create({ driver:driver._id, points:nextPoints - previousPoints, balanceAfter:nextPoints, reason:String(req.body.reason || (nextPoints > previousPoints ? "Admin reward adjustment" : "Admin reward balance update")), source:"admin", createdBy:req.user._id });
    }
    res.json({ success: true, driver: { _id: driver._id, rewardPoints: driver.rewardPoints, trustedDriver: driver.trustedDriver } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Phase 4 — payment protection status for the logged-in customer.
const getPaymentProtection = async (req, res) => {
  try {
    const Payment = require("../models/payment");
    const Trip = require("../models/trip");
    const customer = await Customer.findOne({ user: req.user._id });
    if (!customer) return res.status(404).json({ success: false, message: "Customer profile not found" });
    const trip = await Trip.findById(req.params.tripId).populate("booking");
    if (!trip || !trip.booking || String(trip.booking.customer) !== String(customer._id)) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }
    const payment = await Payment.findOne({ trip: trip._id }).lean();
    const protectedPayment = Boolean(payment && payment.status === "Paid" && (payment.method !== "Cash" || payment.driverVerifiedAt));
    res.json({
      success: true,
      protection: {
        protected: protectedPayment,
        paymentStatus: payment?.status || "Not Selected",
        method: payment?.method || null,
        amount: payment?.amount || trip.finalFare || trip.estimatedFare || 0,
        driverVerifiedAt: payment?.driverVerifiedAt || null,
        gatewayVerified: Boolean(payment && payment.method !== "Cash" && payment.status === "Paid"),
        message: protectedPayment ? "Payment protected and verified." : "Payment is not fully verified yet.",
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const getFareTransparency = async (req, res) => {
  try {
    const customer = await Customer.findOne({ user: req.user._id });
    if (!customer) return res.status(404).json({ success:false, message:"Customer profile not found" });
    const booking = await Booking.findById(req.params.bookingId).populate("vehicleCategory", "name pricingGroup");
    if (!booking || String(booking.customer) !== String(customer._id)) return res.status(404).json({ success:false, message:"Booking not found" });
    const WaitingSession = require("../models/WaitingSession");
    const trip = await Trip.findOne({ booking: booking._id }).select("finalFare estimatedFare status").lean();
    const waiting = trip ? await WaitingSession.findOne({ trip: trip._id, status: { $in: ["Completed", "No Show"] } }).select("waitingMinutes waitingCharge status").lean() : null;
    const lockedFare = Number(booking.lockedFare ?? booking.estimatedFare ?? 0);
    const couponDiscount = Number(booking.couponDiscount || 0);
    const waitingCharge = Number(waiting?.waitingCharge || 0);
    const finalFare = Number(trip?.finalFare || lockedFare);
    const extraVariance = Math.max(0, finalFare - lockedFare);
    res.json({ success:true, transparency: {
      bookingId: booking.bookingId, tripId: trip?._id || null, vehicleCategory: booking.vehicleCategory?.name || null,
      distanceKm: Number(booking.distanceKm || 0), tripType: booking.tripType,
      originalEstimate: Number(booking.estimatedFare || 0), lockedFare, couponDiscount,
      waitingMinutes: Number(waiting?.waitingMinutes || 0), waitingCharge,
      otherApprovedAdjustments: Math.max(0, extraVariance - waitingCharge), finalFare,
      locked: Boolean(booking.fareLockedAt), fareLockedAt: booking.fareLockedAt,
      currency: "INR",
      message: "The locked fare is the protected base. Any additional amount must come from an approved, visible adjustment such as waiting charges."
    }});
  } catch (e) { res.status(500).json({ success:false, message:e.message }); }
};

const rewardTier = (points) => {
  const value = Number(points || 0);
  if (value >= 2000) return { name:"Elite", min:2000, next:null };
  if (value >= 1000) return { name:"Gold", min:1000, next:2000 };
  if (value >= 500) return { name:"Silver", min:500, next:1000 };
  return { name:"Starter", min:0, next:500 };
};

const getMyRewards = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user:req.user._id });
    if (!driver) return res.status(404).json({ success:false, message:"Driver profile not found" });
    const RewardLedger = require("../models/DriverRewardLedger");
    const ledger = await RewardLedger.find({ driver:driver._id }).sort({ createdAt:-1 }).limit(25).lean();
    const tier = rewardTier(driver.rewardPoints);
    res.json({ success:true, rewards:{ points:driver.rewardPoints || 0, tier, trustedDriver:Boolean(driver.trustedDriver), reliabilityScore:Number(driver.reliabilityScore || 70), ledger } });
  } catch(e) { res.status(500).json({success:false,message:e.message}); }
};

const getDriverRewardLedger = async (req,res) => {
  try {
    const driver = await Driver.findById(req.params.driverId).select("driverId fullName rewardPoints trustedDriver reliabilityScore");
    if (!driver) return res.status(404).json({success:false,message:"Driver not found"});
    const RewardLedger = require("../models/DriverRewardLedger");
    const ledger = await RewardLedger.find({driver:driver._id}).populate("createdBy","name email").sort({createdAt:-1}).limit(100).lean();
    res.json({success:true, driver, tier:rewardTier(driver.rewardPoints), ledger});
  } catch(e) { res.status(500).json({success:false,message:e.message}); }
};

const getAdminFareTransparency = async (req,res) => {
  try {
    const bookings = await Booking.find({ lockedFare: { $ne:null } }).sort({createdAt:-1}).limit(100)
      .populate("customer","customerId fullName")
      .populate("assignedDriver","driverId fullName")
      .populate("assignedVehicle","vehicleNumber brand model")
      .select("bookingId customer assignedDriver assignedVehicle estimatedFare lockedFare couponDiscount fareLockedAt distanceKm tripType status").lean();
    const Trip = require("../models/trip");
    const trips = await Trip.find({ booking: { $in: bookings.map(b=>b._id) } }).select("booking finalFare status").lean();
    const byBooking = new Map(trips.map(t=>[String(t.booking),t]));
    const rows = bookings.map(b=>({ ...b, trip:byBooking.get(String(b._id)) || null, variance:Math.max(0, Number(byBooking.get(String(b._id))?.finalFare || b.lockedFare) - Number(b.lockedFare || 0)) }));
    res.json({success:true, rows});
  } catch(e) { res.status(500).json({success:false,message:e.message}); }
};

module.exports = { createIncident, getCustomerIncidents, getAdminIncidents, updateIncident, getMyProtection, getMyReliability, getDriverReliability, updateDriverReward, getPaymentProtection, getFareTransparency, getMyRewards, getDriverRewardLedger, getAdminFareTransparency };
