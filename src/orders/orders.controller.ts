import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import {
  ApplyCouponDto,
  ApplyCouponResponseDto,
} from '../coupons/dto/apply-coupon.dto';
import { CouponsService } from '../coupons/coupons.service';
import {
  OrderCreatedEvent,
  OrderCancelledEvent,
  EventNames,
} from '../common/events';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import {
  RateLimit,
  UserRateLimit,
} from '../decorators/rate-limit.decorator';
import { UserTier } from '../rate-limiting/rate-limit.service';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(RateLimitGuard)
@UserRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  tierLimits: {
    [UserTier.FREE]: { maxRequests: 10 },
    [UserTier.PREMIUM]: { maxRequests: 50 },
    [UserTier.ENTERPRISE]: { maxRequests: 200 },
    [UserTier.ADMIN]: { maxRequests: 1000 },
  },
})
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly couponsService: CouponsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    tierLimits: {
      [UserTier.PREMIUM]: { maxRequests: 30 },
      [UserTier.ENTERPRISE]: { maxRequests: 100 },
      [UserTier.ADMIN]: { maxRequests: 1000 },
    },
    message: 'Too many orders created. Please wait before placing another order.',
  })
  async create(@Body() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(createOrderDto);

    // Emit order.created event for side-effects (email, notifications, analytics)
    this.eventEmitter.emit(
      EventNames.ORDER_CREATED,
      new OrderCreatedEvent(
        order.id,
        order.buyerId,
        `ORD-${order.id.substring(0, 8)}`,
        order.totalAmount,
        order.items,
        order.currency,
      ),
    );

    return order;
  }

  @Get()
  async findAll(@Query('buyerId') buyerId?: string) {
    return await this.ordersService.findAll(buyerId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    const order = await this.ordersService.updateStatus(
      id,
      updateOrderStatusDto,
    );
    // Emit event: OrderStatusChanged
    console.log(
      `Event emitted: OrderStatusChanged - Order ID: ${order.id}, Status: ${order.status}`,
    );
    return order;
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body('userId') userId: string, // In a real app, this would come from authentication
  ) {
    if (!userId) {
      throw new Error('User ID is required to cancel an order');
    }
    const order = await this.ordersService.cancelOrder(id, userId);

    // Emit order.cancelled event for side-effects (email, notifications, analytics)
    this.eventEmitter.emit(
      EventNames.ORDER_CANCELLED,
      new OrderCancelledEvent(
        order.id,
        order.buyerId,
        `ORD-${order.id.substring(0, 8)}`,
        'User requested cancellation',
      ),
    );

    return order;
  }

  /**
   * Apply a coupon to an order
   * POST /orders/apply-coupon
   */
  @Post('apply-coupon')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Apply a coupon to an order',
    description: 'Validate and apply a coupon code to calculate discount',
  })
  @ApiResponse({
    status: 200,
    description: 'Coupon applied successfully',
    type: ApplyCouponResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid coupon or order' })
  async applyCoupon(
    @Body() applyCouponDto: ApplyCouponDto,
  ): Promise<ApplyCouponResponseDto> {
    return this.couponsService.validateAndApplyCoupon(applyCouponDto);
  }
}
