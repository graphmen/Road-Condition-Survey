import { Capacitor } from "@capacitor/core";
import { KeepAwake } from "@capacitor-community/keep-awake";

let webWakeLock: WakeLockSentinel | null = null;
let active = false;

/** Keep the device screen on while segment GPS recording is active. */
export async function enableScreenAwake(): Promise<void> {
  if (active) return;
  active = true;

  if (Capacitor.isNativePlatform()) {
    try {
      const { isSupported } = await KeepAwake.isSupported();
      if (isSupported) {
        await KeepAwake.keepAwake();
      }
    } catch (e) {
      console.warn("KeepAwake.enable failed:", e);
    }
    return;
  }

  try {
    if ("wakeLock" in navigator) {
      webWakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) {
    console.warn("Screen Wake Lock unavailable:", e);
  }
}

/** Allow the screen to sleep again after recording stops. */
export async function disableScreenAwake(): Promise<void> {
  if (!active) return;
  active = false;

  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.allowSleep();
    } catch (e) {
      console.warn("KeepAwake.disable failed:", e);
    }
    return;
  }

  try {
    if (webWakeLock) {
      await webWakeLock.release();
      webWakeLock = null;
    }
  } catch (e) {
    console.warn("Screen Wake Lock release failed:", e);
  }
}
