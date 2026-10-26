const Booking = require("../models/booking");
const Driver = require("../models/driver");
const DriverLocation = require("../models/DriverLocation");
const Vehicle = require("../models/Vehicle");
const VehicleCategory = require("../models/VehicleCategory");
const DispatchOffer = require("../models/DispatchOffer");
const Trip = require("../models/trip");
const RideGuardIncident = require("../models/RideGuardIncident");
const { createTripFromBooking } = require("./tripService");
const { createNotification } = require("./notificationService");
const { randomUUID } = require("crypto");
const { emitToUser, emitToDriver } = require("./socketService");

const OFFER_TIMEOUT_MS = 20000;
const LOCATION_MAX_AGE_MS = 2 * 60 * 1000;
const dispatchWarningTimes = new Map();

const warnDispatchBlocked = (booking, reason) => {
  const key = String(booking?._id || "unknown");
  const now = Date.now();
  if (now - (dispatchWarningTimes.get(key) || 0) < 60_000) return;
  dispatchWarningTimes.set(key, now);
  console.warn(`[dispatch] ${booking?.bookingId || key}: ${reason}`);
};

const haversineKm = (aLat, aLng, bLat, bLng) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getPickupCoordinates = (booking) => {
  // Number(null) is 0, so guard absent values before converting them.
  if (booking.pickupLatitude == null || booking.pickupLongitude == null ||
      booking.pickupLatitude === "" || booking.pickupLongitude === "") return null;
  const lat = Number(booking.pickupLatitude);
  const lng = Number(booking.pickupLongitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const getEligibleDrivers = async (booking) => {
  const availableVehicle = await Vehicle.exists({
    category: booking.vehicleCategory,
    availability: true,
    status: "Available",
    seatingCapacity: { $gte: booking.passengerCount },
  });
  if (!availableVehicle) {
    warnDispatchBlocked(booking, "No available vehicle matches the selected category and passenger count.");
    return [];
  }

  const drivers = await Driver.find({
    availability: true,
    status: "Available",
    isActive: true,
    $or: [{ isVerified: true }, { isVerified: { $exists: false } }],
    licenseExpiry: { $gt: new Date() },
    $and: [
      {
        $or: [
          { vehicleCategory: booking.vehicleCategory },
          { vehicleCategory: null },
          { vehicleCategory: { $exists: false } },
        ],
      },
    ],
  }).populate("vehicleCategory", "name code seatingCapacity").sort({ createdAt: 1 });

  if (!drivers.length) {
    warnDispatchBlocked(booking, "No active available driver is eligible for the selected vehicle category.");
    return [];
  }

  const driverLocations = await DriverLocation.find({
    driver: { $in: drivers.map((driver) => driver._id) },
    isActive: true,
    updatedAtLocation: { $gte: new Date(Date.now() - LOCATION_MAX_AGE_MS) },
  }).lean();
  const locationMap = new Map(driverLocations.map((item) => [String(item.driver), item]));
  const pickup = getPickupCoordinates(booking);
  const scored = drivers.map((driver) => {
    const location = locationMap.get(String(driver._id));
    const distanceToPickupKm = pickup && location
      ? haversineKm(pickup.lat, pickup.lng, Number(location.latitude), Number(location.longitude))
      : Number.POSITIVE_INFINITY;
    return { driver, distanceToPickupKm };
  });
  scored.sort((a, b) => {
    // Prefer drivers specifically registered for this vehicle category
    const aMatch = String(a.driver.vehicleCategory?._id || a.driver.vehicleCategory || "") === String(booking.vehicleCategory);
    const bMatch = String(b.driver.vehicleCategory?._id || b.driver.vehicleCategory || "") === String(booking.vehicleCategory);
    if (aMatch !== bMatch) return aMatch ? -1 : 1;

    const reliabilityDiff = Number(b.driver.reliabilityScore || 70) - Number(a.driver.reliabilityScore || 70);
    if (reliabilityDiff) return reliabilityDiff;
    if (Boolean(b.driver.trustedDriver) !== Boolean(a.driver.trustedDriver)) return b.driver.trustedDriver ? 1 : -1;
    const aHasLocation = Number.isFinite(a.distanceToPickupKm);
    const bHasLocation = Number.isFinite(b.distanceToPickupKm);
    if (aHasLocation !== bHasLocation) return aHasLocation ? -1 : 1;
    return a.distanceToPickupKm - b.distanceToPickupKm || new Date(a.driver.createdAt || 0) - new Date(b.driver.createdAt || 0);
  });
  return scored;
};

const getAlternativeVehicleCategories = async (booking) => {
  const categories = await VehicleCategory.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  const results = [];
  for (const category of categories) {
    if (String(category._id) === String(booking.vehicleCategory)) continue;
    const [driverCount, vehicleCount] = await Promise.all([
      Driver.countDocuments({ vehicleCategory: category._id, availability: true, status: "Available", isActive: true, $or: [{ isVerified: true }, { isVerified: { $exists: false } }], licenseExpiry: { $gt: new Date() } }),
      Vehicle.countDocuments({ category: category._id, availability: true, status: "Available", seatingCapacity: { $gte: booking.passengerCount } }),
    ]);
    if (driverCount > 0 && vehicleCount > 0) results.push({ _id: category._id, name: category.name, code: category.code, seatingCapacity: category.seatingCapacity, availableDrivers: driverCount });
  }
  return results;
};

const notifyDispatchState = async (booking, payload) => {
  try {
    const Customer = require("../models/customer");
    const customer = await Customer.findById(booking.customer).select("user").lean();
    if (customer?.user) emitToUser(customer.user, "dispatch:status", { bookingId: booking._id, ...payload });
  } catch (error) {
    console.warn(`[dispatch] realtime customer notification failed: ${error.message}`);
  }
};

const cancelPendingOffers = async (bookingId, exceptId = null) => {
  const query = { booking: bookingId, status: "Pending" };
  if (exceptId) query._id = { $ne: exceptId };
  await DispatchOffer.updateMany(query, {
    $set: { status: "Cancelled", respondedAt: new Date(), responseReason: "Another driver was selected" },
  });
};

const populateDispatchOffer = (query) => query
  .populate("booking", "bookingId pickupLocation dropLocation travelDate travelTime passengerCount tripType estimatedFare lockedFare commitmentDeadlineAt")
  .populate("driver", "driverId fullName phone user vehicleCategory")
  .populate("vehicle", "vehicleId vehicleNumber name brand model");

// Only one process at a time may create the next offer for a booking. This
// short Mongo-backed lease prevents the HTTP request and background worker
// from sending the same request to two drivers at once.
const offerNextDriver = async (bookingId) => {
  const lockToken = randomUUID();
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 15000);
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      $or: [
        { dispatchLockUntil: null },
        { dispatchLockUntil: { $exists: false } },
        { dispatchLockUntil: { $lte: now } },
      ],
    },
    { $set: { dispatchLockUntil: lockUntil, dispatchLockToken: lockToken } },
    { new: true }
  ).select("+dispatchLockUntil +dispatchLockToken").populate("customer");

  if (!booking) {
    // A concurrent dispatcher owns the lease. Return the already-live offer
    // if it has been created; never advance to another driver from this call.
    return populateDispatchOffer(
      DispatchOffer.findOne({ booking: bookingId, status: "Pending" })
    );
  }

  try {
    if (!booking || ["Cancelled", "Completed", "Ongoing", "Trip Scheduled"].includes(booking.status)) return null;
    if (booking.assignedDriver) return null;

    const activeOffer = await populateDispatchOffer(
      DispatchOffer.findOne({ booking: booking._id, status: "Pending" })
    );
    if (activeOffer) return activeOffer;

    const eligible = await getEligibleDrivers(booking);
    if (!eligible.length) {
      booking.status = "Pending";
      await booking.save();
      const alternatives = await getAlternativeVehicleCategories(booking);
      await notifyDispatchState(booking, { type: "unavailable", message: "No drivers are available for the selected vehicle right now.", alternatives });
      return null;
    }

    const history = await DispatchOffer.find({ booking: booking._id })
      .select("driver round sequence status")
      .sort({ sequence: 1 })
      .lean();

    // An explicit decline is final for this booking. A timed-out offer, on the
    // other hand, can be retried after every other eligible driver has had a turn.
    const declinedDriverIds = new Set(
      history.filter((item) => item.status === "Declined").map((item) => String(item.driver))
    );
    const retryableDrivers = eligible.filter(
      (item) => !declinedDriverIds.has(String(item.driver._id))
    );

    if (!retryableDrivers.length) {
      // All eligible drivers have explicitly declined. Stop offering this
      // booking to them; keep the booking pending for admin intervention.
      warnDispatchBlocked(booking, "All currently eligible drivers explicitly declined this booking.");
      booking.status = "Pending";
      await booking.save();
      const alternatives = await getAlternativeVehicleCategories(booking);
      await notifyDispatchState(booking, { type: "unavailable", message: "No drivers accepted the selected vehicle. Choose another available vehicle to continue.", alternatives });
      return null;
    }

    // Each dispatch round visits each non-declining eligible driver once.
    // Legacy offers without a round number are treated as round 1.
    let round = history.reduce((maxRound, item) => Math.max(maxRound, Number(item.round) || 1), 1);
    const offeredInRound = new Set(
      history
        .filter((item) => (Number(item.round) || 1) === round)
        .map((item) => String(item.driver))
    );

    let next = retryableDrivers.find(
      (item) => !offeredInRound.has(String(item.driver._id))
    );

    // Everyone who has not declined has already received an offer this round.
    // Start a new round at the nearest eligible driver (driver 1, then 2, etc.).
    if (!next) {
      round += 1;
      next = retryableDrivers[0];
    }

    // The booking lease serializes dispatchers, so the next sequence is stable.
    // Sequence is unique per booking; it is never reused for another driver.
    const sequence = history.reduce((maxSequence, item) => Math.max(maxSequence, Number(item.sequence) || 0), 0) + 1;
    let offer;
    try {
      offer = await DispatchOffer.create({
        booking: booking._id,
        driver: next.driver._id,
        sequence,
        round,
        expiresAt: new Date(Date.now() + OFFER_TIMEOUT_MS),
        distanceToPickupKm: Number.isFinite(next.distanceToPickupKm)
          ? Number(next.distanceToPickupKm.toFixed(2))
          : null,
      });
    } catch (error) {
      if (error?.code === 11000) {
        // A stale/parallel worker must never skip a driver. Re-read the live
        // offer and let the next worker invocation continue from the saved history.
        const live = await populateDispatchOffer(
          DispatchOffer.findOne({ booking: booking._id, status: "Pending" })
        );
        if (live) return live;
        console.warn(`[dispatch] ${booking.bookingId}: sequence collision while creating offer #${sequence}; will retry safely.`);
        return null;
      }
      throw error;
    }

    const populated = await populateDispatchOffer(DispatchOffer.findById(offer._id));
    console.info(`[dispatch] ${booking.bookingId}: offer #${sequence} (round ${round}) sent to ${next.driver.driverId || next.driver._id}.`);
    if (next.driver.user) {
      await createNotification({
        recipient: next.driver.user,
        title: "New ride request",
        message: `${booking.bookingId}: ${booking.pickupLocation} → ${booking.dropLocation}. You have 20 seconds to accept or decline.`,
        type: "Booking",
        booking: booking._id,
      });
    }
    if (next.driver.user) {
      emitToUser(next.driver.user, "dispatch:offer", { offer: populated });
    }
    emitToDriver(next.driver._id, "dispatch:offer", { offer: populated });
    await notifyDispatchState(booking, { type: "driver_contacted", offer: populated });

    return populated;
  } finally {
    await Booking.updateOne(
      { _id: bookingId, dispatchLockToken: lockToken },
      { $set: { dispatchLockUntil: null, dispatchLockToken: null } }
    ).catch((error) => console.warn(`Could not release dispatch lease: ${error.message}`));
  }
};

