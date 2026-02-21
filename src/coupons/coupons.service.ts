import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Raw } from 'typeorm';
import { Coupon, CouponStatus, DiscountType } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { CreateCouponDto, UpdateCouponDto } from './dto/create-coupon.dto';
import {
  ApplyCouponDto,
  ApplyCouponResponseDto,
  OrderItemForCouponDto,
} from './dto/apply-coupon.dto';
import { CouponResponseDto, CouponAnalyticsDto } from './dto/coupon-response.dto';

export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  message?: string;
  discountAmount?: number;
  applicableItems?: OrderItemForCouponDto[];
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly couponUsageRepository: Repository<CouponUsage>,
  ) {}

  /**
   * Create a new coupon
   */
  async create(createCouponDto: CreateCouponDto): Promise<CouponResponseDto> {
    // Check if coupon code already exists
    const existingCoupon = await this.couponRepository.findOne({
      where: { code: createCouponDto.code.toUpperCase() },
    });

    if (existingCoupon) {
      throw new ConflictException(
        `Coupon with code '${createCouponDto.code}' already exists`,
      );
    }

    // Validate percentage discount value
    if (
      createCouponDto.discountType === DiscountType.PERCENTAGE &&
      createCouponDto.discountValue > 100
    ) {
      throw new BadRequestException(
        'Percentage discount cannot exceed 100%',
      );
    }

    // Validate dates
    if (createCouponDto.startDate && createCouponDto.endDate) {
      if (createCouponDto.startDate > createCouponDto.endDate) {
        throw new BadRequestException(
          'Start date cannot be after end date',
        );
      }
    }

    const coupon = this.couponRepository.create({
      ...createCouponDto,
      code: createCouponDto.code.toUpperCase(),
      status: createCouponDto.status || CouponStatus.ACTIVE,
      currentUsageCount: 0,
    });

    const savedCoupon = await this.couponRepository.save(coupon);
    this.logger.log(`Coupon created: ${savedCoupon.code}`);

    return this.toCouponResponse(savedCoupon);
  }

  /**
   * Find all coupons with optional filters
   */
  async findAll(filters?: {
    status?: CouponStatus;
    isValid?: boolean;
  }): Promise<CouponResponseDto[]> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    const coupons = await this.couponRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return coupons.map((coupon) => this.toCouponResponse(coupon));
  }

  /**
   * Find a coupon by ID
   */
  async findOne(id: string): Promise<CouponResponseDto> {
    const coupon = await this.couponRepository.findOne({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID '${id}' not found`);
    }

    return this.toCouponResponse(coupon);
  }

  /**
   * Find a coupon by code
   */
  async findByCode(code: string): Promise<CouponResponseDto> {
    const coupon = await this.couponRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with code '${code}' not found`);
    }

    return this.toCouponResponse(coupon);
  }

  /**
   * Update a coupon
   */
  async update(
    id: string,
    updateCouponDto: UpdateCouponDto,
  ): Promise<CouponResponseDto> {
    const coupon = await this.couponRepository.findOne({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID '${id}' not found`);
    }

    // Validate dates
    if (updateCouponDto.startDate && updateCouponDto.endDate) {
      if (updateCouponDto.startDate > updateCouponDto.endDate) {
        throw new BadRequestException(
          'Start date cannot be after end date',
        );
      }
    }

    Object.assign(coupon, updateCouponDto);
    const updatedCoupon = await this.couponRepository.save(coupon);
    this.logger.log(`Coupon updated: ${updatedCoupon.code}`);

    return this.toCouponResponse(updatedCoupon);
  }

  /**
   * Delete a coupon (soft delete)
   */
  async remove(id: string): Promise<void> {
    const coupon = await this.couponRepository.findOne({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID '${id}' not found`);
    }

    await this.couponRepository.softDelete(id);
    this.logger.log(`Coupon deleted: ${coupon.code}`);
  }

  /**
   * Validate and apply a coupon to an order
   */
  async validateAndApplyCoupon(
    applyCouponDto: ApplyCouponDto,
  ): Promise<ApplyCouponResponseDto> {
    const { code, userId, items, subtotal } = applyCouponDto;

    // Find the coupon
    const coupon = await this.couponRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return {
        valid: false,
        message: 'Invalid coupon code',
      };
    }

    // Validate coupon
    const validationResult = await this.validateCoupon(
      coupon,
      userId,
      items,
      subtotal,
    );

    if (!validationResult.valid) {
      return {
        valid: false,
        message: validationResult.message,
      };
    }

    // Calculate discount
    const orderSubtotal = subtotal || this.calculateSubtotal(items);
    const discountAmount = coupon.calculateDiscount(orderSubtotal);
    const newTotal = orderSubtotal - discountAmount;

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountAmount,
      newTotal,
      appliedRestrictions: this.getAppliedRestrictions(coupon),
    };
  }

  /**
   * Validate a coupon against all constraints
   */
  private async validateCoupon(
    coupon: Coupon,
    userId: string,
    items: OrderItemForCouponDto[],
    subtotal?: number,
  ): Promise<CouponValidationResult> {
    // Check if coupon is active
    if (coupon.status !== CouponStatus.ACTIVE) {
      return {
        valid: false,
        message: `Coupon is ${coupon.status}`,
      };
    }

    // Check validity period
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      return {
        valid: false,
        message: 'Coupon is not yet valid',
      };
    }

    if (coupon.endDate && now > coupon.endDate) {
      return {
        valid: false,
        message: 'Coupon has expired',
      };
    }

    // Check total usage limit
    if (
      coupon.totalUsageLimit > 0 &&
      coupon.currentUsageCount >= coupon.totalUsageLimit
    ) {
      return {
        valid: false,
        message: 'Coupon usage limit has been reached',
      };
    }

    // Check per-user limit
    if (coupon.perUserLimit > 0) {
      const userUsageCount = await this.couponUsageRepository.count({
        where: { couponId: coupon.id, userId },
      });

      if (userUsageCount >= coupon.perUserLimit) {
        return {
          valid: false,
          message: `You have already used this coupon the maximum number of times (${coupon.perUserLimit})`,
        };
      }
    }

    // Calculate subtotal
    const orderSubtotal = subtotal || this.calculateSubtotal(items);

    // Check minimum order amount
    if (
      coupon.restrictions?.minimumOrderAmount &&
      orderSubtotal < coupon.restrictions.minimumOrderAmount
    ) {
      return {
        valid: false,
        message: `Minimum order amount of ${coupon.restrictions.minimumOrderAmount} required`,
      };
    }

    // Check product/category restrictions
    const applicableItems = this.getApplicableItems(coupon, items);
    if (applicableItems.length === 0) {
      return {
        valid: false,
        message: 'Coupon is not applicable to any items in your cart',
      };
    }

    // Calculate discount based on applicable items only
    const applicableSubtotal = this.calculateSubtotal(applicableItems);
    const discountAmount = coupon.calculateDiscount(applicableSubtotal);

    return {
      valid: true,
      coupon,
      discountAmount,
      applicableItems,
    };
  }

  /**
   * Apply a coupon to an order and record usage
   */
  async applyCouponToOrder(
    couponId: string,
    orderId: string,
    userId: string,
    orderAmount: number,
    discountAmount: number,
    currency: string,
  ): Promise<void> {
    // Record coupon usage
    const usage = this.couponUsageRepository.create({
      couponId,
      orderId,
      userId,
      orderAmount,
      discountAmount,
      currency,
    });

    await this.couponUsageRepository.save(usage);

    // Increment coupon usage count
    await this.couponRepository.increment(
      { id: couponId },
      'currentUsageCount',
      1,
    );

    this.logger.log(
      `Coupon ${couponId} applied to order ${orderId} for user ${userId}`,
    );
  }

  /**
   * Get coupon usage history
   */
  async getCouponUsage(
    couponId?: string,
    userId?: string,
  ): Promise<CouponUsage[]> {
    const where: any = {};

    if (couponId) {
      where.couponId = couponId;
    }

    if (userId) {
      where.userId = userId;
    }

    return this.couponUsageRepository.find({
      where,
      relations: ['coupon'],
      order: { usedAt: 'DESC' },
    });
  }

  /**
   * Get coupon analytics
   */
  async getCouponAnalytics(couponId: string): Promise<CouponAnalyticsDto> {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID '${couponId}' not found`);
    }

    const usages = await this.couponUsageRepository.find({
      where: { couponId },
    });

    const totalUses = usages.length;
    const totalDiscountAmount = usages.reduce(
      (sum, usage) => sum + Number(usage.discountAmount),
      0,
    );
    const totalOrderAmount = usages.reduce(
      (sum, usage) => sum + Number(usage.orderAmount),
      0,
    );

    const uniqueUsers = new Set(usages.map((u) => u.userId)).size;

    // Calculate usage by day
    const usageByDayMap = new Map<string, number>();
    usages.forEach((usage) => {
      const date = usage.usedAt.toISOString().split('T')[0];
      usageByDayMap.set(date, (usageByDayMap.get(date) || 0) + 1);
    });

    const usageByDay = Array.from(usageByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      couponId,
      couponCode: coupon.code,
      totalUses,
      totalDiscountAmount,
      averageOrderAmount: totalUses > 0 ? totalOrderAmount / totalUses : 0,
      averageDiscountAmount: totalUses > 0 ? totalDiscountAmount / totalUses : 0,
      uniqueUsers,
      conversionRate: 0, // Would need to calculate based on views vs usage
      usageByDay,
    };
  }

  /**
   * Get user's coupon usage count
   */
  async getUserCouponUsageCount(
    couponId: string,
    userId: string,
  ): Promise<number> {
    return this.couponUsageRepository.count({
      where: { couponId, userId },
    });
  }

  /**
   * Calculate subtotal from items
   */
  private calculateSubtotal(items: OrderItemForCouponDto[]): number {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  /**
   * Get items applicable for the coupon based on restrictions
   */
  private getApplicableItems(
    coupon: Coupon,
    items: OrderItemForCouponDto[],
  ): OrderItemForCouponDto[] {
    if (!coupon.restrictions) {
      return items;
    }

    const {
      productIds,
      categoryIds,
      excludedProductIds,
      excludedCategoryIds,
    } = coupon.restrictions;

    return items.filter((item) => {
      // Check excluded products
      if (
        excludedProductIds?.length &&
        excludedProductIds.includes(item.productId)
      ) {
        return false;
      }

      // Check excluded categories
      if (
        excludedCategoryIds?.length &&
        item.categoryId &&
        excludedCategoryIds.includes(item.categoryId)
      ) {
        return false;
      }

      // Check included products
      if (productIds?.length && !productIds.includes(item.productId)) {
        return false;
      }

      // Check included categories
      if (
        categoryIds?.length &&
        (!item.categoryId || !categoryIds.includes(item.categoryId))
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get list of applied restrictions for response
   */
  private getAppliedRestrictions(coupon: Coupon): string[] {
    const restrictions: string[] = [];

    if (!coupon.restrictions) {
      return restrictions;
    }

    const r = coupon.restrictions;

    if (r.minimumOrderAmount) {
      restrictions.push(`Minimum order amount: ${r.minimumOrderAmount}`);
    }
    if (r.maximumDiscountAmount) {
      restrictions.push(`Maximum discount: ${r.maximumDiscountAmount}`);
    }
    if (r.productIds?.length) {
      restrictions.push(`Valid for specific products only`);
    }
    if (r.categoryIds?.length) {
      restrictions.push(`Valid for specific categories only`);
    }
    if (r.newCustomersOnly) {
      restrictions.push('New customers only');
    }
    if (r.firstOrderOnly) {
      restrictions.push('First order only');
    }

    return restrictions;
  }

  /**
   * Convert Coupon entity to CouponResponseDto
   */
  private toCouponResponse(coupon: Coupon): CouponResponseDto {
    return {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      status: coupon.status,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      totalUsageLimit: coupon.totalUsageLimit,
      perUserLimit: coupon.perUserLimit,
      currentUsageCount: coupon.currentUsageCount,
      restrictions: coupon.restrictions,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
      isValid: coupon.isValid(),
      remainingUses:
        coupon.totalUsageLimit > 0
          ? coupon.totalUsageLimit - coupon.currentUsageCount
          : Infinity,
    };
  }
}
