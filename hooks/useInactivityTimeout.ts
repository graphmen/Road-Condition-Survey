"use client";

import { useEffect, useRef, useCallback } from "react";

const INACTIVITY_STORAGE_KEY = "zim_roads_last_activity";
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const THROTTLE_MS = 10 * 1000; // Throttle activity updates to once every 10 seconds

interface UseInactivityTimeoutOptions {
  enabled: boolean;
  timeoutMs?: number;
  onTimeout: () => void;
}

export function useInactivityTimeout({
  enabled,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onTimeout,
}: UseInactivityTimeoutOptions) {
  const lastActivityRef = useRef<number>(Date.now());
  const lastSaveRef = useRef<number>(0);
  const onTimeoutRef = useRef(onTimeout);

  // Keep latest onTimeout ref updated
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Throttle writing to localStorage to prevent excessive storage writes
    if (now - lastSaveRef.current > THROTTLE_MS) {
      try {
        localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
        lastSaveRef.current = now;
      } catch (_) {}
    }
  }, []);

  const checkInactivity = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    let lastActive = lastActivityRef.current;

    // Check stored timestamp from localStorage (sync across tabs/windows)
    try {
      const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > lastActive) {
          lastActive = parsed;
          lastActivityRef.current = parsed;
        }
      }
    } catch (_) {}

    if (now - lastActive >= timeoutMs) {
      onTimeoutRef.current();
    }
  }, [enabled, timeoutMs]);

  useEffect(() => {
    if (!enabled) return;

    // Initialize/sync timestamp on mount or when enabled
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      const stored = localStorage.getItem(INACTIVITY_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) {
          // If already timed out while tab was closed/inactive, fire immediately
          if (now - parsed >= timeoutMs) {
            onTimeoutRef.current();
            return;
          }
          lastActivityRef.current = Math.max(parsed, now);
        }
      } else {
        localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
      }
    } catch (_) {}

    // Events to monitor user activity
    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    const handleUserActivity = () => {
      updateLastActivity();
    };

    // Attach passive listeners for smooth performance
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Handle tab visibility change & focus
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    // Periodic check timer every 10 seconds
    const checkInterval = setInterval(checkInactivity, 10000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      clearInterval(checkInterval);
    };
  }, [enabled, timeoutMs, updateLastActivity, checkInactivity]);

  return { resetActivity: updateLastActivity };
}

export function setInactivityTimestamp() {
  try {
    const now = Date.now();
    localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
  } catch (_) {}
}

export function clearInactivityTimestamp() {
  try {
    localStorage.removeItem(INACTIVITY_STORAGE_KEY);
  } catch (_) {}
}
