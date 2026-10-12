from pathlib import Path

root=Path('/mnt/data/final_project')

def replace(path, old, new):
    p=root/path; s=p.read_text();
    if old not in s: raise SystemExit(f'MISSING in {path}: {old[:100]}')
    p.write_text(s.replace(old,new))

# Booking model: book-for-someone + destination reached state + fare breakdown snapshot.
replace('server/models/booking.js',
'''        customer: {\n            type: mongoose.Schema.Types.ObjectId,\n            ref: "Customer",\n            required: true,\n        },\n''',
'''        customer: {\n            type: mongoose.Schema.Types.ObjectId,\n            ref: "Customer",\n            required: true,\n        },\n\n        bookingForSomeoneElse: { type: Boolean, default: false },\n        passengerName: { type: String, default: "", trim: true },\n        passengerPhone: { type: String, default: "", trim: true },\n''')
replace('server/models/booking.js',
'''                "Ongoing",\n                "Completed",''',
'''                "Ongoing",\n                "Destination Reached",\n                "Completed",''')

# Trip OTP fields.
replace('server/models/trip.js',
'''        cancellationReason: {\n            type: String,\n            default: "",\n            trim: true,\n        },\n''',
'''        cancellationReason: {\n            type: String,\n            default: "",\n            trim: true,\n        },\n\n        startOtpHash: { type: String, default: null, select: false },\n        startOtpExpiresAt: { type: Date, default: null },\n        startOtpAttempts: { type: Number, default: 0, min: 0 },\n        startOtpUsedAt: { type: Date, default: null },\n''')

# Driver verification fields.
replace('server/models/driver.js',
'''        isActive: {\n            type: Boolean,\n            default: true,\n        },\n''',
'''        isActive: {\n            type: Boolean,\n            default: true,\n        },\n\n        isVerified: {\n            type: Boolean,\n            default: false,\n        },\n''')

# Dispatch: never delete history; prevent concurrent duplicate offers and only verified, licensed drivers.
replace('server/services/dispatchService.js',
'''    const drivers = await Driver.find({\n    availability: true,\n    status: "Available",\n    isActive: true,\n  }).sort({ createdAt: 1 });''',
'''    const today = new Date();\n    const drivers = await Driver.find({\n    availability: true,\n    status: "Available",\n    isActive: true,\n    isVerified: true,\n    licenseExpiry: { $gt: today },\n  }).sort({ createdAt: 1 });''')
replace('server/services/dispatchService.js',
'''const startDispatch = async (bookingId) => {\n  await DispatchOffer.deleteMany({ booking: bookingId, status: { $in: ["Cancelled", "Expired"] } });\n  return offerNextDriver(bookingId);\n};''',
'''const startDispatch = async (bookingId) => {\n  // Keep expired/declined/cancelled history so the same driver is not\n  // immediately re-offered and sequence numbers never collide.\n  return offerNextDriver(bookingId);\n};''')
# Wrap create offer in duplicate retry.
old='''  const lastOffer = await DispatchOffer.findOne({ booking: booking._id }).sort({ sequence: -1 });\n  const sequence = (lastOffer?.sequence || 0) + 1;\n  const offer = await DispatchOffer.create({\n    booking: booking._id,\n    driver: next.driver._id,\n    sequence,\n    expiresAt: new Date(Date.now() + OFFER_TIMEOUT_MS),\n    distanceToPickupKm: Number.isFinite(next.distanceToPickupKm) ? Number(next.distanceToPickupKm.toFixed(2)) : null,\n  });'''
new='''  const lastOffer = await DispatchOffer.findOne({ booking: booking._id }).sort({ sequence: -1 });\n  const sequence = (lastOffer?.sequence || 0) + 1;\n  let offer;\n  try {\n    offer = await DispatchOffer.create({\n      booking: booking._id,\n      driver: next.driver._id,\n      sequence,\n      expiresAt: new Date(Date.now() + OFFER_TIMEOUT_MS),\n      distanceToPickupKm: Number.isFinite(next.distanceToPickupKm) ? Number(next.distanceToPickupKm.toFixed(2)) : null,\n    });\n  } catch (error) {\n    // Multiple worker ticks can race on the same booking. A duplicate-key\n    // write simply means another worker created the offer first; retry using\n    // the newly persisted history instead of failing the dispatch worker.\n    if (error?.code === 11000) return offerNextDriver(booking._id);\n    throw error;\n  }'''
replace('server/services/dispatchService.js',old,new)

