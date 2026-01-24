import { Injectable } from '@nestjs/common';
import { CreateMarketPlaceDto } from './dto/create-market-place.dto';
import { UpdateMarketPlaceDto } from './dto/update-market-place.dto';

@Injectable()
export class MarketPlaceService {
  create(createMarketPlaceDto: CreateMarketPlaceDto) {
    return 'This action adds a new marketPlace';
  }

  findAll() {
    return `This action returns all marketPlace`;
  }

  findOne(id: number) {
    return `This action returns a #${id} marketPlace`;
  }

  update(id: number, updateMarketPlaceDto: UpdateMarketPlaceDto) {
    return `This action updates a #${id} marketPlace`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketPlace`;
  }
}
