import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running on a native iOS platform
 */
export function isNativeIOS(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * Check if the app is running on a native Android platform
 */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Check if the app is running on any native platform (iOS or Android)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if the app is running in a web browser
 */
export function isWebPlatform(): boolean {
  return !Capacitor.isNativePlatform();
}

/**
 * Get the current platform name
 */
export function getPlatformName(): 'ios' | 'android' | 'web' {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() as 'ios' | 'android';
  }
  return 'web';
}

/**
 * Check if Apple In-App Purchases should be used
 * Returns true only on native iOS
 */
export function shouldUseAppleIAP(): boolean {
  return isNativeIOS();
}

/**
 * Check if Stripe should be used for payments
 * Returns true on web and Android (for now)
 */
export function shouldUseStripe(): boolean {
  return isWebPlatform() || isNativeAndroid();
}
