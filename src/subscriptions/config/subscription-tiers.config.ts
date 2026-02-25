import { SubscriptionTier, SubscriptionTierConfig, SubscriptionFeature } from '../enums/subscription.enums';

export const SUBSCRIPTION_TIERS: SubscriptionTierConfig[] = [
  {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    description: 'Perfect for getting started with basic selling features',
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
  },
  {
    tier: SubscriptionTier.BASIC,
    name: 'Basic',
    description: 'Great for growing sellers with expanded features',
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
  },
  {
    tier: SubscriptionTier.PREMIUM,
    name: 'Premium',
    description: 'Complete solution for professional sellers with unlimited possibilities',
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    features: {
      [SubscriptionFeature.MAX_LISTINGS]: -1, // Unlimited
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
  },
];

export const getTierConfig = (tier: SubscriptionTier): SubscriptionTierConfig | undefined => {
  return SUBSCRIPTION_TIERS.find(config => config.tier === tier);
};

export const getAllActiveTiers = (): SubscriptionTierConfig[] => {
  return SUBSCRIPTION_TIERS.filter(config => config.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
};

export const getTierLimits = (tier: SubscriptionTier): any => {
  const config = getTierConfig(tier);
  return config?.features || {};
};

export const canUpgrade = (currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean => {
  const current = getTierConfig(currentTier);
  const target = getTierConfig(targetTier);
  
  if (!current || !target) return false;
  
  return target.sortOrder > current.sortOrder;
};

export const getUpgradePath = (currentTier: SubscriptionTier): SubscriptionTier[] => {
  const current = getTierConfig(currentTier);
  if (!current) return [];
  
  return SUBSCRIPTION_TIERS
    .filter(config => config.isActive && config.sortOrder > current.sortOrder)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(config => config.tier);
};
