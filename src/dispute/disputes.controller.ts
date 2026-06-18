import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, ParseUUIDPipe, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard'; // Matches project guard references
import { ResolutionAction } from './disputes.entity';

@ApiTags('Dispute Resolution')
@Controller()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @ApiOperation({ summary: 'Raise a dispute on an active order' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', example: 'Product received damaged.' } } } })
  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/dispute')
  async raise(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new Error('A valid material reason text is required to file a dispute record.');
    }
    // Parses user identity key cleanly to an integer number format
    return await this.disputesService.raiseDispute(orderId, Number(req.user.id), reason);
  }

  @ApiOperation({ summary: 'List all ongoing platform disputes (Admin Only)' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('disputes')
  async listOpenCases() {
    return await this.disputesService.findAllOpenDisputes();
  }

  @ApiOperation({ summary: 'Resolve a pending dispute case (Admin Only)' })
  @ApiBody({ schema: { type: 'object', required: ['resolution', 'action'], properties: { resolution: { type: 'string' }, action: { type: 'string', enum: ['REFUND_TO_BUYER', 'RELEASE_TO_SELLER'] } } } })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('disputes/:id/resolve')
  async resolve(
    @Param('id', ParseUUIDPipe) disputeId: string,
    @Body('resolution') resolution: string,
    @Body('action') action: ResolutionAction,
  ) {
    if (!resolution || !action) {
      throw new Error('Resolution explanatory texts and explicit resolution target action steps are required.');
    }
    return await this.disputesService.resolveDispute(disputeId, resolution, action);
  }
}