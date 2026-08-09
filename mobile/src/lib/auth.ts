export type MobileUserRole =
  | "master_admin"
  | "ict_admin"
  | "national_coordinator"
  | "provincial_coordinator"
  | "district_coordinator"
  | "data_collector";

export interface MobileUserProfile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role: MobileUserRole;
  province?: string;
  district?: string;
  is_active: boolean;
  must_change_password?: boolean;
  is_super_admin?: boolean;
}

const USER_KEY = "zim_roads_user";
const TOKEN_KEY = "zim_roads_token";

export function getMobileAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getMobileUser(): MobileUserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMobileAuth(user: MobileUserProfile, token: string) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearMobileAuth() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export async function mobileAuthFetch(apiBase: string, path: string, init: RequestInit = {}) {
  const token = getMobileAuthToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const base = apiBase.replace(/\/$/, "");
  return fetch(`${base}${path}`, { ...init, headers });
}

export async function validateMobileSession(apiBase: string): Promise<MobileUserProfile | null> {
  const token = getMobileAuthToken();
  if (!token) return null;
  try {
    const res = await mobileAuthFetch(apiBase, "/api/auth/me");
    if (!res.ok) {
      clearMobileAuth();
      return null;
    }
    const data = await res.json();
    if (data.success && data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
  } catch {
    return getMobileUser();
  }
  return null;
}

export const MOBILE_ROLE_LABELS: Record<MobileUserRole, string> = {
  master_admin: "Master Admin",
  ict_admin: "ICT Team",
  national_coordinator: "National Coordinator",
  provincial_coordinator: "Provincial Coordinator",
  district_coordinator: "District Coordinator",
  data_collector: "Field Surveyor",
};
