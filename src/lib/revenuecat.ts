import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  // Web must never use RevenueCat IAP (plugin stubs throw).
  if (Capacitor.getPlatform() === "web") return false;
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android";
};

export const initializeRevenueCat = async () => {
  if (!isNativePlatform()) {
    console.log('Not a native platform, skipping RevenueCat initialization');
    return;
  }

  try {
    await Purchases.configure({
      apiKey: 'appl_RUTGAWevlfwjFrJjnUlJWYtiXlD',
    });
    console.log('✅ RevenueCat initialized');
  } catch (error) {
    console.error('❌ RevenueCat initialization error:', error);
  }
};

export const checkPremiumAccess = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return (customerInfo as any).entitlements?.active?.['premium'] !== undefined;
  } catch (error) {
    console.error('Error checking premium:', error);
    return false;
  }
};

export const purchasePremium = async () => {
  if (!isNativePlatform()) {
    throw new Error("Not available on web — use Stripe checkout");
  }

  console.log('[RevenueCat] purchasePremium: fetching offerings...');
  const offerings = await Purchases.getOfferings();
  console.log('[RevenueCat] offerings.current:', offerings.current?.identifier);
  const packages = offerings.current?.availablePackages ?? [];
  console.log('[RevenueCat] available packages:', packages.map(p => ({
    identifier: p.identifier,
    productId: p.product?.identifier,
    price: p.product?.priceString,
  })));

  // Broad search: match by product identifier, package identifier, or substring
  const pkg =
    packages.find(p => p.product?.identifier === 'SuperHuman') ??
    packages.find(p => p.product?.identifier?.toLowerCase().includes('superhuman')) ??
    packages.find(p => p.identifier === 'monthly') ??
    packages.find(p => p.identifier === '$rc_monthly') ??
    packages[0];

  if (!pkg) {
    throw new Error('No purchasable package found in RevenueCat offerings');
  }

  console.log('[RevenueCat] purchasing package:', pkg.identifier, pkg.product?.identifier);
  const result = await Purchases.purchasePackage({ aPackage: pkg });
  console.log('[RevenueCat] purchase complete, entitlements:', Object.keys(result.customerInfo?.entitlements?.active ?? {}));
  return result.customerInfo;
};

export const purchaseDonation = async (
  donationId: 'Donations5' | 'Donations10' | 'Donations25'
) => {
  if (!isNativePlatform()) throw new Error('Not available on web');
  
  try {
    const result = await Purchases.purchaseStoreProduct({
      product: { identifier: donationId } as any
    });
    return result.customerInfo;
  } catch (error) {
    console.error('Donation error:', error);
    throw error;
  }
};