const startDispatch = async (bookingId) => {
  return offerNextDriver(bookingId);
};

const acceptOffer = async (offerId, driverUserId) => {
  const offer = await DispatchOffer.findById(offerId).populate("booking");
  if (!offer) throw new Error("Ride request not found");
  const driver = await Driver.findOne({ _id: offer.driver, user: driverUserId, isActive: true }).populate("vehicleCategory", "name code");
  if (!driver) throw new Error("Ride request is not assigned to this driver");
  if (offer.status !== "Pending") throw new Error("This ride request is no longer available");
  if (offer.expiresAt <= new Date()) { await expireOffer(offer); throw new Error("Ride request expired"); }

  const booking = await Booking.findOneAndUpdate(
    { _id: offer.booking._id, status: { $in: ["Pending", "Confirmed"] }, assignedDriver: null },
    { $set: { assignedDriver: driver._id, status: "Trip Scheduled", driverAcceptedAt: new Date(), commitmentDeadlineAt: new Date(Date.now() + 2 * 60 * 1000), rescueTriggeredAt: null } },
    { new: true }
  );
  if (!booking) throw new Error("Booking is no longer available");
  if (!driver.availability || driver.status !== "Available") {
    await Booking.updateOne({ _id: booking._id, assignedDriver: driver._id }, { $set: { assignedDriver: null, status: "Pending", driverAcceptedAt: null, commitmentDeadlineAt: null } });
    throw new Error("Driver is no longer available");
  }

  const driverClaim = await Driver.findOneAndUpdate(
    { _id: driver._id, availability: true, status: "Available" },
    { $set: { status: "Assigned", availability: false } },
    { new: true }
  );
  if (!driverClaim) {
    await Booking.updateOne({ _id: booking._id, assignedDriver: driver._id }, { $set: { assignedDriver: null, status: "Pending", driverAcceptedAt: null, commitmentDeadlineAt: null } });
    throw new Error("Driver is no longer available");
  }

  const vehicle = await Vehicle.findOneAndUpdate(
    { category: booking.vehicleCategory, availability: true, status: "Available", seatingCapacity: { $gte: booking.passengerCount } },
    { $set: { status: "Assigned", availability: false } },
    { new: true, sort: { createdAt: 1 } }
  );
  if (!vehicle) {
    await Driver.updateOne({ _id: driver._id }, { $set: { status: "Available", availability: true } });
    await Booking.updateOne({ _id: booking._id, assignedDriver: driver._id }, { $set: { assignedDriver: null, status: "Pending", driverAcceptedAt: null, commitmentDeadlineAt: null } });
    throw new Error("No suitable vehicle is available for this ride");
  }

  booking.assignedVehicle = vehicle._id;
  await booking.save();
  await cancelPendingOffers(booking._id, offer._id);

  let trip;
  try {
    trip = await createTripFromBooking(booking._id);
  } catch (error) {
    await Vehicle.updateOne({ _id: vehicle._id }, { $set: { status: "Available", availability: true } });
    await Driver.updateOne({ _id: driver._id }, { $set: { status: "Available", availability: true, assignedVehicle: null } });
    await Booking.updateOne({ _id: booking._id }, { $set: { assignedDriver: null, assignedVehicle: null, status: "Pending", driverAcceptedAt: null, commitmentDeadlineAt: null } });
    throw error;
  }

  await Driver.updateOne({ _id: driver._id }, { $set: { assignedVehicle: vehicle._id } });
  offer.status = "Accepted";
  offer.vehicle = vehicle._id;
  offer.respondedAt = new Date();
  await offer.save();

  const customerUserId = (await require("../models/customer").findById(booking.customer).populate("user", "_id"))?.user?._id;
  if (customerUserId) {
    await createNotification({ recipient: customerUserId, title: "Driver confirmed", message: `${driver.fullName} accepted ${booking.bookingId}. Your ${vehicle.vehicleNumber} is scheduled for pickup.`, type: "Assignment", booking: booking._id, trip: trip._id });
    emitToUser(customerUserId, "dispatch:accepted", { bookingId: booking._id, booking, driver, vehicle, trip });
  }
  await createNotification({ recipient: driver.user, title: "Ride accepted", message: `${booking.bookingId} is now assigned to you. Navigate to the pickup location.`, type: "Assignment", booking: booking._id, trip: trip._id });
  emitToUser(driver.user, "dispatch:accepted", { bookingId: booking._id, offer, booking, driver, vehicle, trip });

  return { offer, booking, driver, vehicle, trip };
};

