import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/create-coupon.dto';
import { ApplyCouponDto, ApplyCouponResponseDto } from './dto/apply-coupon.dto';
import { CouponResponseDto, CouponAnalyticsDto } from './dto/coupon-response.dto';
import { CouponStatus } from './entities/coupon.entity';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /**
   * Create a new coupon
   * POST /coupons
   */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new coupon',
    description: 'Create a promotional coupon with percentage or fixed amount discount',
  })
  @ApiResponse({
    status: 201,
    description: 'Coupon created successfully',
    type: CouponResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid coupon data' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  async create(@Body() createCouponDto: CreateCouponDto): Promise<CouponResponseDto> {
    return this.couponsService.create(createCouponDto);
  }

  /**
   * Get all coupons
   * GET /coupons
   */
  @Get()
  @ApiOperation({
    summary: 'Get all coupons',
    description: 'Retrieve all coupons with optional filtering',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CouponStatus,
    description: 'Filter by coupon status',
  })
  @ApiQuery({
    name: 'isValid',
    required: false,
    type: Boolean,
    description: 'Filter by validity',
  })
  @ApiResponse({
    status: 200,
    description: 'List of coupons',
    type: [CouponResponseDto],
  })
  async findAll(
    @Query('status') status?: CouponStatus,
    @Query('isValid') isValid?: boolean,
  ): Promise<CouponResponseDto[]> {
    return this.couponsService.findAll({ status, isValid });
  }

  /**
   * Get a coupon by ID
   * GET /coupons/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get coupon by ID',
    description: 'Retrieve a specific coupon by its ID',
  })
  @ApiParam({ name: 'id', description: 'Coupon ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Coupon details',
    type: CouponResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CouponResponseDto> {
    return this.couponsService.findOne(id);
  }

  /**
   * Get a coupon by code
   * GET /coupons/code/:code
   */
  @Get('code/:code')
  @ApiOperation({
    summary: 'Get coupon by code',
    description: 'Retrieve a specific coupon by its code',
  })
  @ApiParam({ name: 'code', description: 'Coupon code' })
  @ApiResponse({
    status: 200,
    description: 'Coupon details',
    type: CouponResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findByCode(@Param('code') code: string): Promise<CouponResponseDto> {
    return this.couponsService.findByCode(code);
  }

  /**
   * Update a coupon
   * PATCH /coupons/:id
   */
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a coupon',
    description: 'Update coupon details',
  })
  @ApiParam({ name: 'id', description: 'Coupon ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Coupon updated successfully',
    type: CouponResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCouponDto: UpdateCouponDto,
  ): Promise<CouponResponseDto> {
    return this.couponsService.update(id, updateCouponDto);
  }

  /**
   * Delete a coupon
   * DELETE /coupons/:id
   */
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a coupon',
    description: 'Soft delete a coupon',
  })
  @ApiParam({ name: 'id', description: 'Coupon ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Coupon deleted successfully' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.couponsService.remove(id);
  }

  /**
   * Validate and apply a coupon
   * POST /coupons/apply
   */
  @Post('apply')
  @ApiOperation({
    summary: 'Validate and apply a coupon',
    description: 'Validate a coupon code and calculate discount for an order',
  })
  @ApiResponse({
    status: 200,
    description: 'Coupon validation result',
    type: ApplyCouponResponseDto,
  })
  async validateAndApplyCoupon(
    @Body() applyCouponDto: ApplyCouponDto,
  ): Promise<ApplyCouponResponseDto> {
    return this.couponsService.validateAndApplyCoupon(applyCouponDto);
  }

  /**
   * Get coupon usage history
   * GET /coupons/:id/usage
   */
  @Get(':id/usage')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get coupon usage history',
    description: 'Retrieve usage history for a specific coupon',
  })
  @ApiParam({ name: 'id', description: 'Coupon ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Coupon usage history',
  })
  async getCouponUsage(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponsService.getCouponUsage(id);
  }

  /**
   * Get coupon analytics
   * GET /coupons/:id/analytics
   */
  @Get(':id/analytics')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get coupon analytics',
    description: 'Retrieve analytics data for a specific coupon',
  })
  @ApiParam({ name: 'id', description: 'Coupon ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Coupon analytics',
    type: CouponAnalyticsDto,
  })
  async getCouponAnalytics(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CouponAnalyticsDto> {
    return this.couponsService.getCouponAnalytics(id);
  }
}
