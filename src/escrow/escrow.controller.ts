import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Escrow')
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @ApiOperation({ summary: 'Lock funds in escrow' })
  async createEscrow(
    @Body()
    body: {
      orderId: string;
      buyerPublicKey: string;
      sellerPublicKey: string;
      buyerSecretKey?: string;
      amount: number;
    },
  ) {
    return await this.escrowService.createEscrow(body);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Retrieve escrow record by order ID' })
  async getEscrowByOrderId(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return await this.escrowService.findByOrderId(orderId);
  }
}
