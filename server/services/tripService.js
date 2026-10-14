const Trip = require("../models/trip");
const Booking = require("../models/booking");
const Driver = require("../models/driver");
const Vehicle = require("../models/Vehicle");
const crypto = require("crypto");

const generateTripId = async () => {
    const lastTrip = await Trip.findOne()
        .sort({ createdAt: -1 })
        .select("tripId");

    if (!lastTrip) {
        return "TRP-00001";
    }

    const lastNumber = parseInt(lastTrip.tripId.replace("TRP-", ""), 10);

    return `TRP-${String(lastNumber + 1).padStart(5, "0")}`;
};

const createTripFromBooking = async (bookingId) => {
    const booking = await Booking.findById(bookingId)
        .populate("assignedDriver")
        .populate("assignedVehicle");

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (!booking.assignedDriver || !booking.assignedVehicle) {
        throw new Error("Driver and vehicle must be assigned before creating trip");
    }

    const existingTrip = await Trip.findOne({
        booking: booking._id,
    });

    if (existingTrip) {
        return existingTrip;
    }

    const tripId = await generateTripId();

    const trip = await Trip.create({
        tripId,
        booking: booking._id,
        driver: booking.assignedDriver._id,
        vehicle: booking.assignedVehicle._id,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        scheduledDate: booking.travelDate,
        distanceKm: booking.distanceKm || 0,
        estimatedFare: booking.estimatedFare || 0,
        finalFare: booking.estimatedFare || 0,
        status: "Scheduled",
    });

    return trip;
};

const updateTripStatus = async (trip, newStatus) => {
    const now = new Date();

    const validTransitions = {
        Scheduled: ["Started", "Cancelled"],
        Started: ["Customer Picked Up", "Ongoing", "Cancelled"],
        "Customer Picked Up": ["Ongoing", "Destination Reached"],
        Ongoing: ["Destination Reached"],
        "Destination Reached": ["Completed"],
        Completed: [],
        Cancelled: [],
    };

    const allowed = validTransitions[trip.status] || [];

    if (!allowed.includes(newStatus)) {
        throw new Error(
            `Cannot change trip status from ${trip.status} to ${newStatus}`
        );
    }

    trip.status = newStatus;

    switch (newStatus) {
        case "Started":
            trip.startedAt = now;
            break;

        case "Customer Picked Up":
            trip.pickedUpAt = now;
            break;

        case "Destination Reached":
            trip.destinationReachedAt = now;
            break;

        case "Completed":
            trip.completedAt = now;
            break;

        default:
            break;
    }

    await trip.save();

    return trip;
};

const completeTrip = async (trip) => {
    const booking = await Booking.findById(trip.booking);
    if (!booking) throw new Error("Booking not found");
    if (trip.status !== "Destination Reached") throw new Error("Trip must reach destination before it can be completed");
    if (booking.paymentStatus !== "Paid") throw new Error("Payment must be confirmed before the trip can be completed");
    trip.status = "Completed";
    trip.completedAt = new Date();
    await trip.save();
    booking.status = "Completed";
    booking.estimatedFare = trip.finalFare;
    await booking.save();

    const driver = await Driver.findById(trip.driver);

    if (driver) {
        driver.status = "Available";
        driver.availability = true;
        driver.assignedVehicle = null;

        await driver.save();
    }

    const vehicle = await Vehicle.findById(trip.vehicle);

    if (vehicle) {
        vehicle.status = "Available";
        vehicle.availability = true;

        await vehicle.save();
    }

    return trip;
};

const cancelTrip = async (trip, reason = "") => {
    if (
        trip.status === "Completed" ||
        trip.status === "Cancelled"
    ) {
        throw new Error("Trip cannot be cancelled");
    }

    trip.status = "Cancelled";
    trip.cancellationReason = reason;

    await trip.save();

    const booking = await Booking.findById(trip.booking);

    if (booking) {
        booking.status = "Cancelled";
        booking.cancellationReason = reason;
        await booking.save();
    }

    const driver = await Driver.findById(trip.driver);

    if (driver) {
        driver.status = "Available";
        driver.availability = true;
        driver.assignedVehicle = null;
        await driver.save();
    }

    const vehicle = await Vehicle.findById(trip.vehicle);

    if (vehicle) {
        vehicle.status = "Available";
        vehicle.availability = true;
        await vehicle.save();
    }

    return trip;
};

