/** Shared high-precision GPS options for point + line surveys. */
export const HIGH_PRECISION_BG_OPTIONS = {
  stale: false as const,
  distanceFilter: 0,
};

export const GPS_ACCURACY_TARGET_M = 3.0;

/** Capacitor / browser getCurrentPosition options for high precision. */
export const HIGH_PRECISION_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 60000,
  maximumAge: 0,
};
