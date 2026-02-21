export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum SubscriptionFeature {
  MAX_LISTINGS = 'max_listings',
  MAX_IMAGES_PER_LISTING = 'max_images_per_listing',
  FEATURED_LISTINGS = 'featured_listings',
  ANALYTICS_DASHBOARD = 'analytics_dashboard',
  BULK_UPLOAD = 'bulk_upload',
  PRIORITY_SUPPORT = 'priority_support',
  CUSTOM_BRANDING = 'custom_branding',
  API_ACCESS = 'api_access',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  VERIFICATION_BADGE = 'verification_badge',
}

export interface SubscriptionLimits {
  [SubscriptionFeature.MAX_LISTINGS]: number;
  [SubscriptionFeature.MAX_IMAGES_PER_LISTING]: number;
  [SubscriptionFeature.FEATURED_LISTINGS]: number;
  [SubscriptionFeature.ANALYTICS_DASHBOARD]: boolean;
  [SubscriptionFeature.BULK_UPLOAD]: boolean;
  [SubscriptionFeature.PRIORITY_SUPPORT]: boolean;
  [SubscriptionFeature.CUSTOM_BRANDING]: boolean;
  [SubscriptionFeature.API_ACCESS]: boolean;
  [SubscriptionFeature.ADVANCED_ANALYTICS]: boolean;
  [SubscriptionFeature.VERIFICATION_BADGE]: boolean;
}

export interface SubscriptionTierConfig {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: SubscriptionLimits;
  isActive: boolean;
  sortOrder: number;
}

export const getTierLimits = (tier: SubscriptionTier): any => {
  const config = getTierConfig(tier);
  return config?.features || {};
};

export const getTierConfig = (
  tier: SubscriptionTier,
): SubscriptionTierConfig | undefined => {
  // This would be implemented in the config file
  // For now, return a basic implementation
  switch (tier) {
    case SubscriptionTier.FREE:
      return {
        tier: SubscriptionTier.FREE,
        name: 'Free',
        description: 'Perfect for getting started',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: {
          [SubscriptionFeature.MAX_LISTINGS]: 5,
          [SubscriptionFeature.MAX_IMAGES_PER_LISTING]: 3,
          [SubscriptionFeature.FEATURED_LISTINGS]: 0,
          [SubscriptionFeature.ANALYTICS_DASHBOARD]: false,
          [SubscriptionFeature.BULK_UPLOAD]: false,
          [SubscriptionFeature.PRIORITY_SUPPORT]: false,
          [SubscriptionFeature.CUSTOM_BRANDING]: false,
          [SubscriptionFeature.API_ACCESS]: false,
          [SubscriptionFeature.ADVANCED_ANALYTICS]: false,
          [SubscriptionFeature.VERIFICATION_BADGE]: false,
        },
        isActive: true,
        sortOrder: 1,
      };
    case SubscriptionTier.BASIC:
      return {
        tier: SubscriptionTier.BASIC,
        name: 'Basic',
        description: 'Great for growing sellers',
        monthlyPrice: 9.99,
        yearlyPrice: 99.99,
        features: {
          [SubscriptionFeature.MAX_LISTINGS]: 50,
          [SubscriptionFeature.MAX_IMAGES_PER_LISTING]: 10,
          [SubscriptionFeature.FEATURED_LISTINGS]: 2,
          [SubscriptionFeature.ANALYTICS_DASHBOARD]: true,
          [SubscriptionFeature.BULK_UPLOAD]: false,
          [SubscriptionFeature.PRIORITY_SUPPORT]: false,
          [SubscriptionFeature.CUSTOM_BRANDING]: false,
          [SubscriptionFeature.API_ACCESS]: false,
          [SubscriptionFeature.ADVANCED_ANALYTICS]: false,
          [SubscriptionFeature.VERIFICATION_BADGE]: true,
        },
        isActive: true,
        sortOrder: 2,
      };
    case SubscriptionTier.PREMIUM:
      return {
        tier: SubscriptionTier.PREMIUM,
        name: 'Premium',
        description: 'Complete solution for professionals',
        monthlyPrice: 29.99,
        yearlyPrice: 299.99,
        features: {
          [SubscriptionFeature.MAX_LISTINGS]: -1,
          [SubscriptionFeature.MAX_IMAGES_PER_LISTING]: 20,
          [SubscriptionFeature.FEATURED_LISTINGS]: 10,
          [SubscriptionFeature.ANALYTICS_DASHBOARD]: true,
          [SubscriptionFeature.BULK_UPLOAD]: true,
          [SubscriptionFeature.PRIORITY_SUPPORT]: true,
          [SubscriptionFeature.CUSTOM_BRANDING]: true,
          [SubscriptionFeature.API_ACCESS]: true,
          [SubscriptionFeature.ADVANCED_ANALYTICS]: true,
          [SubscriptionFeature.VERIFICATION_BADGE]: true,
        },
        isActive: true,
        sortOrder: 3,
      };
    default:
      return undefined;
  }
};
