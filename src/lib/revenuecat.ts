import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  // Web must never use RevenueCat IAP (plugin stubs throw).
  if (Capacitor.getPlatform() === "web") return false;
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android";
};

// RevenueCat entitlement identifier — must match the RevenueCat dashboard exactly
// (case-sensitive). The webhook accepts this key case-insensitively as a safety net.
export const PREMIUM_ENTITLEMENT_ID = 'Premium';

// App Store product identifier for SHAKE Premium (non-consumable)
export const PREMIUM_PRODUCT_ID = 'Superhuman01';

// Per-platform RevenueCat public API keys. Android has no Google Play app
// configured in RevenueCat yet — purchases there fail until a goog_ key exists.
const REVENUECAT_API_KEYS: Record<string, string | undefined> = {
  ios: 'appl_RUTGAWevlfwjFrJjnUlJWYtiXlD',
  android: undefined,
};

let _revenueCatReady = false;

export const initializeRevenueCat = async () => {
  const platform = Capacitor.getPlatform();
  console.log('[RevenueCat] initializeRevenueCat called — platform:', platform, 'isNative:', Capacitor.isNativePlatform());

  if (!isNativePlatform()) {
    console.log('[RevenueCat] Not a native platform — skipping initialization');
    return;
  }

  const apiKey = REVENUECAT_API_KEYS[platform];
  if (!apiKey) {
    console.warn(`[RevenueCat] No API key for platform "${platform}" — purchases unavailable`);
    return;
  }

  try {
    await Purchases.configure({ apiKey });
    _revenueCatReady = true;
    console.log('✅ RevenueCat configured successfully (anonymous session — call identifyUser() after sign-in)');
  } catch (error) {
    // Don't rethrow at app start; purchasePremium retries configuration on demand.
    console.error('❌ RevenueCat initialization error:', error);
  }
};

/**
 * Link RevenueCat session to the app's signed-in user.
 * Must be called after sign-in so purchases are attributed to the correct account.
 * Throws on failure: a purchase made before logIn succeeds is attributed to an
 * anonymous RevenueCat user and can never be matched to the Supabase profile —
 * the user would pay without receiving premium.
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
    throw error;
  }
};

export const isRevenueCatReady = () => _revenueCatReady;

export const checkPremiumAccess = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return (customerInfo as any).entitlements?.active?.[PREMIUM_ENTITLEMENT_ID] !== undefined;
  } catch (error) {
    console.error('Error checking premium:', error);
    return false;
  }
};

export const purchasePremium = async () => {
  if (!isNativePlatform()) {
    throw new Error("Not available on web — use Stripe checkout");
  }

  // If configuration failed at app start (e.g. launched offline), retry now
  // instead of letting getOfferings throw an opaque "not configured" error.
  if (!_revenueCatReady) {
    console.warn('[RevenueCat] purchasePremium called but _revenueCatReady=false — retrying configuration');
    await initializeRevenueCat();
    if (!_revenueCatReady) {
      throw new Error('Payment system not configured — restart the app and try again');
    }
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

  // Exact product match first, then fall back to looser matching
  const pkg =
    packages.find(p => p.product?.identifier === PREMIUM_PRODUCT_ID) ??
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

  console.log('[RevenueCat] purchase complete — entitlements.active:', result.customerInfo?.entitlements?.active);
  return result.customerInfo;
};
