import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';

import { AdminController } from './admin.controller';
import { AdminFraudController } from './admin-fraud.controller';
import { AdminEscrowController } from './admin-escrow.controller';
import { AdminTaxExportController } from './admin-tax-export.controller';

import { AdminService } from './admin.service';
import { AdminWebhookService } from './admin-webhook.service';
import { AdminTaxExportService } from './admin-tax-export.service';

import { Order } from '../orders/entities/order.entity';
import { User } from 'src/profile/user.entity';
import { FraudAlert } from '../fraud/entities/fraud-alert.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Order, FraudAlert]),
    HttpModule,
    // MailerModule is expected to be configured globally in AppModule
    // (MailerModule.forRootAsync({ ... })). No re-import needed here
    // unless you want a module-scoped override.
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
