import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';

class ConvertCurrencyDto {
  amount: number;
  from: string;
  to: string;
}

@ApiTags('Currency')
@Controller('currency')
export class CurrencyController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get current exchange rates' })
  async getRates() {
    return await this.exchangeRateService.getRates();
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert amount between currencies' })
  async convert(@Body() dto: ConvertCurrencyDto) {
    return await this.currencyService.convert(dto.amount, dto.from, dto.to);
  }
}
