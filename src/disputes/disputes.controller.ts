import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post('/orders/:id/dispute')
  create(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() createDisputeDto: CreateDisputeDto,
  ) {
    // Assume buyerId is from auth, for now hardcoded or from request
    const buyerId = 1; // TODO: Get from JWT
    return this.disputesService.create(orderId, buyerId, createDisputeDto);
  }

  @Get()
  findAll() {
    return this.disputesService.findAll();
  }

  @Patch(':id/resolve')
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() resolveDisputeDto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(id, resolveDisputeDto.adminDecision, resolveDisputeDto.refundAmount);
  }
}