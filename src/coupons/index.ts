// Export all public APIs from the coupons module
export {
  Coupon,
  DiscountType,
  CouponStatus,
  CouponRestriction,
} from './entities/coupon.entity';
export { CouponUsage } from './entities/coupon-usage.entity';
export {
  CreateCouponDto,
  UpdateCouponDto,
  CouponRestrictionDto,
} from './dto/create-coupon.dto';
export {
  ApplyCouponDto,
  ApplyCouponResponseDto,
  OrderItemForCouponDto,
  RemoveCouponDto,
} from './dto/apply-coupon.dto';
export {
  CouponResponseDto,
  CouponUsageResponseDto,
  CouponAnalyticsDto,
} from './dto/coupon-response.dto';
export { CouponsService, CouponValidationResult } from './coupons.service';
export { CouponsModule } from './coupons.module';
