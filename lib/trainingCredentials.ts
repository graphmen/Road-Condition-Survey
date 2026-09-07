/** Shared training login — web dashboard + mobile app (Level 2 venues). */
export const TRAINING_EMAIL = "training@transport.gov.zw";
export const TRAINING_USERNAME = "training";
export const TRAINING_PASSWORD = "Training@ZimRoads2026!";

/** Default dashboard/API base when APK is installed (override in app Settings if needed). */
export const DEFAULT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://road-condition-survey.vercel.app");

export const TRAINING_USER_PROFILE = {
  id: "usr-training-1",
  email: TRAINING_EMAIL,
  full_name: "MOTID Training Account",
  phone_number: "+263 77 000 0000",
  role: "provincial_coordinator" as const,
  province: "National",
  is_active: true,
  must_change_password: false,
  is_training_account: true,
};
