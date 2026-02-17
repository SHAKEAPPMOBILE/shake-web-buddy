import { Capacitor } from '@capacitor/core';

// RevenueCat initialization
export async function initializeRevenueCat() {
  if (!Capacitor.isNativePlatform()) {
    console.log('RevenueCat: Skipping initialization on web');
    return;
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    
    const apiKey = Capacitor.getPlatform() === 'ios'
      ? 'appl_your_revenuecat_api_key' // Replace with actual key
      : 'goog_your_revenuecat_api_key'; // Replace with actual key

    await Purchases.configure({ apiKey });
    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
}

export async function purchasePremium() {
  if (!Capacitor.isNativePlatform()) {
    console.warn('purchasePremium: Not on native platform');
    return null;
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings();
    
    if (!offerings.current?.availablePackages?.length) {
      throw new Error('No packages available');
    }

    const result = await Purchases.purchasePackage({
      aPackage: offerings.current.availablePackages[0],
    });

    return result;
  } catch (error) {
    console.error('Purchase failed:', error);
    throw error;
  }
}