const expireOffer = async (offer) => {
  if (offer.status !== "Pending") return null;
  offer.status = "Expired";
  offer.respondedAt = new Date();
  offer.responseReason = "Driver did not respond before the timer ended";
  await offer.save();
  try {
    const driver = await Driver.findById(offer.driver).select("user").lean();
    if (driver?.user) emitToUser(driver.user, "dispatch:expired", { offerId: offer._id });
    emitToDriver(offer.driver, "dispatch:expired", { offerId: offer._id });
  } catch { /* ignore notification failure */ }
  return offerNextDriver(offer.booking);
};

const declineOffer = async (offerId, driverUserId, reason = "Driver declined") => {
  const offer = await DispatchOffer.findById(offerId).populate("booking");
  if (!offer) throw new Error("Ride request not found");
  const driver = await Driver.findOne({ _id: offer.driver, user: driverUserId, isActive: true });
  if (!driver) throw new Error("Ride request is not assigned to this driver");
  if (offer.status !== "Pending") throw new Error("This ride request is no longer available");

  offer.status = "Declined";
  offer.respondedAt = new Date();
  offer.responseReason = reason;
  await offer.save();
  emitToUser(driverUserId, "dispatch:declined", { offerId: offer._id });
  emitToDriver(driver._id, "dispatch:declined", { offerId: offer._id });

  return offerNextDriver(offer.booking._id);
};

