import { env } from "../config/env.js";

const toRadians = (degree: number) => (degree * Math.PI) / 180;

export const distanceMeters = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isInsideInstitutionBoundary = (coords?: { latitude?: number; longitude?: number }) => {
  if (coords?.latitude === undefined || coords.longitude === undefined) return false;
  const distance = distanceMeters(
    { latitude: coords.latitude, longitude: coords.longitude },
    { latitude: env.GEOFENCE_LATITUDE, longitude: env.GEOFENCE_LONGITUDE }
  );
  return distance <= env.GEOFENCE_RADIUS_METERS;
};
