import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PricingService } from './services/pricing.service';
import { ProductImagesController } from './product-images.controller';
import { ProductPriceEntity } from './entities/product-price.entity';
import { Product } from '../entities/product.entity';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([Product, ProductPriceEntity]),
  ],
  controllers: [ProductsController, ProductImagesController],
  providers: [ProductsService, PricingService],
  exports: [ProductsService, PricingService, TypeOrmModule],
})
export class ProductsModule {}
