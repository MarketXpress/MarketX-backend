import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    MessagesModule,
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
  exports: [AdminGuard, RolesGuard, ThrottleGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
