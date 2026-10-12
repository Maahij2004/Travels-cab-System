const Booking = require("../models/booking");
const Driver = require("../models/driver");
const DriverLocation = require("../models/DriverLocation");
const Vehicle = require("../models/Vehicle");
const DispatchOffer = require("../models/DispatchOffer");
const Trip = require("../models/trip");
const { createTripFromBooking } = require("./tripService");
const { createNotification } = require("./notificationService");
const { randomUUID } = require("crypto");

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
  const vehicleIds = await Vehicle.find({
    category: booking.vehicleCategory,
    availability: true,
    status: "Available",
    seatingCapacity: { $gte: booking.passengerCount },
  }).distinct("_id");

  if (!vehicleIds.length) {
    warnDispatchBlocked(booking, "No available vehicle matches the selected category and passenger count.");
    return [];
  }

  const drivers = await Driver.find({
    availability: true,
    status: "Available",
    isActive: true,
    $or: [{ isVerified: true }, { isVerified: { $exists: false } }],
    licenseExpiry: { $gt: new Date() },
  }).sort({ createdAt: 1 });

  if (!drivers.length) {
    warnDispatchBlocked(booking, "No active, available, verified driver with a valid licence is eligible. GPS is not required to receive an offer.");
    return [];
  }

  // GPS is used only to rank drivers by proximity. A missing/stale GPS fix must
  // never exclude an otherwise eligible driver from receiving a ride offer.
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
    const aHasLocation = Number.isFinite(a.distanceToPickupKm);
    const bHasLocation = Number.isFinite(b.distanceToPickupKm);
    if (aHasLocation !== bHasLocation) return aHasLocation ? -1 : 1;
    return a.distanceToPickupKm - b.distanceToPickupKm ||
      new Date(a.driver.createdAt || 0) - new Date(b.driver.createdAt || 0);
  });
  return scored;
};

const cancelPendingOffers = async (bookingId, exceptId = null) => {
  const query = { booking: bookingId, status: "Pending" };
  if (exceptId) query._id = { $ne: exceptId };
  await DispatchOffer.updateMany(query, {
    $set: { status: "Cancelled", respondedAt: new Date(), responseReason: "Another driver was selected" },
  });
};

const populateDispatchOffer = (query) => query
  .populate("booking", "bookingId pickupLocation dropLocation travelDate travelTime passengerCount tripType estimatedFare")
  .populate("driver", "driverId fullName phone")
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
  const driver = await Driver.findOne({ _id: offer.driver, user: driverUserId, isActive: true });
  if (!driver) throw new Error("Ride request is not assigned to this driver");
  if (offer.status !== "Pending") throw new Error("This ride request is no longer available");
  if (offer.expiresAt <= new Date()) {
    await expireOffer(offer);
    throw new Error("Ride request expired");
  }

  const booking = await Booking.findById(offer.booking._id);
  if (!booking || booking.status === "Cancelled" || booking.assignedDriver) throw new Error("Booking is no longer available");
  if (!driver.availability || driver.status !== "Available") throw new Error("Driver is no longer available");

  const vehicle = await Vehicle.findOne({
    category: booking.vehicleCategory,
    availability: true,
    status: "Available",
    seatingCapacity: { $gte: booking.passengerCount },
  }).sort({ createdAt: 1 });
  if (!vehicle) throw new Error("No suitable vehicle is available for this ride");

  await cancelPendingOffers(booking._id, offer._id);

  vehicle.status = "Assigned";
  vehicle.availability = false;
  await vehicle.save();

  driver.status = "Assigned";
  driver.availability = false;
  driver.assignedVehicle = vehicle._id;
  await driver.save();

  booking.assignedDriver = driver._id;
  booking.assignedVehicle = vehicle._id;
  booking.status = "Trip Scheduled";
  await booking.save();

  let trip;
  try {
    trip = await createTripFromBooking(booking._id);
  } catch (error) {
    vehicle.status = "Available";
    vehicle.availability = true;
    await vehicle.save();
    driver.status = "Available";
    driver.availability = true;
    driver.assignedVehicle = null;
    await driver.save();
    booking.assignedDriver = null;
    booking.assignedVehicle = null;
    booking.status = "Pending";
    await booking.save();
    throw error;
  }

  offer.status = "Accepted";
  offer.vehicle = vehicle._id;
  offer.respondedAt = new Date();
  await offer.save();

  const customerUserId = (await require("../models/customer").findById(booking.customer).populate("user", "_id"))?.user?._id;
  if (customerUserId) {
    await createNotification({
      recipient: customerUserId,
      title: "Driver confirmed",
      message: `${driver.fullName} accepted ${booking.bookingId}. Your ${vehicle.vehicleNumber} is scheduled for pickup.`,
      type: "Assignment",
      booking: booking._id,
      trip: trip._id,
    });
  }
  await createNotification({
    recipient: driver.user,
    title: "Ride accepted",
    message: `${booking.bookingId} is now assigned to you. Navigate to the pickup location.`,
    type: "Assignment",
    booking: booking._id,
    trip: trip._id,
  });

  return { offer, booking, driver, vehicle, trip };
};

const expireOffer = async (offer) => {
  if (offer.status !== "Pending") return null;
  offer.status = "Expired";
  offer.respondedAt = new Date();
  offer.responseReason = "Driver did not respond before the timer ended";
  await offer.save();
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

  return offerNextDriver(offer.booking._id);
};

const getMyActiveOffer = async (driverUserId) => {
  const driver = await Driver.findOne({ user: driverUserId, isActive: true });
  if (!driver) throw new Error("Driver profile not found");
  const offer = await DispatchOffer.findOne({ driver: driver._id, status: "Pending" })
    .sort({ createdAt: -1 })
    .populate("booking", "bookingId pickupLocation dropLocation travelDate travelTime passengerCount tripType estimatedFare")
    .populate("driver", "driverId fullName phone")
    .populate("vehicle", "vehicleId vehicleNumber name brand model");
  if (offer && offer.expiresAt <= new Date()) {
    const nextOffer = await expireOffer(offer);
    return nextOffer || null;
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

const startDispatchWorker = () => {
  const timer = setInterval(() => { processExpiredOffers().catch((error) => console.warn(`Dispatch worker error: ${error.message}`)); }, 5000);
  timer.unref?.();
};

module.exports = {
  OFFER_TIMEOUT_MS,
  startDispatch,
  acceptOffer,
  declineOffer,
  getMyActiveOffer,
  processExpiredOffers,
  startDispatchWorker,
};
