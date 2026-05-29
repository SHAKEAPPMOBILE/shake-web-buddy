import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  // Web must never use RevenueCat IAP (plugin stubs throw).
  if (Capacitor.getPlatform() === "web") return false;
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android";
};

let _revenueCatReady = false;

export const initializeRevenueCat = async () => {
  const platform = Capacitor.getPlatform();
  console.log('[RevenueCat] initializeRevenueCat called — platform:', platform, 'isNative:', Capacitor.isNativePlatform());

  if (!isNativePlatform()) {
    console.log('[RevenueCat] Not a native platform — skipping initialization');
    return;
  }

  try {
    await Purchases.configure({
      apiKey: 'appl_RUTGAWevlfwjFrJjnUlJWYtiXlD',
    });
    _revenueCatReady = true;
    console.log('✅ RevenueCat configured successfully (anonymous session — call identifyUser() after sign-in)');
  } catch (error) {
    console.error('❌ RevenueCat initialization error:', error);
  }
};

/**
 * Link RevenueCat session to the app's signed-in user.
 * Must be called after sign-in so purchases are attributed to the correct account.
 */
export const identifyRevenueCatUser = async (appUserId: string) => {
  if (!isNativePlatform()) return;
  try {
    console.log('[RevenueCat] logIn — appUserId:', appUserId);
    const { customerInfo, created } = await Purchases.logIn({ appUserID: appUserId });
    console.log('[RevenueCat] logIn result — created new:', created,
      'entitlements:', Object.keys(customerInfo?.entitlements?.active ?? {}));
  } catch (error) {
    console.error('[RevenueCat] logIn error:', error);
  }
};

export const isRevenueCatReady = () => _revenueCatReady;

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

  // Warn if RevenueCat was never configured (initializeRevenueCat wasn't called or failed)
  if (!_revenueCatReady) {
    console.warn('[RevenueCat] purchasePremium called but _revenueCatReady=false — attempting anyway, may throw "not configured"');
  }

  console.log('[RevenueCat] purchasePremium: fetching offerings... (ready:', _revenueCatReady, ')');
  let offerings: Awaited<ReturnType<typeof Purchases.getOfferings>>;
  try {
    offerings = await Purchases.getOfferings();
  } catch (offeringsErr: any) {
    console.error('[RevenueCat] getOfferings threw:', {
      message: offeringsErr?.message,
      code: offeringsErr?.code,
      readableErrorCode: offeringsErr?.readableErrorCode,
      underlyingErrorMessage: offeringsErr?.underlyingErrorMessage,
      raw: JSON.stringify(offeringsErr),
    });
    throw offeringsErr;
  }

  console.log('[RevenueCat] offerings.current:', offerings.current?.identifier ?? 'null');
  const packages = offerings.current?.availablePackages ?? [];
  console.log('[RevenueCat] available packages:', packages.map(p => ({
    identifier: p.identifier,
    productId: p.product?.identifier,
    price: p.product?.priceString,
  })));

  if (packages.length === 0) {
    console.error('[RevenueCat] offerings.current is null or has no packages. Full offerings:', JSON.stringify(offerings));
    throw new Error('No purchasable package found in RevenueCat offerings');
  }

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

  console.log('[RevenueCat] purchasing package:', pkg.identifier, pkg.product?.identifier, pkg.product?.priceString);
  let result: Awaited<ReturnType<typeof Purchases.purchasePackage>>;
  try {
    result = await Purchases.purchasePackage({ aPackage: pkg });
  } catch (purchaseErr: any) {
    // Log every field RevenueCat may put on the error object
    console.error('[RevenueCat] purchasePackage threw:', {
      message: purchaseErr?.message,
      code: purchaseErr?.code,
      readableErrorCode: purchaseErr?.readableErrorCode,
      userCancelled: purchaseErr?.userCancelled,
      underlyingErrorMessage: purchaseErr?.underlyingErrorMessage,
      raw: JSON.stringify(purchaseErr),
    });
    throw purchaseErr;
  }

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
