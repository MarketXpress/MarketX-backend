import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PriceService } from './price.service';
import { ConvertDto, ConversionResultDto, RatesResponseDto } from './dto/conversion.dto';
import { Public } from 'src/decorators/roles.decorator';

@ApiTags('Price')
@ApiSecurity('x-api-key')
@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Public()
  @Get('rates')
  @ApiOperation({ summary: 'Get current XLM, USDC, and USD exchange rates' })
  getRates(): RatesResponseDto {
    const rates = this.priceService.getRates();
    return {
      ...rates,
      cachedAt: rates.cachedAt.toISOString(),
    };
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert between XLM, USDC, and USD' })
  convert(@Body() dto: ConvertDto): ConversionResultDto {
    const { result, rate, cachedAt, source } = this.priceService.convert(
      dto.from,
      dto.to,
      dto.amount,
    );
    return {
      from: dto.from,
      to: dto.to,
      amount: dto.amount,
      result,
      rate,
      cachedAt: cachedAt.toISOString(),
      source,
    } as any;
  }
}