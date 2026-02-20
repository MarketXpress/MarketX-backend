import { Body, Controller, Get, Post } from '@nestjs/common';
import { PriceService } from './price.service';
import { ConversionDto } from './dto/conversion.dto';

@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Get('rates')
  async getRates() {
    return this.priceService.getRates();
  }

  @Post('convert')
  async convert(@Body() dto: ConversionDto) {
    return this.priceService.convert(dto.from, dto.to, dto.amount);
  }
}