# Trip service: completion only after paid; OTP helpers; safer status transitions.
trip_service=root/'server/services/tripService.js'
s=trip_service.read_text()
s=s.replace('''const Vehicle = require("../models/Vehicle");\n''','''const Vehicle = require("../models/Vehicle");\nconst crypto = require("crypto");\n''')
s=s.replace('''    trip.status = newStatus;\n\n    switch (newStatus) {''','''    trip.status = newStatus;\n\n    switch (newStatus) {''')
# Add booking Destination Reached state.
s=s.replace('''    if (status === "Started") {''','''    if (status === "Destination Reached") {\n        await Booking.findByIdAndUpdate(trip.booking, { status: "Destination Reached" });\n    }\n\n    if (status === "Started") {''') if False else s
# Replace completeTrip guard/body start.
old='''const completeTrip = async (trip, finalFare, actualDistanceKm) => {\n    const booking = await Booking.findById(trip.booking);\n\n    if (!booking) {\n        throw new Error("Booking not found");\n    }\n\n    if (trip.status !== "Destination Reached") {\n        throw new Error(\n            "Trip must reach destination before it can be completed"\n        );\n    }\n\n    trip.status = "Completed";\n    trip.completedAt = new Date();\n\n    if (actualDistanceKm !== undefined) {\n        trip.actualDistanceKm = Number(actualDistanceKm);\n    }\n\n    if (finalFare !== undefined) {\n        trip.finalFare = Number(finalFare);\n    }\n\n    await trip.save();\n\n    booking.status = "Completed";\n    booking.paymentStatus = "Pending";\n    booking.estimatedFare = trip.finalFare;\n'''
new='''const completeTrip = async (trip) => {\n    const booking = await Booking.findById(trip.booking);\n\n    if (!booking) throw new Error("Booking not found");\n    if (trip.status !== "Destination Reached") {\n        throw new Error("Trip must reach destination before it can be completed");\n    }\n    if (booking.paymentStatus !== "Paid") {\n        throw new Error("Payment must be confirmed before the trip can be completed");\n    }\n\n    trip.status = "Completed";\n    trip.completedAt = new Date();\n    await trip.save();\n\n    booking.status = "Completed";\n    booking.estimatedFare = trip.finalFare;\n    await booking.save();\n'''
replace('server/services/tripService.js',old,new)
# Add OTP helpers before module exports.
marker='''module.exports = {\n'''
insert='''const generateStartOtp = async (tripId) => {\n    const trip = await Trip.findById(tripId).select("+startOtpHash");\n    if (!trip) throw new Error("Trip not found");\n    if (trip.status !== "Scheduled") throw new Error("Pickup OTP can only be generated for a scheduled trip");\n    if (trip.startOtpExpiresAt && trip.startOtpExpiresAt > new Date() && !trip.startOtpUsedAt) {\n        throw new Error("A valid pickup OTP already exists");\n    }\n    const code = String(crypto.randomInt(100000, 1000000));\n    trip.startOtpHash = crypto.createHash("sha256").update(code).digest("hex");\n    trip.startOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);\n    trip.startOtpAttempts = 0;\n    trip.startOtpUsedAt = null;\n    await trip.save();\n    return { trip, code, expiresAt: trip.startOtpExpiresAt };\n};\n\nconst verifyStartOtp = async (tripId, code) => {\n    const trip = await Trip.findById(tripId).select("+startOtpHash");\n    if (!trip) throw new Error("Trip not found");\n    if (trip.status !== "Scheduled") throw new Error("Trip is not waiting for pickup verification");\n    if (!trip.startOtpHash || !trip.startOtpExpiresAt || trip.startOtpUsedAt) throw new Error("Pickup OTP is not active");\n    if (trip.startOtpExpiresAt <= new Date()) throw new Error("Pickup OTP has expired");\n    if (trip.startOtpAttempts >= 5) throw new Error("Too many incorrect OTP attempts");\n    const hash = crypto.createHash("sha256").update(String(code || "")).digest("hex");\n    if (hash !== trip.startOtpHash) {\n        trip.startOtpAttempts += 1;\n        await trip.save();\n        throw new Error("Incorrect pickup OTP");\n    }\n    trip.startOtpUsedAt = new Date();\n    trip.startOtpHash = null;\n    trip.startOtpExpiresAt = null;\n    trip.startOtpAttempts = 0;\n    await trip.save();\n    const updated = await updateTripStatus(trip, "Started");\n    await Booking.findByIdAndUpdate(trip.booking, { status: "Ongoing" });\n    await Driver.findByIdAndUpdate(trip.driver, { status: "On Trip", availability: false });\n    await Vehicle.findByIdAndUpdate(trip.vehicle, { status: "On Trip", availability: false });\n    return updated;\n};\n\n'''
trip_service.write_text(s.replace(marker,insert+marker))
replace('server/services/tripService.js',
'''    completeTrip,\n    cancelTrip,\n};''',
'''    completeTrip,\n    cancelTrip,\n    generateStartOtp,\n    verifyStartOtp,\n};''')

