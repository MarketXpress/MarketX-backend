import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudService } from './fraud.service';
import { FraudAlert } from './entities/fraud-alert.entity';
import { FraudController } from './fraud.controller';
import { RequestMonitorMiddleware } from './middleware/request-monitor.middleware';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([FraudAlert]), AdminModule],
  providers: [FraudService, RequestMonitorMiddleware],
  controllers: [FraudController],
  exports: [FraudService],
})
export class FraudModule {}
