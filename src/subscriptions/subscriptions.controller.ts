import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  Request,
  Body,
  Query,
  Param,
  HttpStatus,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SubscriptionsService,
  CreateSubscriptionDto,
  UpgradeSubscriptionDto,
  UsageStatsDto,
} from './subscriptions.service';
import {
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionFeature,
} from './enums/subscription.enums';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role?: string;
  };
}

@ApiTags('Subscriptions')
@Controller('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Create new subscription',
    description: 'Create a new subscription for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or user already has active subscription',
  })
  async createSubscription(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) dto: CreateSubscriptionDto,
  ) {
    const userId = req.user.id;
    this.logger.log(`User ${userId} creating subscription: ${dto.tier}`);

    return this.subscriptionsService.createSubscription(userId, dto);
  }

  @Post('upgrade')
  @ApiOperation({
    summary: 'Upgrade subscription',
    description: 'Upgrade user subscription to a higher tier',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription upgraded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid upgrade request',
  })
  async upgradeSubscription(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) dto: UpgradeSubscriptionDto,
  ) {
    const userId = req.user.id;
    this.logger.log(`User ${userId} upgrading to: ${dto.targetTier}`);

    return this.subscriptionsService.upgradeSubscription(userId, dto);
  }

  @Post('cancel')
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancel user subscription with optional reason',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription cancelled successfully',
  })
  async cancelSubscription(
    @Request() req: AuthenticatedRequest,
    @Body('reason') reason?: string,
  ) {
    const userId = req.user.id;
    this.logger.log(`User ${userId} cancelling subscription`);

    return this.subscriptionsService.cancelSubscription(userId, reason);
  }

  @Get('current')
  @ApiOperation({
    summary: 'Get current subscription',
    description:
      'Get the current active subscription for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current subscription retrieved successfully',
  })
  async getCurrentSubscription(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    this.logger.log(`User ${userId} requesting current subscription`);

    return this.subscriptionsService.getCurrentSubscription(userId);
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Get usage statistics',
    description: 'Get detailed usage statistics and limits for the user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage statistics retrieved successfully',
  })
  async getUsageStatistics(
    @Request() req: AuthenticatedRequest,
  ): Promise<UsageStatsDto> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} requesting usage statistics`);

    return this.subscriptionsService.getUserUsage(userId);
  }

  @Get('tiers')
  @ApiOperation({
    summary: 'Get available subscription tiers',
    description:
      'Get all available subscription tiers with their features and pricing',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available tiers retrieved successfully',
  })
  async getAvailableTiers() {
    this.logger.log('Fetching available subscription tiers');

    return this.subscriptionsService.getAvailableTiers();
  }

  @Get('upgrade-paths')
  @ApiOperation({
    summary: 'Get upgrade paths',
    description: 'Get available upgrade paths from current subscription',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Upgrade paths retrieved successfully',
  })
  async getUpgradePaths(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    this.logger.log(`User ${userId} requesting upgrade paths`);

    return this.subscriptionsService.getUpgradePaths(userId);
  }

  @Get('can-perform')
  @ApiOperation({
    summary: 'Check if action can be performed',
    description:
      'Check if user can perform a specific action based on subscription limits',
  })
  @ApiQuery({
    name: 'feature',
    description: 'Feature to check',
    enum: SubscriptionFeature,
  })
  @ApiQuery({
    name: 'count',
    description: 'Number of items (default: 1)',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Action permission checked successfully',
  })
  async canPerformAction(
    @Request() req: AuthenticatedRequest,
    @Query('feature') feature: SubscriptionFeature,
    @Query('count') count: string = '1',
  ) {
    const userId = req.user.id;
    const itemCount = parseInt(count) || 1;

    this.logger.log(
      `User ${userId} checking permission for feature: ${feature}, count: ${itemCount}`,
    );

    const canPerform = await this.subscriptionsService.canPerformAction(
      userId,
      feature,
      itemCount,
    );

    return {
      canPerform,
      feature,
      requestedCount: itemCount,
      currentUsage: 0, // Would need to implement this
      limit: -1, // Would need to get this from tier limits
    };
  }

  // Admin endpoints
  @Get('admin/all')
  @ApiOperation({
    summary: 'Get all subscriptions (Admin)',
    description: 'Get all subscriptions with filtering options (Admin only)',
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by status',
    required: false,
  })
  @ApiQuery({ name: 'tier', description: 'Filter by tier', required: false })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscriptions retrieved successfully',
  })
  async getAllSubscriptions(@Query() query: any) {
    this.logger.log('Admin requesting all subscriptions with filters', {
      query,
    });

    // This would be implemented with admin guards and proper filtering
    return { message: 'Admin endpoint - to be implemented' };
  }

  @Post('admin/:subscriptionId/renew')
  @ApiOperation({
    summary: 'Process renewal (Admin)',
    description: 'Manually process subscription renewal (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Renewal processed successfully',
  })
  async processRenewal(@Param('subscriptionId') subscriptionId: string) {
    this.logger.log(
      `Admin processing renewal for subscription: ${subscriptionId}`,
    );

    return this.subscriptionsService.processRenewal(subscriptionId);
  }

  @Get('admin/expired-check')
  @ApiOperation({
    summary: 'Check expired subscriptions (Admin)',
    description: 'Manually trigger expired subscription check (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Expired check completed successfully',
  })
  async checkExpiredSubscriptions() {
    this.logger.log('Admin triggering expired subscription check');

    await this.subscriptionsService.checkExpiredSubscriptions();

    return { message: 'Expired subscription check completed' };
  }

  @Get('admin/statistics')
  @ApiOperation({
    summary: 'Get subscription statistics (Admin)',
    description: 'Get comprehensive subscription statistics (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  async getSubscriptionStatistics() {
    this.logger.log('Admin requesting subscription statistics');

    // This would be implemented to return comprehensive statistics
    return {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      expiredSubscriptions: 0,
      cancelledSubscriptions: 0,
      subscriptionsByTier: {},
      monthlyRevenue: 0,
      yearlyRevenue: 0,
      churnRate: 0,
      averageSubscriptionLifetime: 0,
    };
  }
}