const getMyActiveOffer = async (driverUserId) => {
  const driver = await Driver.findOne({ user: driverUserId, isActive: true });
  if (!driver) throw new Error("Driver profile not found");
  const offer = await DispatchOffer.findOne({ driver: driver._id, status: "Pending" })
    .sort({ createdAt: -1 })
    .populate("booking", "bookingId pickupLocation dropLocation travelDate travelTime passengerCount tripType estimatedFare lockedFare commitmentDeadlineAt")
    .populate("driver", "driverId fullName phone user vehicleCategory")
    .populate("vehicle", "vehicleId vehicleNumber name brand model");
  if (offer && offer.expiresAt <= new Date()) {
    // Do not make the driver's polling request wait for the full expiry/
    // redispatch workflow. Mark/redispatch in the background and let the next
    // fast poll pick up the newly-created offer. This keeps the driver UI
    // responsive even when MongoDB is under load.
    expireOffer(offer).catch((error) => {
      console.warn(`[dispatch] Could not advance expired offer ${offer._id}: ${error.message}`);
    });
    return null;
  }
  return offer;
};

const processExpiredOffers = async () => {
  const now = new Date();
  const expired = await DispatchOffer.find({ status: "Pending", expiresAt: { $lte: now } }).limit(50);
  for (const offer of expired) {
    try { await expireOffer(offer); } catch (error) { console.warn(`Dispatch expiry failed: ${error.message}`); }
  }

  // Keep searching for Pending bookings that currently have no live offer.
  // This mirrors a dispatch queue: when a driver becomes available, the
  // system can immediately send the request without admin intervention.
  const pendingBookings = await Booking.find({
    status: "Pending",
    assignedDriver: null,
  }).limit(50);
  for (const booking of pendingBookings) {
    try {
      const activeOffer = await DispatchOffer.exists({ booking: booking._id, status: "Pending" });
      if (!activeOffer) await offerNextDriver(booking._id);
    } catch (error) {
      console.warn(`Dispatch retry failed for ${booking.bookingId}: ${error.message}`);
    }
  }
};

