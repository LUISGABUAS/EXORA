import { Platform } from 'react-native';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

// Replace these with your actual RevenueCat API keys
const REVENUECAT_API_KEY_IOS = 'test_KZkVMhwbGZXyYdsjZtQUQfEwfvR';
const REVENUECAT_API_KEY_ANDROID = 'test_KZkVMhwbGZXyYdsjZtQUQfEwfvR';

let configured = false;

export async function initRevenueCat(userId?: string) {
  try {
    Purchases.configure({
      apiKey:
        Platform.OS === 'ios'
          ? REVENUECAT_API_KEY_IOS
          : REVENUECAT_API_KEY_ANDROID,
      appUserID: userId || undefined,
    });
    configured = true;
  } catch (error) {
    configured = false;
    if (__DEV__) {
      console.warn('[RevenueCat] Configure error:', error);
    }
  }
}

export function isRevenueCatConfigured() {
  return configured;
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (error) {
    if (__DEV__) {
      console.warn('[RevenueCat] Offerings error:', error);
    }
    return null;
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (error: any) {
    if (error.userCancelled) return false;
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active.premium !== undefined;
  } catch {
    return false;
  }
}

export async function checkPremiumStatus(): Promise<{
  isPremium: boolean;
  plan: string;
}> {
  if (!configured) return { isPremium: false, plan: 'free' };
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const premium = customerInfo.entitlements.active.premium;
    if (!premium) {
      return { isPremium: false, plan: 'free' };
    }
    const periodType = premium.periodType;
    const plan =
      periodType === 'ANNUAL' || periodType === 'YEARLY'
        ? 'yearly'
        : 'monthly';
    return { isPremium: true, plan };
  } catch {
    return { isPremium: false, plan: 'free' };
  }
}
