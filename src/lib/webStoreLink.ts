import { ANDROID_STORE_URL, IOS_STORE_URL } from "@/lib/appStoreLinks";

export type WebDevice = "ios" | "android" | "desktop";

/** Which phone the visitor is on, from the browser alone (the native-platform helpers only know about the installed app). */
export function detectWebDevice(userAgent: string, platform = "", maxTouchPoints = 0): WebDevice {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports itself as a Mac; the touch screen gives it away.
  if (platform === "MacIntel" && maxTouchPoints > 1) return "ios";
  return "desktop";
}

/** The store page for a phone visitor; null on a computer, where we show both options instead. */
export function storeUrlFor(device: WebDevice): string | null {
  if (device === "ios") return IOS_STORE_URL;
  if (device === "android") return ANDROID_STORE_URL;
  return null;
}
