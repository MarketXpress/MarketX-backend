import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  Request,
  Body,
  Param,
  Query,
  HttpStatus,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import {
  MilestonesService,
  CreateMilestoneDto,
  ReleaseMilestoneDto,
  UpdateMilestoneStatusDto,
} from './milestones.service';
import {
  MilestoneStatus,
  MilestoneType,
  MilestoneTrigger,
} from './enums/milestone.enums';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role?: string;
  };
}

@ApiTags('Milestones')
@Controller('milestones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MilestonesController {
  private readonly logger = new Logger(MilestonesController.name);

  constructor(private readonly milestonesService: MilestonesService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Create milestones for order',
    description: 'Create multiple milestones for an order with escrow type',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Milestones created successfully',
  })
  async createMilestones(
    @Request() req: AuthenticatedRequest,
    @Body()
    createData: {
      orderId: string;
      milestones: CreateMilestoneDto[];
    },
  ) {
    this.logger.log(
      `Creating ${createData.milestones.length} milestones for order ${createData.orderId}`,
    );

    return this.milestonesService.createMilestones(
      createData.orderId,
      createData.milestones,
    );
  }

  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Get order milestones',
    description: 'Get all milestones for a specific order',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Milestones retrieved successfully',
  })
  async getOrderMilestones(@Param('orderId') orderId: string) {
    this.logger.log(`Fetching milestones for order ${orderId}`);

    return this.milestonesService.getOrderMilestones(orderId);
  }

  @Get(':milestoneId')
  @ApiOperation({
    summary: 'Get milestone by ID',
    description: 'Get a specific milestone by its ID',
  })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Milestone retrieved successfully',
  })
  async getMilestone(@Param('milestoneId') milestoneId: string) {
    this.logger.log(`Fetching milestone ${milestoneId}`);

    return this.milestonesService.getMilestoneById(milestoneId);
  }

  @Post(':milestoneId/approve')
  @ApiOperation({
    summary: 'Approve milestone',
    description: 'Approve a milestone for release (Admin only)',
  })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Milestone approved successfully',
  })
  @UseGuards(AdminGuard)
  async approveMilestone(
    @Param('milestoneId') milestoneId: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { notes?: string },
  ) {
    this.logger.log(`Admin ${req.user.id} approving milestone ${milestoneId}`);

    return this.milestonesService.approveMilestone(
      milestoneId,
      req.user.email,
      body.notes,
    );
  }

  @Post(':milestoneId/release')
  @ApiOperation({
    summary: 'Release milestone funds',
    description: 'Release funds for an approved milestone (Admin only)',
  })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Milestone funds released successfully',
  })
  @UseGuards(AdminGuard)
  async releaseMilestone(
    @Param('milestoneId') milestoneId: string,
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) releaseData: ReleaseMilestoneDto,
  ) {
    this.logger.log(`Admin ${req.user.id} releasing milestone ${milestoneId}`);

    return this.milestonesService.releaseMilestone(milestoneId, {
      ...releaseData,
      approvedBy: req.user.email,
    });
  }

  @Patch(':milestoneId/status')
  @ApiOperation({
    summary: 'Update milestone status',
    description: 'Update milestone status (Admin only)',
  })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Milestone status updated successfully',
  })
  @UseGuards(AdminGuard)
  async updateMilestoneStatus(
    @Param('milestoneId') milestoneId: string,
    @Body(ValidationPipe) updateData: UpdateMilestoneStatusDto,
  ) {
    this.logger.log(`Updating status for milestone ${milestoneId}`);

    return this.milestonesService.updateMilestoneStatus(milestoneId, {
      ...updateData,
      milestoneId,
    });
  }

  @Post(':milestoneId/reject')
  @ApiOperation({
    summary: 'Reject milestone',
    description: 'Reject a milestone (Admin only)',
  })
  @ApiParam({ name: 'milestoneId', description: 'Milestone ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Milestone rejected successfully',
  })
  @UseGuards(AdminGuard)
  async rejectMilestone(
    @Param('milestoneId') milestoneId: string,
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) rejectionData: UpdateMilestoneStatusDto,
  ) {
    this.logger.log(`Admin ${req.user.id} rejecting milestone ${milestoneId}`);

    return this.milestonesService.rejectMilestone(milestoneId, {
      ...rejectionData,
      milestoneId,
    });
  }

  @Get('order/:orderId/statistics')
  @ApiOperation({
    summary: 'Get milestone statistics',
    description: 'Get comprehensive statistics for order milestones',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  async getMilestoneStatistics(@Param('orderId') orderId: string) {
    this.logger.log(`Fetching milestone statistics for order ${orderId}`);

    return this.milestonesService.getMilestoneStatistics(orderId);
  }

  // Admin endpoints
  @Post('process-automatic-releases')
  @ApiOperation({
    summary: 'Process automatic releases (Admin)',
    description: 'Manually trigger automatic milestone releases (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automatic releases processed successfully',
  })
  @UseGuards(AdminGuard)
  async processAutomaticReleases() {
    this.logger.log('Admin triggering automatic milestone releases');

    await this.milestonesService.processAutomaticReleases();

    return { message: 'Automatic milestone releases processed' };
  }

  @Get('admin/all')
  @ApiOperation({
    summary: 'Get all milestones (Admin)',
    description: 'Get all milestones with filtering options (Admin only)',
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by status',
    required: false,
  })
  @ApiQuery({
    name: 'orderId',
    description: 'Filter by order ID',
    required: false,
  })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Milestones retrieved successfully',
  })
  @UseGuards(AdminGuard)
  async getAllMilestones(@Query() query: any) {
    this.logger.log('Admin fetching all milestones with filters', { query });

    // This would be implemented with proper filtering and pagination
    return { message: 'Admin endpoint - to be implemented with filtering' };
  }

  @Get('admin/statistics')
  @ApiOperation({
    summary: 'Get milestone statistics (Admin)',
    description: 'Get comprehensive milestone statistics (Admin only)',
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Filter by date from',
    required: false,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'Filter by date to',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  @UseGuards(AdminGuard)
  async getAdminStatistics(@Query() query: any) {
    this.logger.log('Admin fetching milestone statistics', { query });

    // This would be implemented with comprehensive statistics
    return {
      totalMilestones: 0,
      pendingMilestones: 0,
      approvedMilestones: 0,
      releasedMilestones: 0,
      rejectedMilestones: 0,
      disputedMilestones: 0,
      totalReleasedAmount: 0,
      averageReleaseTime: 0,
      milestonesByType: {},
      milestonesByStatus: {},
    };
  }
}
