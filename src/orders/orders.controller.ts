import { Controller, Get, Post, Body, Patch, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { ApplyCouponDto, ApplyCouponResponseDto } from '../coupons/dto/apply-coupon.dto';
import { CouponsService } from '../coupons/coupons.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly couponsService: CouponsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(createOrderDto);
    // Emit event: OrderCreated
    console.log(`Event emitted: OrderCreated - Order ID: ${order.id}`);
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
    @Body() updateOrderStatusDto: UpdateOrderStatusDto
  ) {
    const order = await this.ordersService.updateStatus(id, updateOrderStatusDto);
    // Emit event: OrderStatusChanged
    console.log(`Event emitted: OrderStatusChanged - Order ID: ${order.id}, Status: ${order.status}`);
    return order;
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body('userId') userId: string  // In a real app, this would come from authentication
  ) {
    if (!userId) {
      throw new Error('User ID is required to cancel an order');
    }
    const order = await this.ordersService.cancelOrder(id, userId);
    // Emit event: OrderCancelled
    console.log(`Event emitted: OrderCancelled - Order ID: ${order.id}`);
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