# Trip controller imports and logic.
replace('server/controllers/tripController.js',
'''    cancelTrip,\n} = require("../services/tripService");''',
'''    cancelTrip,\n    generateStartOtp,\n    verifyStartOtp,\n} = require("../services/tripService");\nconst { startDispatch } = require("../services/dispatchService");''')
# Completed call signature and destination status booking.
replace('server/controllers/tripController.js',
'''        if (status === "Completed") {\n            const updatedTrip = await completeTrip(\n                trip,\n                req.body.finalFare,\n                req.body.actualDistanceKm\n            );''',
'''        if (status === "Completed") {\n            const updatedTrip = await completeTrip(trip);''')
replace('server/controllers/tripController.js',
'''        if (status === "Started" ||\n            status === "Customer Picked Up" ||\n            status === "Ongoing"\n        ) {\n            await Booking.findByIdAndUpdate(trip.booking, {\n                status: "Ongoing",\n            });\n        }''',
'''        if (status === "Started" ||\n            status === "Customer Picked Up" ||\n            status === "Ongoing"\n        ) {\n            await Booking.findByIdAndUpdate(trip.booking, { status: "Ongoing" });\n        }\n\n        if (status === "Destination Reached") {\n            await Booking.findByIdAndUpdate(trip.booking, { status: "Destination Reached" });\n        }''')
# Insert OTP and driver cancellation routes handlers before module exports.
marker='''module.exports = {\n'''
insert='''const generatePickupOtp = async (req, res) => {\n    try {\n        const trip = await Trip.findById(req.params.id);\n        const driver = await Driver.findOne({ user: req.user._id });\n        if (!trip || !driver || String(trip.driver) !== String(driver._id)) return res.status(403).json({ success:false, message:"You are not assigned to this trip" });\n        const result = await generateStartOtp(trip._id);\n        const customer = await Customer.findOne({ _id: (await Booking.findById(trip.booking)).customer }).populate("user", "_id");\n        if (customer?.user?._id) {\n            const { createNotification } = require("../services/notificationService");\n            await createNotification({ recipient: customer.user._id, title:"Pickup OTP ready", message:`Your pickup OTP is ${result.code}. Share it with your driver only when the driver arrives.`, type:"Trip", booking:trip.booking, trip:trip._id });\n        }\n        res.json({ success:true, message:"Pickup OTP generated", otp:result.code, expiresAt:result.expiresAt });\n    } catch (error) { res.status(400).json({ success:false, message:error.message }); }\n};\n\nconst verifyPickupOtp = async (req, res) => {\n    try {\n        const trip = await Trip.findById(req.params.id);\n        const driver = await Driver.findOne({ user: req.user._id });\n        if (!trip || !driver || String(trip.driver) !== String(driver._id)) return res.status(403).json({ success:false, message:"You are not assigned to this trip" });\n        if (!/^\\d{6}$/.test(String(req.body.otp || ""))) return res.status(400).json({ success:false, message:"Enter the 6-digit pickup OTP" });\n        const updatedTrip = await verifyStartOtp(trip._id, req.body.otp);\n        res.json({ success:true, message:"OTP verified. Trip started.", trip:updatedTrip });\n    } catch (error) { res.status(400).json({ success:false, message:error.message }); }\n};\n\nconst cancelDriverTrip = async (req, res) => {\n    try {\n        const trip = await Trip.findById(req.params.id);\n        const driver = await Driver.findOne({ user: req.user._id });\n        if (!trip || !driver || String(trip.driver) !== String(driver._id)) return res.status(403).json({ success:false, message:"You are not assigned to this trip" });\n        if (["Completed","Cancelled","Destination Reached"].includes(trip.status)) return res.status(400).json({ success:false, message:"This trip cannot be cancelled now" });\n        const reason = req.body.reason || "Driver cancelled before pickup";\n        await cancelTrip(trip, reason);\n        const booking = await Booking.findById(trip.booking);\n        if (booking) {\n            booking.assignedDriver = null;\n            booking.assignedVehicle = null;\n            booking.status = "Pending";\n            booking.cancellationReason = "";\n            await booking.save();\n            try { await startDispatch(booking._id); } catch (dispatchError) { console.warn(`Re-dispatch failed: ${dispatchError.message}`); }\n        }\n        res.json({ success:true, message:"Trip cancelled and the system is searching for another nearby driver.", trip });\n    } catch (error) { res.status(400).json({ success:false, message:error.message }); }\n};\n\n'''
replace('server/controllers/tripController.js',marker,insert+marker)
replace('server/controllers/tripController.js',
'''    changeTripStatus,\n};''',
'''    changeTripStatus,\n    generatePickupOtp,\n    verifyPickupOtp,\n    cancelDriverTrip,\n};''')

