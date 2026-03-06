import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  return Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android';
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
  if (!isNativePlatform()) throw new Error('Not available on web');
  
  try {
    const offerings = await Purchases.getOfferings();
    const product = offerings.current?.availablePackages.find(
      pkg => pkg.product.identifier === 'SuperHuman'
    );
    
    if (product) {
      const result = await Purchases.purchasePackage({ aPackage: product });
      return result.customerInfo;
    }
    throw new Error('Product not found');
  } catch (error) {
    console.error('Purchase error:', error);
    throw error;
  }
};

export const purchaseDonation = async (
  donationId: 'Donations5' | 'Donations10' | 'Donations25'
) => {
  if (!isNativePlatform()) throw new Error('Not available on web');
  
  try {
    const result = await Purchases.purchaseStoreProduct({
      product: { identifier: donationId, type: 'inapp' }
    });
    return result.customerInfo;
  } catch (error) {
    console.error('Donation error:', error);
    throw error;
  }
};
