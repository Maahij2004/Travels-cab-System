// ========================================
// FARE SERVICE
// ========================================

const roundDistance = (distanceKm) => {
  return Math.ceil(Math.max(0, Number(distanceKm) || 0));
};

// ========================================
// DISTANCE FARE
// ========================================

const calculateDistanceFare = ({
  distanceKm,
  firstKmFare,
  additionalKmFare,
  minimumFare = 0,
}) => {
  const distance = roundDistance(distanceKm);

  let fare = Number(firstKmFare) || 0;

  if (distance > 1) {
    fare +=
      (distance - 1) *
      (Number(additionalKmFare) || 0);
  }

  fare = Math.max(
    fare,
    Number(minimumFare) || 0
  );

  return {
    distanceKm: distance,
    fare,
  };
};

// ========================================
// HOURLY FARE
// ========================================

const calculateHourlyFare = ({
  hours,
  distanceKm,
  hourlyPackage,
  nightCharge = 0,
  waitingCharge = 0,
  additionalCharges = 0,
}) => {
  if (!hourlyPackage) {
    throw new Error("Hourly pricing package not found");
  }

  const actualHours = Number(hours) || 0;
  const actualDistance = roundDistance(distanceKm);

  let fare = Number(hourlyPackage.packageFare) || 0;

  // Extra KM
  let extraKm = 0;

  if (
    actualDistance >
    Number(hourlyPackage.includedKm)
  ) {
    extraKm =
      actualDistance -
      Number(hourlyPackage.includedKm);

    fare +=
      extraKm *
      Number(hourlyPackage.extraKmFare);
  }

  // Extra hours
  let extraHours = 0;

  if (
    actualHours >
    Number(hourlyPackage.hours)
  ) {
    extraHours =
      Math.ceil(
        actualHours -
        Number(hourlyPackage.hours)
      );

    fare +=
      extraHours *
      Number(hourlyPackage.extraHourFare);
  }

  fare += Number(nightCharge) || 0;
  fare += Number(waitingCharge) || 0;
  fare += Number(additionalCharges) || 0;

  return {
    hours: actualHours,
    distanceKm: actualDistance,
    includedKm: hourlyPackage.includedKm,
    extraKm,
    extraHours,
    baseFare: hourlyPackage.packageFare,
    finalFare: fare,
  };
};

// ========================================
// ADDITIONAL CHARGES
// ========================================

const calculateAdditionalCharges = ({
  nightCharge = 0,
  waitingCharge = 0,
  airportCharge = 0,
  parkingCharge = 0,
  permitCharge = 0,
  tollCharge = 0,
}) => {
  return (
    Number(nightCharge) +
    Number(waitingCharge) +
    Number(airportCharge) +
    Number(parkingCharge) +
    Number(permitCharge) +
    Number(tollCharge)
  );
};

// ========================================
// SURGE
// ========================================

const applySurge = (
  fare,
  surgeEnabled,
  surgeMultiplier = 1
) => {
  if (!surgeEnabled) {
    return fare;
  }

  return fare * Number(surgeMultiplier);
};

module.exports = {
  roundDistance,
  calculateDistanceFare,
  calculateHourlyFare,
  calculateAdditionalCharges,
  applySurge,
};