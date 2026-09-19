import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export const IOS_STORE_URL = "https://apps.apple.com/app/id6757654586";
export const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.shakebyleo.app";

export async function openAppStore(): Promise<void> {
  const url = Capacitor.getPlatform() === "android" ? ANDROID_STORE_URL : IOS_STORE_URL;
  try {
    await Browser.open({ url });
  } catch {
    window.open(url, "_blank");
  }
}
