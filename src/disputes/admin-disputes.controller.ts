import { Controller, Get, Param, Patch, Body, Query, Post, UseGuards } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('admin/disputes')
@UseGuards(RolesGuard)
export class AdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @Roles('ADMIN')
  async listAllDisputes(@Query('status') status?: string) {
    return this.disputesService.listDisputes(status ? { status: status as any } : undefined);
  }

  @Get(':id')
  @Roles('ADMIN')
  async getDispute(@Param('id') id: string) {
    return this.disputesService.getDisputeById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async updateDispute(@Param('id') id: string, @Body() dto: UpdateDisputeDto) {
    dto.disputeId = id;
    return this.disputesService.adminUpdateDispute(dto);
  }

  @Post('auto-resolve')
  @Roles('ADMIN')
  async autoResolve() {
    return { resolved: await this.disputesService.autoResolveDisputes() };
  }

  @Post(':id/resolve')
  @Roles('ADMIN')
  async resolveDispute(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputesService.adminResolveDispute(dto, id);
  }
} 