import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PricingService } from './services/pricing.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [ProductsController],
  providers: [ProductsService, PricingService],
  exports: [PricingService],
})
export class ProductsModule {}
