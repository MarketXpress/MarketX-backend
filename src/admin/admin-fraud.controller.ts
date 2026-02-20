import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudAlert } from '../fraud/entities/fraud-alert.entity';
import { JwtAuthGuard } from 'src/Authentication/jwt-auth-guard';
import { AdminGuard } from 'src/guards/admin.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('admin/fraud')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles('admin')
export class AdminFraudController {
  constructor(
    @InjectRepository(FraudAlert)
    private readonly repo: Repository<FraudAlert>,
  ) {}

  @Get('alerts')
  async list() {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  @Patch(':id/review')
  async review(@Param('id') id: string, @Body() body: { mark: 'safe' | 'reviewed' | 'suspended' }) {
    const alert = await this.repo.findOneBy({ id } as any);
    if (!alert) return { error: 'not_found' };
    alert.status = body.mark;
    await this.repo.save(alert);
    return alert;
  }
}
