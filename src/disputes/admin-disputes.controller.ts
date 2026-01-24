import { Controller, Get, Param, Patch, Body, Query, Post } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { UpdateDisputeDto } from './dto/update-dispute.dto';

@Controller('admin/disputes')
export class AdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  async listAllDisputes(@Query('status') status?: string) {
    return this.disputesService.listDisputes(status ? { status: status as any } : undefined);
  }

  @Get(':id')
  async getDispute(@Param('id') id: string) {
    return this.disputesService.getDisputeById(id);
  }

  @Patch(':id')
  async updateDispute(@Param('id') id: string, @Body() dto: UpdateDisputeDto) {
    dto.disputeId = id;
    return this.disputesService.adminUpdateDispute(dto);
  }

  @Post('auto-resolve')
  async autoResolve() {
    return { resolved: await this.disputesService.autoResolveDisputes() };
  }
} 