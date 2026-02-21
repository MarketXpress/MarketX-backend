import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { MessagesModule } from './messages/messages.module';
import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logger/logger.module';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { ThrottleGuard } from './common/guards/throttle.guard';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { HealthModule } from './health/health.module';
import { PaymentsModule } from './payments/payments.module';
import { CustomI18nModule } from './i18n/i18n.module';
import { PriceModule } from './price/price.module';
import { UserVerification } from './verification/user-verification.entity';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      migrations: ['dist/migrations/*.js'],
      migrationsRun: false,
    }),
    PriceModule,
    MessagesModule,
    CommonModule,
    LoggerModule,
    HealthModule,
    PaymentsModule,
    ProductsModule,
    CustomI18nModule,
    VerificationModule,
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
  exports: [AdminGuard, RolesGuard, LoggerModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
