import { Capacitor } from "@capacitor/core";

/** Production dashboard URL baked into the APK (Settings → Server URL to change). */
export const DEFAULT_SERVER_URL =
  import.meta.env.VITE_DEFAULT_SERVER_URL ||
  "https://road-condition-survey.vercel.app";

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** localhost / emulator URLs cannot work on a physical phone. */
export function isLocalDevServerUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "10.0.2.2" ||
      host === "[::1]"
    );
  } catch {
    return true;
  }
}

/** Resolve the backend URL, replacing stale localhost values on native devices. */
export function resolveStoredServerUrl(): string {
  const saved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("roads_server_url")
      : null;

  if (Capacitor.isNativePlatform()) {
    if (!saved || isLocalDevServerUrl(saved)) {
      return normalizeServerUrl(DEFAULT_SERVER_URL);
    }
    return normalizeServerUrl(saved);
  }

  if (saved && !isLocalDevServerUrl(saved)) {
    return normalizeServerUrl(saved);
  }

  if (typeof window !== "undefined" && window.location.origin.includes("5173")) {
    return "http://localhost:3002";
  }

  if (typeof window !== "undefined") {
    return normalizeServerUrl(window.location.origin);
  }

  return normalizeServerUrl(DEFAULT_SERVER_URL);
}

/** Persist production URL when a phone still has localhost from dev builds. */
export function ensureNativeServerUrl(): string {
  const resolved = resolveStoredServerUrl();
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("roads_server_url");
    if (Capacitor.isNativePlatform() && saved !== resolved) {
      localStorage.setItem("roads_server_url", resolved);
    }
  }
  return resolved;
}