# Trip routes.
replace('server/routes/tripRoutes.js',
'''    changeTripStatus,\n} = require("../controllers/tripController");''',
'''    changeTripStatus,\n    generatePickupOtp,\n    verifyPickupOtp,\n    cancelDriverTrip,\n} = require("../controllers/tripController");''')
replace('server/routes/tripRoutes.js',
'''// Update trip status\nrouter.patch(''',
'''// Driver pickup OTP flow\nrouter.post(\n    "/:id/pickup-otp",\n    protect,\n    authorizeRoles("driver"),\n    generatePickupOtp\n);\n\nrouter.post(\n    "/:id/verify-pickup-otp",\n    protect,\n    authorizeRoles("driver"),\n    verifyPickupOtp\n);\n\nrouter.post(\n    "/:id/driver-cancel",\n    protect,\n    authorizeRoles("driver"),\n    cancelDriverTrip\n);\n\n// Update trip status\nrouter.patch(''')

# Payment service: mark paid => complete trip; customer cannot complete directly.
ps=root/'server/services/paymentService.js'; s=ps.read_text()
s=s.replace('''const generateInvoiceNumber = async () => {''','''const finalizePaidTrip = async (payment) => {\n    const trip = await Trip.findById(payment.trip);\n    if (!trip) throw new Error("Trip not found");\n    if (trip.status !== "Destination Reached") throw new Error("Trip must reach destination before payment is finalized");\n    const booking = await Booking.findById(payment.booking);\n    if (!booking) throw new Error("Booking not found");\n    booking.paymentStatus = "Paid";\n    await booking.save();\n    trip.status = "Completed";\n    trip.completedAt = new Date();\n    await trip.save();\n    const driver = await require("../models/driver").findById(trip.driver);\n    if (driver) { driver.status="Available"; driver.availability=true; driver.assignedVehicle=null; await driver.save(); }\n    const vehicle = await require("../models/Vehicle").findById(trip.vehicle);\n    if (vehicle) { vehicle.status="Available"; vehicle.availability=true; await vehicle.save(); }\n    return trip;\n};\n\nconst generateInvoiceNumber = async () => {''')
# after payment.save in verify and cash, invoke finalize before invoice.
s=s.replace('''    await payment.save();\n\n    await Booking.findByIdAndUpdate(\n        payment.booking,\n        {\n            paymentStatus: "Paid",\n        }\n    );\n\n    const invoice = await generateInvoice(payment);''','''    await payment.save();\n\n    await finalizePaidTrip(payment);\n    const invoice = await generateInvoice(payment);''',1)
# replace mark cash function entirely by safer one
start=s.index('const markCashPaymentPaid = async (paymentId) => {')
end=s.index('\n/*\n|--------------------------------------------------------------------------\n| Generate Invoice', start)
newcash='''const markCashPaymentPaid = async (paymentId, driverId) => {\n    const payment = await Payment.findById(paymentId);\n    if (!payment) throw new Error("Payment not found");\n    if (payment.method !== "Cash") throw new Error("Only cash payments can be confirmed manually");\n    if (payment.status === "Paid") throw new Error("Payment is already marked as paid");\n    const trip = await Trip.findById(payment.trip);\n    if (!trip || trip.status !== "Destination Reached") throw new Error("Cash can only be confirmed after destination is reached");\n    if (driverId && String(trip.driver) !== String(driverId)) throw new Error("Only the assigned driver can confirm this cash payment");\n    payment.status = "Paid";\n    payment.paidAt = new Date();\n    await payment.save();\n    await finalizePaidTrip(payment);\n    const invoice = await generateInvoice(payment);\n    return { payment, invoice };\n};\n'''
s=s[:start]+newcash+s[end:]
# refund booking status remains; export finalize
s=s.replace('''    refundPayment,\n};''','''    refundPayment,\n    finalizePaidTrip,\n};''')
ps.write_text(s)

