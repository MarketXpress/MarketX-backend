import { PartialType } from '@nestjs/mapped-types';
import { CreateMarketPlaceDto } from './create-market-place.dto';

export class UpdateMarketPlaceDto extends PartialType(CreateMarketPlaceDto) {}
