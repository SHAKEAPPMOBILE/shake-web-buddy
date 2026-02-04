import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Purchases, PurchasesPackage, CustomerInfo, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// RevenueCat entitlement identifier for premium access
const PREMIUM_ENTITLEMENT_ID = 'premium';

// Product identifiers from App Store Connect
export const PRODUCT_IDS = {
  MONTHLY_SUBSCRIPTION: 'shake_superhuman_monthly', // $3.88/month
  KIND_HUMAN_TIER_1: 'shake_kindhuman_1', // $1 donation
  KIND_HUMAN_TIER_2: 'shake_kindhuman_5', // $5 donation
  KIND_HUMAN_TIER_3: 'shake_kindhuman_10', // $10 donation
} as const;

interface InAppPurchaseState {
  isNativePlatform: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  packages: PurchasesPackage[];
  customerInfo: CustomerInfo | null;
  error: string | null;
}

export function useInAppPurchases() {
  const { user, checkSubscription } = useAuth();
  const [state, setState] = useState<InAppPurchaseState>({
    isNativePlatform: Capacitor.isNativePlatform(),
    isInitialized: false,
    isLoading: false,
    isPurchasing: false,
    packages: [],
    customerInfo: null,
    error: null,
  });

  // Initialize RevenueCat SDK
  const initialize = useCallback(async () => {
    if (!state.isNativePlatform) {
      console.log('[IAP] Not a native platform, skipping initialization');
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const apiKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;
      
      if (!apiKey) {
        // Fall back to a placeholder - the actual key should be in the native config
        console.log('[IAP] No public key in env, using native configuration');
      }

      // Configure RevenueCat
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      
      await Purchases.configure({
        apiKey: apiKey || 'appl_placeholder', // Will be overridden by native config
        appUserID: user?.id || undefined, // Use Supabase user ID
      });

      console.log('[IAP] RevenueCat configured');

      // Get offerings (available products)
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        setState(prev => ({
          ...prev,
          packages: offerings.current!.availablePackages,
          isInitialized: true,
          isLoading: false,
        }));
        console.log('[IAP] Loaded packages:', offerings.current.availablePackages.length);
      } else {
        console.log('[IAP] No offerings available');
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          error: 'No products available',
        }));
      }

      // Get current customer info
      const customerInfoResult = await Purchases.getCustomerInfo();
      setState(prev => ({ ...prev, customerInfo: customerInfoResult.customerInfo }));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize purchases';
      console.error('[IAP] Initialization error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [user?.id, state.isNativePlatform]);

  // Initialize when user changes
  useEffect(() => {
    if (user && state.isNativePlatform && !state.isInitialized) {
      initialize();
    }
  }, [user, state.isNativePlatform, state.isInitialized, initialize]);

  // Login/identify user with RevenueCat
  useEffect(() => {
    const identifyUser = async () => {
      if (!state.isNativePlatform || !state.isInitialized || !user?.id) return;
      
      try {
        await Purchases.logIn({ appUserID: user.id });
        const customerInfoResult = await Purchases.getCustomerInfo();
        setState(prev => ({ ...prev, customerInfo: customerInfoResult.customerInfo }));
        console.log('[IAP] User identified:', user.id);
      } catch (error) {
        console.error('[IAP] Error identifying user:', error);
      }
    };

    identifyUser();
  }, [user?.id, state.isNativePlatform, state.isInitialized]);

  // Purchase a package (subscription)
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!state.isNativePlatform) {
      toast.error('In-app purchases are only available on iOS');
      return false;
    }

    try {
      setState(prev => ({ ...prev, isPurchasing: true, error: null }));
      
      const purchaseResult = await Purchases.purchasePackage({ aPackage: pkg });
      const purchasedCustomerInfo = purchaseResult.customerInfo;
      
      // Check if user now has premium entitlement
      const hasPremium = purchasedCustomerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
      
      setState(prev => ({
        ...prev,
        customerInfo: purchasedCustomerInfo,
        isPurchasing: false,
      }));

      if (hasPremium) {
        toast.success('Welcome to Super-Human! 🦸');
        // Refresh subscription status from server
        await checkSubscription();
      }

      return hasPremium;
    } catch (error: any) {
      const errorMessage = error.message || 'Purchase failed';
      
      // Handle user cancellation gracefully
      if (error.userCancelled) {
        console.log('[IAP] User cancelled purchase');
        setState(prev => ({ ...prev, isPurchasing: false }));
        return false;
      }

      console.error('[IAP] Purchase error:', error);
      toast.error(errorMessage);
      setState(prev => ({
        ...prev,
        isPurchasing: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [state.isNativePlatform, checkSubscription]);

  // Purchase subscription (convenience method)
  const purchaseSubscription = useCallback(async (): Promise<boolean> => {
    const subscriptionPackage = state.packages.find(
      pkg => pkg.identifier === 'monthly' || pkg.product.identifier.includes('monthly')
    );

    if (!subscriptionPackage) {
      toast.error('Subscription not available');
      return false;
    }

    return purchasePackage(subscriptionPackage);
  }, [state.packages, purchasePackage]);

  // Make a donation (non-renewing purchase)
  const makeDonation = useCallback(async (productId: string): Promise<boolean> => {
    if (!state.isNativePlatform) {
      toast.error('Donations via Apple Pay are only available on iOS');
      return false;
    }

    try {
      setState(prev => ({ ...prev, isPurchasing: true, error: null }));
      
      // For non-subscription purchases, use purchaseStoreProduct
      const { products } = await Purchases.getProducts({ productIdentifiers: [productId] });
      
      if (products.length === 0) {
        throw new Error('Product not found');
      }

      const purchaseResult = await Purchases.purchaseStoreProduct({ product: products[0] });
      
      setState(prev => ({
        ...prev,
        customerInfo: purchaseResult.customerInfo,
        isPurchasing: false,
      }));

      toast.success('Thank you for your support! 💖');
      return true;
    } catch (error: any) {
      if (error.userCancelled) {
        console.log('[IAP] User cancelled donation');
        setState(prev => ({ ...prev, isPurchasing: false }));
        return false;
      }

      const errorMessage = error.message || 'Donation failed';
      console.error('[IAP] Donation error:', error);
      toast.error(errorMessage);
      setState(prev => ({
        ...prev,
        isPurchasing: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [state.isNativePlatform]);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!state.isNativePlatform) {
      toast.error('Restore is only available on iOS');
      return false;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const restoreResult = await Purchases.restorePurchases();
      const restoredCustomerInfo = restoreResult.customerInfo;
      const hasPremium = restoredCustomerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
      
      setState(prev => ({
        ...prev,
        customerInfo: restoredCustomerInfo,
        isLoading: false,
      }));

      if (hasPremium) {
        toast.success('Purchases restored successfully!');
        await checkSubscription();
      } else {
        toast.info('No previous purchases found');
      }

      return hasPremium;
    } catch (error: any) {
      const errorMessage = error.message || 'Restore failed';
      console.error('[IAP] Restore error:', error);
      toast.error(errorMessage);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [state.isNativePlatform, checkSubscription]);

  // Check if user has premium entitlement
  const hasPremiumEntitlement = useCallback((): boolean => {
    if (!state.customerInfo) return false;
    return state.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
  }, [state.customerInfo]);

  // Get subscription expiration date
  const getSubscriptionExpirationDate = useCallback((): Date | null => {
    if (!state.customerInfo) return null;
    const entitlement = state.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
    if (!entitlement?.expirationDate) return null;
    return new Date(entitlement.expirationDate);
  }, [state.customerInfo]);

  // Get monthly subscription package
  const getMonthlyPackage = useCallback((): PurchasesPackage | undefined => {
    return state.packages.find(
      pkg => pkg.identifier === 'monthly' || pkg.product.identifier.includes('monthly')
    );
  }, [state.packages]);

  return {
    ...state,
    initialize,
    purchasePackage,
    purchaseSubscription,
    makeDonation,
    restorePurchases,
    hasPremiumEntitlement,
    getSubscriptionExpirationDate,
    getMonthlyPackage,
  };
}
