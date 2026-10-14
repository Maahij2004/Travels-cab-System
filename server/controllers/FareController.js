const Pricing = require("../models/pricing");
const VehicleCategory = require("../models/VehicleCategory");

const {
    roundDistance,
    calculateDistanceFare,
    calculateHourlyFare,
    applySurge,
} = require("../services/fareService");

const calculateFare = async (req, res) => {
    try {
        const {
            vehicleCategoryId,
            tripType,
            distanceKm = 0,
            hours = 0,
            night = false,
            waitingMinutes = 0,
            airport = false,
            parkingCharge = 0,
            permitCharge = 0,
            tollCharge = 0,
        } = req.body;

        if (!vehicleCategoryId) {
            return res.status(400).json({
                success: false,
                message: "Vehicle category is required",
            });
        }

        if (!tripType) {
            return res.status(400).json({
                success: false,
                message: "Trip type is required",
            });
        }

        const category = await VehicleCategory.findOne({
            _id: vehicleCategoryId,
            isActive: true,
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Vehicle category not found or inactive",
            });
        }

        const pricing = await Pricing.findOne({
            vehicleGroup: category.pricingGroup,
            isActive: true,
        }).sort({ effectiveFrom: -1 });

        if (!pricing) {
            return res.status(404).json({
                success: false,
                message: "Active pricing configuration not found",
            });
        }

        let baseFare = 0;
        let roundedDistance = roundDistance(distanceKm);
        let extraKm = 0;
        let extraHours = 0;
        let hourlyPackage = null;

        // ============================================
        // DISTANCE BASED TRIPS
        // ============================================

        if (tripType !== "hourly") {
            const distanceResult = calculateDistanceFare({
                distanceKm,
                firstKmFare: pricing.firstKmFare,
                additionalKmFare: pricing.additionalKmFare,
                minimumFare: pricing.minimumFare,
            });

            baseFare = distanceResult.fare;
            roundedDistance = distanceResult.distanceKm;

            if (roundedDistance > 1) {
                extraKm = roundedDistance - 1;
            }
        }

        // ============================================
        // HOURLY TRIP
        // ============================================

        if (tripType === "hourly") {
            if (!hours || Number(hours) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Hours are required for hourly trips",
                });
            }

            if (!pricing.hourlyPackages.length) {
                return res.status(400).json({
                    success: false,
                    message: "Hourly packages are not configured",
                });
            }

            // Select the smallest package that covers requested hours.
            // If request exceeds the largest package, use largest package
            // and calculate additional hours.
            hourlyPackage =
                pricing.hourlyPackages
                    .filter((pkg) => pkg.isActive)
                    .sort((a, b) => a.hours - b.hours)
                    .find((pkg) => Number(hours) <= pkg.hours);

            if (!hourlyPackage) {
                hourlyPackage = pricing.hourlyPackages
                    .filter((pkg) => pkg.isActive)
                    .sort((a, b) => b.hours - a.hours)[0];
            }

            if (!hourlyPackage) {
                return res.status(400).json({
                    success: false,
                    message: "No active hourly package available",
                });
            }

            const hourlyResult = calculateHourlyFare({
                hours,
                distanceKm,
                hourlyPackage,
                nightCharge: 0,
                waitingCharge: 0,
                additionalCharges: 0,
            });

            baseFare = hourlyResult.finalFare;
            roundedDistance = hourlyResult.distanceKm;
            extraKm = hourlyResult.extraKm;
            extraHours = hourlyResult.extraHours;
        }

        // ============================================
        // ADDITIONAL CHARGES
        // ============================================

        const nightCharge = night
            ? Number(pricing.nightCharge || 0)
            : 0;

        const waitingCharge =
            Number(waitingMinutes || 0) *
            Number(pricing.waitingChargePerMinute || 0);

        const airportFee = airport
            ? Number(pricing.airportCharge || 0)
            : 0;

        const parkingFee = Number(parkingCharge || 0);
        const permitFee = Number(permitCharge || 0);

        const tollFee =
            pricing.tollHandling === true
                ? Number(tollCharge || 0)
                : 0;

        const additionalCharges =
            nightCharge +
            waitingCharge +
            airportFee +
            parkingFee +
            permitFee +
            tollFee;

        // ============================================
        // SUBTOTAL
        // ============================================

        const subtotal = baseFare + additionalCharges;

        // ============================================
        // SURGE
        // ============================================

        const surgeMultiplier = pricing.surgeEnabled
            ? Number(pricing.surgeMultiplier || 1)
            : 1;

        const finalFare = applySurge(
            subtotal,
            pricing.surgeEnabled,
            surgeMultiplier
        );

        res.status(200).json({
            success: true,

            fare: {
                vehicleCategory: {
                    id: category._id,
                    name: category.name,
                    pricingGroup: category.pricingGroup,
                },

                tripType,

                distanceKm: roundedDistance,

                requestedHours:
                    tripType === "hourly"
                        ? Number(hours)
                        : 0,

                hourlyPackage: hourlyPackage
                    ? {
                        hours: hourlyPackage.hours,
                        includedKm: hourlyPackage.includedKm,
                        packageFare: hourlyPackage.packageFare,
                    }
                    : null,

                baseFare,

                extraKm,
                extraHours,

                charges: {
                    night: nightCharge,
                    waiting: waitingCharge,
                    airport: airportFee,
                    parking: parkingFee,
                    permit: permitFee,
                    toll: tollFee,
                },

                additionalCharges,

                subtotal,

                surge: {
                    enabled: pricing.surgeEnabled,
                    multiplier: surgeMultiplier,
                    amount:
                        finalFare - subtotal,
                },

                finalFare: Math.round(finalFare),

                currency: "INR",
            },
        });
    } catch (error) {
        console.error("Fare calculation error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to calculate fare",
            error: error.message,
        });
    }
};

module.exports = {
    calculateFare,
};