const otpKey = () => crypto.createHash("sha256").update(String(process.env.JWT_SECRET || "travels-cab-otp")).digest();
const encryptOtp = (code) => { const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv("aes-256-gcm", otpKey(), iv); const encrypted=Buffer.concat([cipher.update(code,"utf8"),cipher.final()]); return [iv.toString("hex"),cipher.getAuthTag().toString("hex"),encrypted.toString("hex")].join(":"); };
const decryptOtp = (payload) => { const [ivHex,tagHex,dataHex]=String(payload||"").split(":"); if(!ivHex||!tagHex||!dataHex) throw new Error("OTP unavailable"); const decipher=crypto.createDecipheriv("aes-256-gcm",otpKey(),Buffer.from(ivHex,"hex")); decipher.setAuthTag(Buffer.from(tagHex,"hex")); return Buffer.concat([decipher.update(Buffer.from(dataHex,"hex")),decipher.final()]).toString("utf8"); };

const generateStartOtp = async (tripId) => {
    const trip = await Trip.findById(tripId).select("+startOtpHash +startOtpCiphertext");
    if (!trip) throw new Error("Trip not found");
    if (trip.status !== "Scheduled") throw new Error("Pickup OTP can only be generated for a scheduled trip");
    if (trip.startOtpExpiresAt && trip.startOtpExpiresAt > new Date() && !trip.startOtpUsedAt && trip.startOtpCiphertext) {
        try {
            const activeCode = decryptOtp(trip.startOtpCiphertext);
            return { trip, code: activeCode, expiresAt: trip.startOtpExpiresAt };
        } catch {
            // Ciphertext stale or corrupt, generate new code
        }
    }
    const code = String(crypto.randomInt(100000, 1000000));
    trip.startOtpHash = crypto.createHash("sha256").update(code).digest("hex");
    trip.startOtpCiphertext = encryptOtp(code);
    trip.startOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    trip.startOtpAttempts = 0;
    trip.startOtpUsedAt = null;
    await trip.save();
    return { trip, code, expiresAt: trip.startOtpExpiresAt };
};

const verifyStartOtp = async (tripId, code) => {
    const trip = await Trip.findById(tripId).select("+startOtpHash");
    if (!trip) throw new Error("Trip not found");
    if (trip.status !== "Scheduled") throw new Error("Trip is not waiting for pickup verification");
    if (!trip.startOtpHash || !trip.startOtpExpiresAt || trip.startOtpUsedAt) throw new Error("Pickup OTP is not active");
    if (trip.startOtpExpiresAt <= new Date()) throw new Error("Pickup OTP has expired");
    if (trip.startOtpAttempts >= 5) throw new Error("Too many incorrect OTP attempts");
    const hash = crypto.createHash("sha256").update(String(code || "")).digest("hex");
    if (hash !== trip.startOtpHash) { trip.startOtpAttempts += 1; await trip.save(); throw new Error("Incorrect pickup OTP"); }
    trip.startOtpUsedAt = new Date(); trip.startOtpHash = null; trip.startOtpCiphertext = null; trip.startOtpExpiresAt = null; trip.startOtpAttempts = 0; await trip.save();
    const updated = await updateTripStatus(trip, "Started");
    await Booking.findByIdAndUpdate(trip.booking, { status: "Ongoing" });
    await Driver.findByIdAndUpdate(trip.driver, { status: "On Trip", availability: false });
    await Vehicle.findByIdAndUpdate(trip.vehicle, { status: "On Trip", availability: false });
    return updated;
};

module.exports = {
    generateTripId,
    createTripFromBooking,
    updateTripStatus,
    completeTrip,
    cancelTrip,
    generateStartOtp,
    verifyStartOtp,
    decryptOtp,
};