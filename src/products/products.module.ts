import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PricingService } from './services/pricing.service';
import { ProductImagesController } from './product-images.controller';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [EventEmitterModule.forRoot(), MediaModule],
  controllers: [ProductsController, ProductImagesController],
  providers: [ProductsService, PricingService],
  exports: [PricingService],
})
export class ProductsModule {}
