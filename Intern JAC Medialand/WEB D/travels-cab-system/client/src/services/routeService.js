import { computeDrivingRoute, isMapsConfigured as mapsConfigured } from "./mapsService";

export const isMapsConfigured = mapsConfigured;

export const getRoadDistanceKm = async (pickup, destination) => {
  if (!pickup || !destination) return null;
  if (pickup.lat && pickup.lng && destination.lat && destination.lng) return computeDrivingRoute(pickup, destination);
  throw new Error("Select exact pickup and destination locations from the free map suggestions.");
};