# Payment controller/routes: allow customer payment only at destination, driver cash confirm.
replace('server/controllers/paymentController.js',
'''    refundPayment,\n} = require("../services/paymentService");''',
'''    refundPayment,\n} = require("../services/paymentService");\nconst Driver = require("../models/driver");''')
replace('server/controllers/paymentController.js',
'''        if (trip.status !== "Completed") {\n            return res.status(400).json({\n                success: false,\n                message: "Payment can be made after trip completion",\n            });\n        }''',
'''        if (trip.status !== "Destination Reached") {\n            return res.status(400).json({ success:false, message:"Payment can be made after the destination is reached" });\n        }\n\n        const existingPayment = await Payment.findOne({ trip: trip._id, status: { $in: ["Pending", "Paid"] } });\n        if (existingPayment) {\n            return res.status(200).json({ success:true, message:"A payment record already exists for this trip", payment:existingPayment });\n        }''')
# add driver cash confirmation handler before module exports
marker='''module.exports = {\n'''
insert='''const confirmCashByDriver = async (req, res) => {\n    try {\n        const driver = await Driver.findOne({ user: req.user._id, isActive: true });\n        if (!driver) return res.status(404).json({ success:false, message:"Driver profile not found" });\n        const result = await markCashPaymentPaid(req.params.id, driver._id);\n        res.json({ success:true, message:"Cash payment confirmed. Trip completed and invoice generated.", payment:result.payment, invoice:result.invoice });\n    } catch (error) { res.status(400).json({ success:false, message:error.message }); }\n};\n\n'''
replace('server/controllers/paymentController.js',marker,insert+marker)
replace('server/controllers/paymentController.js',
'''    refund,\n};''',
'''    refund,\n    confirmCashByDriver,\n};''')
replace('server/routes/paymentRoutes.js',
'''    refund,\n} = require("../controllers/paymentController");''',
'''    refund,\n    confirmCashByDriver,\n} = require("../controllers/paymentController");''')
replace('server/routes/paymentRoutes.js',
'''// Customer payment history\nrouter.get(''',
'''// Assigned driver confirms exact cash received from customer. Amount is always\n// the system-generated payment amount; the driver cannot edit it.\nrouter.patch(\n    "/:id/confirm-cash",\n    protect,\n    authorizeRoles("driver"),\n    confirmCashByDriver\n);\n\n// Customer payment history\nrouter.get(''')

