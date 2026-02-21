import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Subscription } from './entities/subscription.entity';
import { Users } from '../users/users.entity';
import { Listing } from '../listing/entities/listing.entity';
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  SubscriptionFeature,
} from './enums/subscription.enums';
import {
  SUBSCRIPTION_TIERS,
  getTierConfig,
  getAllActiveTiers,
  canUpgrade,
  getUpgradePath,
} from './config/subscription-tiers.config';

export interface CreateSubscriptionDto {
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  paymentMethodToken?: string;
  paymentProvider?: string;
  autoRenew?: boolean;
}

export interface UpgradeSubscriptionDto {
  targetTier: SubscriptionTier;
  billingCycle?: BillingCycle;
  paymentMethodToken?: string;
}

export interface UsageStatsDto {
  currentListings: number;
  maxListings: number;
  currentFeaturedListings: number;
  maxFeaturedListings: number;
  currentImagesPerListing: number;
  maxImagesPerListing: number;
  usedFeatures: string[];
  availableFeatures: string[];
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create new subscription
   */
  async createSubscription(
    userId: number,
    dto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    this.logger.log(
      `Creating subscription for user ${userId}, tier: ${dto.tier}`,
    );

    // Check if user already has active subscription
    const existingSubscription = await this.getActiveSubscription(userId);
    if (
      existingSubscription &&
      existingSubscription.status === SubscriptionStatus.ACTIVE
    ) {
      throw new BadRequestException('User already has an active subscription');
    }

    const tierConfig = getTierFromConfig(dto.tier);
    if (!tierConfig || !tierConfig.isActive) {
      throw new BadRequestException('Invalid subscription tier');
    }

    // Calculate price based on billing cycle
    const price = this.calculatePrice(tierConfig, dto.billingCycle);
    const now = new Date();
    const endsAt = this.calculateEndDate(now, dto.billingCycle);

    const subscription = this.subscriptionRepo.create({
      userId,
      tier: dto.tier,
      status: SubscriptionStatus.PENDING,
      billingCycle: dto.billingCycle,
      price,
      currency: 'USD',
      startsAt: now,
      endsAt,
      expiresAt: endsAt,
      autoRenew: dto.autoRenew ?? true,
      paymentMethodToken: dto.paymentMethodToken,
      paymentProvider: dto.paymentProvider,
      usage: {
        currentListings: 0,
        currentFeaturedListings: 0,
        totalUploadsThisMonth: 0,
        lastUsageReset: now,
      },
    });

    const savedSubscription = await this.subscriptionRepo.save(subscription);

    // Update user subscription status
    await this.updateUserSubscriptionStatus(userId, savedSubscription);

    return savedSubscription;
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(
    userId: number,
    dto: UpgradeSubscriptionDto,
  ): Promise<Subscription> {
    this.logger.log(
      `Upgrading subscription for user ${userId} to tier: ${dto.targetTier}`,
    );

    const currentSubscription = await this.getActiveSubscription(userId);
    if (!currentSubscription) {
      throw new NotFoundException('No active subscription found');
    }

    if (!canUpgrade(currentSubscription.tier, dto.targetTier)) {
      throw new BadRequestException('Cannot downgrade to lower tier');
    }

    const tierConfig = getTierFromConfig(dto.targetTier);
    if (!tierConfig || !tierConfig.isActive) {
      throw new BadRequestException('Invalid target subscription tier');
    }

    const billingCycle = dto.billingCycle || currentSubscription.billingCycle;
    const price = this.calculatePrice(tierConfig, billingCycle);
    const now = new Date();
    const endsAt = this.calculateEndDate(now, billingCycle);

    // Update existing subscription
    currentSubscription.tier = dto.targetTier;
    currentSubscription.billingCycle = billingCycle;
    currentSubscription.price = price;
    currentSubscription.endsAt = endsAt;
    currentSubscription.expiresAt = endsAt;
    currentSubscription.nextBillingAt = endsAt;
    currentSubscription.status = SubscriptionStatus.PENDING;
    currentSubscription.paymentMethodToken =
      dto.paymentMethodToken || currentSubscription.paymentMethodToken;

    const updatedSubscription =
      await this.subscriptionRepo.save(currentSubscription);
    await this.updateUserSubscriptionStatus(userId, updatedSubscription);

    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: number,
    reason?: string,
  ): Promise<Subscription> {
    this.logger.log(`Cancelling subscription for user ${userId}`);

    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancellationReason = reason;
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;

    const cancelledSubscription =
      await this.subscriptionRepo.save(subscription);
    await this.updateUserSubscriptionStatus(userId, cancelledSubscription);

    return cancelledSubscription;
  }

  /**
   * Get current subscription for user
   */
  async getCurrentSubscription(userId: number): Promise<Subscription | null> {
    return this.getActiveSubscription(userId);
  }

  /**
   * Get user usage statistics
   */
  async getUserUsage(userId: number): Promise<UsageStatsDto> {
    const subscription = await this.getActiveSubscription(userId);
    const tierLimits = getTierLimits(
      subscription?.tier || SubscriptionTier.FREE,
    );

    // Get current usage from database
    const currentListings = await this.listingRepo.count({ where: { userId } });
    const featuredListings = await this.listingRepo.count({
      where: { userId, isFeatured: true },
    });

    const usedFeatures = this.getUsedFeatures(
      subscription?.tier || SubscriptionTier.FREE,
    );
    const availableFeatures = this.getAvailableFeatures(tierLimits);

    return {
      currentListings,
      maxListings: tierLimits[SubscriptionFeature.MAX_LISTINGS],
      currentFeaturedListings: featuredListings,
      maxFeaturedListings: tierLimits[SubscriptionFeature.FEATURED_LISTINGS],
      currentImagesPerListing: 0, // Would need to track this per listing
      maxImagesPerListing:
        tierLimits[SubscriptionFeature.MAX_IMAGES_PER_LISTING],
      usedFeatures,
      availableFeatures,
    };
  }

  /**
   * Check if user can perform action based on subscription limits
   */
  async canPerformAction(
    userId: number,
    feature: SubscriptionFeature,
    count: number = 1,
  ): Promise<boolean> {
    const subscription = await this.getActiveSubscription(userId);
    const tierLimits = getTierLimits(
      subscription?.tier || SubscriptionTier.FREE,
    );

    const limit = tierLimits[feature];

    // Unlimited (-1) means no limit
    if (limit === -1) return true;

    // Get current usage for this feature
    const currentUsage = await this.getCurrentUsage(
      userId,
      feature,
      subscription,
    );

    return currentUsage + count <= limit;
  }

  /**
   * Get available upgrade paths
   */
  async getUpgradePaths(userId: number): Promise<SubscriptionTierConfig[]> {
    const subscription = await this.getActiveSubscription(userId);
    const currentTier = subscription?.tier || SubscriptionTier.FREE;

    const upgradeTiers = getUpgradePath(currentTier);
    return upgradeTiers.map((tier) => getTierFromConfig(tier)).filter(Boolean);
  }

  /**
   * Get all available subscription tiers
   */
  async getAvailableTiers(): Promise<SubscriptionTierConfig[]> {
    return getAllActiveTiers();
  }

  /**
   * Process subscription renewal
   */
  async processRenewal(subscriptionId: string): Promise<Subscription> {
    this.logger.log(`Processing renewal for subscription ${subscriptionId}`);

    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (!subscription.autoRenew) {
      this.logger.log(
        `Subscription ${subscriptionId} is not set to auto-renew`,
      );
      return subscription;
    }

    const tierConfig = getTierFromConfig(subscription.tier);
    const now = new Date();
    const endsAt = this.calculateEndDate(now, subscription.billingCycle);

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.lastPaymentAt = now;
    subscription.nextBillingAt = endsAt;
    subscription.expiresAt = endsAt;
    subscription.endsAt = endsAt;

    const renewedSubscription = await this.subscriptionRepo.save(subscription);
    await this.updateUserSubscriptionStatus(
      subscription.userId,
      renewedSubscription,
    );

    return renewedSubscription;
  }

  /**
   * Check and update expired subscriptions
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredSubscriptions(): Promise<void> {
    this.logger.log('Checking for expired subscriptions');

    const now = new Date();
    const expiredSubscriptions = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: LessThan(now),
      },
    });

    for (const subscription of expiredSubscriptions) {
      if (subscription.autoRenew) {
        try {
          await this.processRenewal(subscription.id);
        } catch (error) {
          this.logger.error(
            `Failed to renew subscription ${subscription.id}: ${error.message}`,
          );
          subscription.status = SubscriptionStatus.SUSPENDED;
          await this.subscriptionRepo.save(subscription);
        }
      } else {
        subscription.status = SubscriptionStatus.EXPIRED;
        await this.subscriptionRepo.save(subscription);
      }

      await this.updateUserSubscriptionStatus(
        subscription.userId,
        subscription,
      );
    }

    this.logger.log(
      `Processed ${expiredSubscriptions.length} expired subscriptions`,
    );
  }

  /**
   * Send renewal reminders
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendRenewalReminders(): Promise<void> {
    this.logger.log('Sending renewal reminders');

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const upcomingRenewals = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: Between(new Date(), sevenDaysFromNow),
        autoRenew: true,
      },
      relations: ['user'],
    });

    for (const subscription of upcomingRenewals) {
      // Send notification email/logic here
      this.logger.log(
        `Renewal reminder sent for user ${subscription.userId}, subscription ${subscription.id}`,
      );
    }

    this.logger.log(`Sent ${upcomingRenewals.length} renewal reminders`);
  }

  /**
   * Get active subscription for user
   */
  private async getActiveSubscription(
    userId: number,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update user subscription status
   */
  private async updateUserSubscriptionStatus(
    userId: number,
    subscription: Subscription,
  ): Promise<void> {
    const hasPremium =
      subscription.tier !== SubscriptionTier.FREE &&
      subscription.status === SubscriptionStatus.ACTIVE;

    await this.usersRepo.update(userId, {
      subscriptionTier: subscription.tier,
      subscriptionStatus: subscription.status,
      subscriptionExpiresAt: subscription.expiresAt,
      hasPremiumSubscription: hasPremium,
    });
  }

  /**
   * Calculate price based on billing cycle
   */
  private calculatePrice(
    tierConfig: SubscriptionTierConfig,
    billingCycle: BillingCycle,
  ): number {
    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        return tierConfig.monthlyPrice;
      case BillingCycle.YEARLY:
        return tierConfig.yearlyPrice;
      case BillingCycle.QUARTERLY:
        return tierConfig.monthlyPrice * 3 * 0.9; // 10% discount for quarterly
      default:
        return tierConfig.monthlyPrice;
    }
  }

  /**
   * Calculate end date based on billing cycle
   */
  private calculateEndDate(startDate: Date, billingCycle: BillingCycle): Date {
    const endDate = new Date(startDate);

    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case BillingCycle.QUARTERLY:
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case BillingCycle.YEARLY:
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    return endDate;
  }

  /**
   * Get current usage for a specific feature
   */
  private async getCurrentUsage(
    userId: number,
    feature: SubscriptionFeature,
    subscription?: Subscription,
  ): Promise<number> {
    switch (feature) {
      case SubscriptionFeature.MAX_LISTINGS:
        return this.listingRepo.count({ where: { userId } });
      case SubscriptionFeature.FEATURED_LISTINGS:
        return this.listingRepo.count({ where: { userId, isFeatured: true } });
      default:
        return 0;
    }
  }

  /**
   * Get used features for a tier
   */
  private getUsedFeatures(tier: SubscriptionTier): string[] {
    const tierConfig = getTierFromConfig(tier);
    if (!tierConfig) return [];

    const features: string[] = [];
    Object.entries(tierConfig.features).forEach(([feature, value]) => {
      if (value === true || (typeof value === 'number' && value > 0)) {
        features.push(feature);
      }
    });

    return features;
  }

  /**
   * Get available features for a tier
   */
  private getAvailableFeatures(tierLimits: any): string[] {
    const features: string[] = [];
    Object.entries(tierLimits).forEach(([feature, value]) => {
      if (value === true || (typeof value === 'number' && value > 0)) {
        features.push(feature);
      }
    });

    return features;
  }
}
