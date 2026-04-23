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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
    return this.refundsService.reviewReturnRequest(id, dto, req.user.id);
  }
}
