import { Controller, Get, Query } from '@nestjs/common';
import { FraudService } from './fraud.service';

@Controller('fraud')
export class FraudController {
  constructor(private readonly fraud: FraudService) {}

  @Get('alerts')
  async list(@Query('page') page?: number, @Query('pageSize') pageSize?: number) {
    return this.fraud.getAlerts({ page: Number(page) || 1, pageSize: Number(pageSize) || 25 });
  }
}
