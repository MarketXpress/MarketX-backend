import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AdminController } from './admin.controller';
import { AdminFraudController } from './admin-fraud.controller';
import { AdminEscrowController } from './admin-escrow.controller';
import { AdminTaxExportController } from './admin-tax-export.controller';

import { AdminService } from './admin.service';
import { AdminWebhookService } from './admin-webhook.service';
import { AdminTaxExportService } from './admin-tax-export.service';

import { Order } from '../orders/entities/order.entity';
import { Users } from '../users/users.entity';
import { FraudAlert } from '../fraud/entities/fraud-alert.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Users, Order, FraudAlert]),
    HttpModule,
    EventEmitterModule.forRoot(),
    AuditModule,
    MailerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        transport: {
          service: 'Sendgrid',
          auth: {
            user: 'apikey',
            pass: configService.get<string>('SENDGRID_API_KEY') || '',
          },
        },
        defaults: {
          from:
            configService.get<string>('EMAIL_FROM') || 'noreply@marketx.com',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AdminController,
    AdminFraudController,
    // AdminEscrowController,   // uncomment once the escrow module is ready
    AdminTaxExportController,
  ],
  providers: [AdminService, AdminWebhookService, AdminTaxExportService],
  exports: [AdminService, AdminWebhookService, AdminTaxExportService],
})
export class AdminModule {}
