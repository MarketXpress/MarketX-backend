import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionGuard } from './guards/subscription.guard';
import { Subscription } from './entities/subscription.entity';
import { Users } from '../users/users.entity';
import { Listing } from '../listing/entities/listing.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Users, Listing]),
    ScheduleModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionGuard],
  exports: [SubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
