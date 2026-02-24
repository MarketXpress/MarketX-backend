/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RefundsService } from './refunds.service';
import {
  CreateReturnRequestDto,
  ReviewReturnRequestDto,
  ProcessRefundDto,
  QueryReturnRequestsDto,
} from './dto/refund.dto';
import { JwtAuthGuard } from '../Authentication/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  /**
   * Create a new return request (buyer)
   * POST /refunds/returns
   */
  @Post('returns')
  @HttpCode(HttpStatus.CREATED)
  async createReturnRequest(@Body() dto: CreateReturnRequestDto) {
    return this.refundsService.createReturnRequest(dto);
  }

  /**
   * Get return requests (buyer, seller, admin)
   * GET /refunds/returns
   */
  @Get('returns')
  async getReturnRequests(@Query() query: QueryReturnRequestsDto) {
    return this.refundsService.getReturnRequests(query);
  }

  /**
   * Get a specific return request
   * GET /refunds/returns/:id
   */
  @Get('returns/:id')
  async getReturnRequest(@Param('id') id: string) {
    return this.refundsService.getReturnRequest(id);
  }

  /**
   * Cancel a return request (buyer only)
   * POST /refunds/returns/:id/cancel
   */
  @Post('returns/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelReturnRequest(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.refundsService.cancelReturnRequest(id, req.user.id);
  }

  /**
   * Review a return request (admin only)
   * POST /refunds/returns/:id/review
   */
  @Post('returns/:id/review')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async reviewReturnRequest(
    @Param('id') id: string,
    @Body() dto: ReviewReturnRequestDto,
    @Request() req: any,
  ) {
    return this.refundsService.reviewReturnRequest(
      id,
      dto,
      req.user.id,
    );
  }

  /**
   * Process refund (admin only)
   * POST /refunds/process
   */
  @Post('process')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async processRefund(@Body() dto: ProcessRefundDto) {
    return this.refundsService.processRefund(dto);
  }

  /**
   * Get refund history for an order
   * GET /refunds/orders/:orderId/history
   */
  @Get('orders/:orderId/history')
  async getRefundHistoryByOrder(
    @Param('orderId') orderId: string,
  ) {
    return this.refundsService.getRefundHistoryByOrder(
      orderId,
    );
  }

  /**
   * Get all refund history (admin only)
   * GET /refunds/history
   */
  @Get('history')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getAllRefundHistory(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.refundsService.getAllRefundHistory(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }
}