import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FraudService } from './fraud.service';
import { FraudAlert } from './entities/fraud-alert.entity';
import { FraudController } from './fraud.controller';
import { RequestMonitorMiddleware } from './middleware/request-monitor.middleware';
import { AdminModule } from '../admin/admin.module';
import { GeolocationService } from '../geolocation/geolocation.service';
import { Order } from '../orders/entities/order.entity';
import { User } from '../entities/user.entity';
import { CacheModule } from '../cache/cache.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FraudAlert, Order, User]),
    AdminModule,
    CacheModule,
    AuditModule,
    EventEmitterModule.forRoot(),
  ],
  providers: [FraudService, RequestMonitorMiddleware, GeolocationService],
  controllers: [FraudController],
  exports: [FraudService],
})
export class FraudModule {}