const processCommitmentBreaches = async () => {
  const now = new Date();
  const overdue = await Booking.find({
    status: "Trip Scheduled", assignedDriver: { $ne: null },
    commitmentDeadlineAt: { $lte: now }, rescueTriggeredAt: null,
  }).limit(20);
  for (const booking of overdue) {
    try {
      const oldDriver = booking.assignedDriver;
      const oldVehicle = booking.assignedVehicle;
      const trip = await Trip.findOne({ booking: booking._id, status: "Scheduled" });
      if (trip) { trip.status = "Cancelled"; trip.cancellationReason = "RideGuard commitment timer expired"; await trip.save(); }
      if (oldDriver) await Driver.findByIdAndUpdate(oldDriver, { status: "Available", availability: true, assignedVehicle: null });
      if (oldVehicle) await Vehicle.findByIdAndUpdate(oldVehicle, { status: "Available", availability: true });
      booking.assignedDriver = null; booking.assignedVehicle = null; booking.status = "Pending";
      booking.rescueTriggeredAt = now; booking.rescueCount = Number(booking.rescueCount || 0) + 1;
      booking.driverAcceptedAt = null; booking.commitmentDeadlineAt = null;
      await booking.save();
      await RideGuardIncident.create({ booking: booking._id, trip: trip?._id || null, customer: booking.customer, driver: oldDriver, vehicle: oldVehicle, reportedByRole: "admin", type: "driver_unresponsive", severity: "high", description: "Driver commitment timer expired before pickup movement was confirmed.", lockedFare: booking.lockedFare ?? booking.estimatedFare, status: "Investigating", resolution: "Automatic Auto Rescue activated; booking returned to dispatch queue." });
      await startDispatch(booking._id);
    } catch (error) { console.warn(`RideGuard commitment rescue failed for ${booking.bookingId}: ${error.message}`); }
  }
};

const startDispatchWorker = () => {
  const timer = setInterval(() => {
    processExpiredOffers().catch((error) => console.warn(`Dispatch worker error: ${error.message}`));
    processCommitmentBreaches().catch((error) => console.warn(`Commitment worker error: ${error.message}`));
  }, 1500);
  timer.unref?.();
};

module.exports = {
  OFFER_TIMEOUT_MS,
  startDispatch,
  acceptOffer,
  declineOffer,
  getMyActiveOffer,
  processExpiredOffers,
  processCommitmentBreaches,
  startDispatchWorker,
};
