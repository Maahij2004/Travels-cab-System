const Booking = require("../models/booking");
const Customer = require("../models/customer");
const VehicleCategory = require("../models/VehicleCategory");
const Vehicle = require("../models/Vehicle");
const Trip = require("../models/trip");
const Coupon = require("../models/Coupon");
const { cancelTrip } = require("../services/tripService");

const {
    calculateDistanceFare,
    calculateHourlyFare,
} = require("../services/fareService");

const Pricing = require("../models/pricing");
const { startDispatch } = require("../services/dispatchService");

// ============================================
// CREATE BOOKING
// ============================================

const createBooking = async (req, res) => {
    try {
        const {
            travelDate,
            travelTime,
            pickupLocation,
            dropLocation,
            pickupLatitude,
            pickupLongitude,
            dropLatitude,
            dropLongitude,
            vehicleCategory,
            passengerCount,
            tripType,
            specialRequirements,
            distanceKm = 0,
            durationHours = 0,
            couponCode,
            bookingForSomeoneElse = false,
            passengerName = "",
            passengerPhone = "",
        } = req.body;

        if (
            !travelDate ||
            !travelTime ||
            !pickupLocation ||
            !dropLocation ||
            !vehicleCategory ||
            !passengerCount ||
            !tripType
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide all required booking details",
            });
        }

        // Find customer profile
        let customer = await Customer.findOne({
            user: req.user._id,
        });

        if (!customer) {
            const count =
                await Customer.countDocuments();

            customer = await Customer.create({
                customerId: `CUS-${String(
                    count + 1
                ).padStart(4, "0")}`,
                user: req.user._id,
                fullName: req.user.name,
                email: req.user.email,
                phone: req.user.phone,
                profileImage:
                    req.user.profileImage || "",
                createdBy: req.user._id,
            });
        }

        // Find category
        const category =
            await VehicleCategory.findOne({
                _id: vehicleCategory,
                isActive: true,
            });

        if (!category) {
            return res.status(404).json({
                success: false,
                message:
                    "Vehicle category not found or inactive",
            });
        }

        // Passenger validation
        if (
            Number(passengerCount) >
            Number(category.seatingCapacity)
        ) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${category.seatingCapacity} passengers allowed for ${category.name}`,
            });
        }

        // Find pricing
        const pricing = await Pricing.findOne({
            vehicleGroup: category.pricingGroup,
            isActive: true,
        }).sort({ effectiveFrom: -1 });

        if (!pricing) {
            return res.status(404).json({
                success: false,
                message:
                    "Pricing configuration not found",
            });
        }

        const numericDistance = Number(distanceKm) || 0;
        const hour = Number(String(travelTime).split(":")[0]);
        const isNight = Number.isFinite(hour) && (hour >= 22 || hour < 6);
        const isAirportTrip = ["airport_pickup", "airport_drop"].includes(tripType);
        let estimatedFare = 0;

        // Hourly fare
        if (tripType === "hourly") {
            if (!durationHours) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Duration hours are required for hourly booking",
                });
            }

            const packages =
                pricing.hourlyPackages
                    .filter((pkg) => pkg.isActive)
                    .sort(
                        (a, b) => a.hours - b.hours
                    );

            let selectedPackage =
                packages.find(
                    (pkg) =>
                        Number(durationHours) <=
                        Number(pkg.hours)
                );

            if (!selectedPackage) {
                selectedPackage =
                    packages[packages.length - 1];
            }

            if (!selectedPackage) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Hourly pricing package not available",
                });
            }

            const result =
                calculateHourlyFare({
                    hours: durationHours,
                    distanceKm,
                    hourlyPackage: selectedPackage,
                });

            const nightCharge = isNight ? Number(pricing.nightCharge || 0) : 0;
            const airportCharge = isAirportTrip ? Number(pricing.airportCharge || 0) : 0;
            estimatedFare = result.finalFare + nightCharge + airportCharge;
            if (pricing.surgeEnabled) estimatedFare *= Number(pricing.surgeMultiplier || 1);
        } else {
            const result =
                calculateDistanceFare({
                    distanceKm,
                    firstKmFare:
                        pricing.firstKmFare,
                    additionalKmFare:
                        pricing.additionalKmFare,
                    minimumFare:
                        pricing.minimumFare,
                });

            const nightCharge = isNight ? Number(pricing.nightCharge || 0) : 0;
            const airportCharge = isAirportTrip ? Number(pricing.airportCharge || 0) : 0;
            estimatedFare = result.fare + nightCharge + airportCharge;
            if (pricing.surgeEnabled) estimatedFare *= Number(pricing.surgeMultiplier || 1);
        }

        // Optional coupon validation and per-customer limit
        let coupon = null;
        let couponDiscount = 0;

        if (couponCode) {
            coupon = await Coupon.findOne({
                code: couponCode.toUpperCase().trim(),
                isActive: true,
            });

            if (!coupon) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid coupon code",
                });
            }

            const now = new Date();

            if (now < coupon.validFrom || now > coupon.validUntil) {
                return res.status(400).json({
                    success: false,
                    message: "Coupon is expired or not active yet",
                });
            }

            if (
                coupon.usageLimit !== null &&
                coupon.usedCount >= coupon.usageLimit
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Coupon usage limit reached",
                });
            }

            if (
                coupon.applicableTripTypes.length > 0 &&
                !coupon.applicableTripTypes.includes(tripType)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Coupon is not applicable to this trip type",
                });
            }

            if (estimatedFare < coupon.minimumFare) {
                return res.status(400).json({
                    success: false,
                    message: `Minimum fare of ₹${coupon.minimumFare} required`,
                });
            }

            const customerCouponUses = await Booking.countDocuments({
                customer: customer._id,
                couponCode: coupon.code,
            });

            if (customerCouponUses >= coupon.perCustomerLimit) {
                return res.status(400).json({
                    success: false,
                    message: "You have reached the usage limit for this coupon",
                });
            }

            if (coupon.discountType === "Percentage") {
                couponDiscount =
                    (estimatedFare * coupon.discountValue) / 100;

                if (
                    coupon.maxDiscount !== null &&
                    couponDiscount > coupon.maxDiscount
                ) {
                    couponDiscount = coupon.maxDiscount;
                }
            } else {
                couponDiscount = coupon.discountValue;
            }

            couponDiscount = Math.min(couponDiscount, estimatedFare);
            estimatedFare = Math.max(
                0,
                estimatedFare - couponDiscount
            );
        }

        if (bookingForSomeoneElse && (!String(passengerName).trim() || !String(passengerPhone).trim())) return res.status(400).json({ success:false, message:"Passenger name and phone are required when booking for someone else" });

        // Generate booking ID
        const count =
            await Booking.countDocuments();

        const bookingId = `BK-${String(
            count + 1
        ).padStart(5, "0")}`;

        const booking = await Booking.create({
            bookingId,
            customer: customer._id,
            bookingForSomeoneElse: Boolean(bookingForSomeoneElse),
            passengerName: bookingForSomeoneElse ? String(passengerName).trim() : customer.fullName,
            passengerPhone: bookingForSomeoneElse ? String(passengerPhone).trim() : customer.phone,
            travelDate,
            travelTime,
            pickupLocation,
            dropLocation,
            pickupLatitude,
            pickupLongitude,
            dropLatitude,
            dropLongitude,
            vehicleCategory,
            passengerCount,
            tripType,
            specialRequirements,
            distanceKm,
            durationHours,
            estimatedFare,
            couponCode: coupon ? coupon.code : null,
            couponDiscount,
            status: "Pending",
        });

        if (coupon) {
            coupon.usedCount += 1;
            await coupon.save();
        }

        // RedTaxi-style dispatch: do NOT reserve a driver immediately.
        // Send the ride request to the nearest eligible available driver,
        // then forward it automatically if the driver declines or times out.
        let dispatchOffer = null;
        try {
            dispatchOffer = await startDispatch(booking._id);
        } catch (dispatchError) {
            console.warn(
                `Automatic dispatch deferred for ${booking.bookingId}: ${dispatchError.message}`
            );
        }

        const result =
            await Booking.findById(booking._id)
                .populate(
                    "customer",
                    "customerId fullName email phone"
                )
                .populate(
                    "vehicleCategory",
                    "name code pricingGroup seatingCapacity"
                );

        res.status(201).json({
            success: true,
            message: dispatchOffer
                ? "Booking created; ride request sent to the nearest eligible driver"
                : "Booking created successfully; searching for an available driver",
            booking: result,
            dispatch: dispatchOffer
                ? {
                      offerId: dispatchOffer._id,
                      driver: dispatchOffer.driver,
                      expiresAt: dispatchOffer.expiresAt,
                      distanceToPickupKm: dispatchOffer.distanceToPickupKm,
                  }
                : null,
        });
    } catch (error) {
        console.error(
            "Create booking error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to create booking",
            error: error.message,
        });
    }
};

// ============================================
// GET ALL BOOKINGS
// ============================================

const getAllBookings = async (req, res) => {
    try {
        const bookings =
            await Booking.find()
                .populate(
                    "customer",
                    "customerId fullName email phone"
                )
                .populate(
                    "vehicleCategory",
                    "name code pricingGroup seatingCapacity"
                )
                .populate(
                    "assignedVehicle",
                    "vehicleId name vehicleNumber brand model"
                )
                .populate(
                    "assignedDriver",
                    "driverId fullName phone"
                )
                .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            bookings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
            error: error.message,
        });
    }
};

// ============================================
// CUSTOMER BOOKINGS
// ============================================

const getMyBookings = async (req, res) => {
    try {
        const customer =
            await Customer.findOne({
                user: req.user._id,
            });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        const bookings =
            await Booking.find({
                customer: customer._id,
            })
                .populate(
                    "vehicleCategory",
                    "name code pricingGroup seatingCapacity"
                )
                .populate(
                    "assignedVehicle",
                    "vehicleId name vehicleNumber brand model"
                )
                .populate(
                    "assignedDriver",
                    "driverId fullName phone"
                )
                .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            bookings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Failed to fetch customer bookings",
            error: error.message,
        });
    }
};

// ============================================
// GET BOOKING BY ID
// ============================================

const getBookingById = async (req, res) => {
    try {
        const booking =
            await Booking.findById(req.params.id)
                .populate(
                    "customer",
                    "customerId fullName email phone"
                )
                .populate(
                    "vehicleCategory",
                    "name code pricingGroup seatingCapacity"
                )
                .populate(
                    "assignedVehicle",
                    "vehicleId name vehicleNumber brand model"
                )
                .populate(
                    "assignedDriver",
                    "driverId fullName phone"
                );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (req.user.role === "customer") {
            const customer = await Customer.findOne({
                user: req.user._id,
            });

            if (
                !customer ||
                booking.customer._id.toString() !== customer._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this booking",
                });
            }
        }

        if (req.user.role === "driver") {
            const driver = await require("../models/driver").findOne({
                user: req.user._id,
            });

            if (
                !driver ||
                !booking.assignedDriver ||
                booking.assignedDriver._id.toString() !== driver._id.toString()
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to view this booking",
                });
            }
        }

        res.status(200).json({
            success: true,
            booking,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch booking",
            error: error.message,
        });
    }
};

// ============================================
// UPDATE BOOKING STATUS
// ============================================

const updateBookingStatus = async (
    req,
    res
) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "Pending",
            "Confirmed",
            "Driver Assigned",
            "Vehicle Assigned",
            "Trip Scheduled",
            "Ongoing",
            "Completed",
            "Cancelled",
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking status",
            });
        }

        const booking =
            await Booking.findById(
                req.params.id
            );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        booking.status = status;

        if (status === "Cancelled") {
            booking.cancellationReason =
                req.body.cancellationReason || "";
        }

        await booking.save();

        res.status(200).json({
            success: true,
            message:
                "Booking status updated successfully",
            booking,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Failed to update booking status",
            error: error.message,
        });
    }
};

// ============================================
// CANCEL CUSTOMER BOOKING
// ============================================

const cancelBooking = async (req, res) => {
    try {
        const customer =
            await Customer.findOne({
                user: req.user._id,
            });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer profile not found",
            });
        }

        const booking =
            await Booking.findOne({
                _id: req.params.id,
                customer: customer._id,
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        if (
            booking.status === "Completed" ||
            booking.status === "Ongoing"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This booking cannot be cancelled",
            });
        }

        const cancellationReason = req.body.reason || "Cancelled by customer";
        await require("../models/DispatchOffer").updateMany({ booking: booking._id, status: "Pending" }, { $set: { status:"Cancelled", respondedAt:new Date(), responseReason:cancellationReason } });

        const trip = await Trip.findOne({
            booking: booking._id,
        });

        if (trip && !["Completed", "Cancelled"].includes(trip.status)) {
            await cancelTrip(trip, cancellationReason);
            booking.status = "Cancelled";
            booking.cancellationReason = cancellationReason;
        } else {
            booking.status = "Cancelled";
            booking.cancellationReason = cancellationReason;

            if (booking.assignedDriver || booking.assignedVehicle) {
                const { releaseAssignment } =
                    require("../services/assignmentService");

                await releaseAssignment(booking._id);
                booking.status = "Cancelled";
                booking.cancellationReason = cancellationReason;
            }

            await booking.save();
        }

        const updatedBooking = await Booking.findById(booking._id)
            .populate("vehicleCategory")
            .populate("assignedDriver")
            .populate("assignedVehicle");

        res.status(200).json({
            success: true,
            message: "Booking cancelled successfully",
            booking: updatedBooking,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                "Failed to cancel booking",
            error: error.message,
        });
    }
};

module.exports = {
    createBooking,
    getAllBookings,
    getMyBookings,
    getBookingById,
    updateBookingStatus,
    cancelBooking,
};