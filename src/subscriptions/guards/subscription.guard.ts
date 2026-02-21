import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../subscriptions.service';
import {
  SubscriptionFeature,
  SubscriptionTier,
  getTierConfig,
} from '../enums/subscription.enums';

export const SUBSCRIPTION_FEATURE_KEY = 'subscription_feature';
export const SUBSCRIPTION_TIER_KEY = 'subscription_tier';

export interface SubscriptionFeatureOptions {
  feature: SubscriptionFeature;
  count?: number;
}

export interface SubscriptionTierOptions {
  tier?: SubscriptionTier;
  allowHigher?: boolean;
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check feature-based access
    const featureOptions = this.reflector.get<SubscriptionFeatureOptions>(
      SUBSCRIPTION_FEATURE_KEY,
      context.getHandler(),
    );

    if (featureOptions) {
      return this.checkFeatureAccess(user.id, featureOptions);
    }

    // Check tier-based access
    const tierOptions = this.reflector.get<SubscriptionTierOptions>(
      SUBSCRIPTION_TIER_KEY,
      context.getHandler(),
    );

    if (tierOptions) {
      return this.checkTierAccess(user.id, tierOptions);
    }

    return true;
  }

  private async checkFeatureAccess(
    userId: number,
    options: SubscriptionFeatureOptions,
  ): Promise<boolean> {
    const canPerform = await this.subscriptionsService.canPerformAction(
      userId,
      options.feature,
      options.count || 1,
    );

    if (!canPerform) {
      throw new ForbiddenException(
        `Access denied: Feature ${options.feature} requires a higher subscription tier`,
      );
    }

    return true;
  }

  private async checkTierAccess(
    userId: number,
    options: SubscriptionTierOptions,
  ): Promise<boolean> {
    const subscription =
      await this.subscriptionsService.getCurrentSubscription(userId);
    const currentTier = subscription?.tier || SubscriptionTier.FREE;

    if (!options.tier) {
      throw new ForbiddenException('Tier check requires a target tier');
    }

    const tierConfig = getTierConfig(options.tier);
    if (!tierConfig) {
      throw new ForbiddenException('Invalid subscription tier specified');
    }

    const currentTierConfig = getTierConfig(currentTier);
    if (!currentTierConfig) {
      return true; // Allow access if current tier is invalid
    }

    if (options.allowHigher) {
      return currentTierConfig.sortOrder >= tierConfig.sortOrder;
    }

    return currentTierConfig.sortOrder >= tierConfig.sortOrder;
  }
}
