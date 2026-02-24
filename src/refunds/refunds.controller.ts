import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { RequestRefundDto } from './dto/request-refund.dto';
import { ApproveRefundDto } from './dto/approve-refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RefundStatus } from './entities/refund.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  // POST /orders/:id/refund — buyer submits return request
  @Post('orders/:id/refund')
  requestRefund(
    @Param('id') orderId: string,
    @Body() dto: RequestRefundDto,
    @Req() req: any,
  ) {
    return this.refundsService.requestRefund(orderId, req.user.id, dto);
  }

  // GET /orders/:id/refunds — buyer/admin views refunds for an order
  @Get('orders/:id/refunds')
  getRefundsByOrder(@Param('id') orderId: string) {
    return this.refundsService.findByOrder(orderId);
  }

  // GET /refunds/me — buyer views their own refund history
  @Get('refunds/me')
  getMyRefunds(@Req() req: any, @Query('status') status?: RefundStatus) {
    return this.refundsService.findAll({ buyerId: req.user.id, status });
  }

  // GET /refunds/:id — view single refund
  @Get('refunds/:id')
  getRefund(@Param('id') id: string) {
    return this.refundsService.findOne(id);
  }

  // PATCH /admin/refunds/:id/approve — admin approves
  @Patch('admin/refunds/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  approveRefund(
    @Param('id') id: string,
    @Body() dto: ApproveRefundDto,
    @Req() req: any,
  ) {
    return this.refundsService.approveRefund(id, req.user.id, dto);
  }

  // PATCH /admin/refunds/:id/reject — admin rejects
  @Patch('admin/refunds/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin')
  rejectRefund(
    @Param('id') id: string,
    @Body('adminNotes') adminNotes: string,
    @Req() req: any,
  ) {
    return this.refundsService.rejectRefund(id, req.user.id, adminNotes);
  }

  // GET /admin/refunds — admin views all refunds
  @Get('admin/refunds')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getAllRefunds(@Query('status') status?: RefundStatus) {
    return this.refundsService.findAll({ status });
  }
}
