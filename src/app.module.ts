import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MessagesModule } from './messages/messages.module';
import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    MessagesModule,
    CommonModule,
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AdminGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottleGuard,
    },
  ],
  exports: [AdminGuard, RolesGuard, ThrottleGuard, LoggerModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