# Customer booking controller: passenger fields, automatic fare extras, booking for someone else.
replace('server/controllers/bookingController.js',
'''            couponCode,\n        } = req.body;''',
'''            couponCode,\n            bookingForSomeoneElse = false,\n            passengerName = "",\n            passengerPhone = "",\n        } = req.body;''')
replace('server/controllers/bookingController.js',
'''        let estimatedFare = 0;''',
'''        const numericDistance = Number(distanceKm) || 0;\n        const hour = Number(String(travelTime).split(":")[0]);\n        const isNight = Number.isFinite(hour) && (hour >= 22 || hour < 6);\n        const isAirportTrip = ["airport_pickup", "airport_drop"].includes(tripType);\n        let estimatedFare = 0;''')
# Replace distance fare block and hourly call with extras/surge.
old='''            const result =\n                calculateDistanceFare({\n                    distanceKm,\n                    firstKmFare:\n                        pricing.firstKmFare,\n                    additionalKmFare:\n                        pricing.additionalKmFare,\n                    minimumFare:\n                        pricing.minimumFare,\n                });\n\n            estimatedFare = result.fare;'''
new='''            const result = calculateDistanceFare({ distanceKm:numericDistance, firstKmFare:pricing.firstKmFare, additionalKmFare:pricing.additionalKmFare, minimumFare:pricing.minimumFare });\n            const nightCharge = isNight ? Number(pricing.nightCharge || 0) : 0;\n            const airportCharge = isAirportTrip ? Number(pricing.airportCharge || 0) : 0;\n            estimatedFare = result.fare + nightCharge + airportCharge;\n            if (pricing.surgeEnabled) estimatedFare *= Number(pricing.surgeMultiplier || 1);'''
replace('server/controllers/bookingController.js',old,new)
# Hourly result currently no night/airport; add extras before assignment.
replace('server/controllers/bookingController.js',
'''            estimatedFare = result.finalFare;\n        } else {''',
'''            const nightCharge = isNight ? Number(pricing.nightCharge || 0) : 0;\n            const airportCharge = isAirportTrip ? Number(pricing.airportCharge || 0) : 0;\n            estimatedFare = result.finalFare + nightCharge + airportCharge;\n            if (pricing.surgeEnabled) estimatedFare *= Number(pricing.surgeMultiplier || 1);\n        } else {''')
# Validation for book-for-someone else.
replace('server/controllers/bookingController.js',
'''        // Generate booking ID\n        const count =''',
'''        if (bookingForSomeoneElse && (!String(passengerName).trim() || !String(passengerPhone).trim())) {\n            return res.status(400).json({ success:false, message:"Passenger name and phone are required when booking for someone else" });\n        }\n\n        // Generate booking ID\n        const count =''')
replace('server/controllers/bookingController.js',
'''            customer: customer._id,\n            travelDate,''',
'''            customer: customer._id,\n            bookingForSomeoneElse: Boolean(bookingForSomeoneElse),\n            passengerName: bookingForSomeoneElse ? String(passengerName).trim() : customer.fullName,\n            passengerPhone: bookingForSomeoneElse ? String(passengerPhone).trim() : customer.phone,\n            travelDate,''')
# cancellation should cancel pending dispatch offers.
replace('server/controllers/bookingController.js',
'''        const cancellationReason =\n            req.body.reason || "Cancelled by customer";\n''',
'''        const cancellationReason = req.body.reason || "Cancelled by customer";\n        await require("../models/DispatchOffer").updateMany({ booking: booking._id, status: "Pending" }, { $set: { status:"Cancelled", respondedAt:new Date(), responseReason:cancellationReason } });\n''')

# Driver eligibility endpoints also verify.
replace('server/controllers/DriverController.js',
'''            availability: true,\n            status: "Available",\n            isActive: true,''',
'''            availability: true,\n            status: "Available",\n            isActive: true,\n            isVerified: true,\n            licenseExpiry: { $gt: new Date() },''')

# Update .env example for OTP encryption note not needed; add build scripts verification later.

print('patched')
