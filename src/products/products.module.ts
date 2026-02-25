import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PricingService } from './services/pricing.service';
import { ProductImagesController } from './product-images.controller';
import { ProductPriceEntity } from './entities/product-price.entity';
import { MediaModule } from '../media/media.module';
import { PriceModule } from '../price/price.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MediaModule,
    PriceModule,
    TypeOrmModule.forFeature([ProductPriceEntity]),
  ],
  controllers: [ProductsController, ProductImagesController],
  providers: [ProductsService, PricingService],
  exports: [PricingService],
})
export class ProductsModule {}
