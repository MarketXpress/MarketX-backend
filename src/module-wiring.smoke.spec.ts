import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from './app.module';

// Feature modules
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AuthModule } from './auth/auth.module';
import { FraudModule } from './fraud/fraud.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { CouponsModule } from './coupons/coupons.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ShippingModule } from './shipping/shipping.module';
import { RefundsModule } from './refunds/refunds.module';
import { ListingsModule } from './listing/listing.module';
import { MilestonesModule } from './milestones/milestones.module';
import { ArchivingModule } from './archiving/archiving.module';

/**
 * Module Wiring Smoke Tests
 *
 * These tests validate that modules can compile without DI errors.
 * They catch broken provider wiring, missing dependencies, and misconfigured modules early.
 * Uses in-memory SQLite for database-dependent modules to avoid external dependencies.
 */
describe('Module Wiring Smoke Tests', () => {
  describe('Full AppModule Boot', () => {
    it('AppModule should compile without unresolved DI dependencies', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      expect(module).toBeDefined();
      await module.close();
    });
  });

  describe('Feature Module DI Resolution', () => {
    // Helper to compile feature modules with required global dependencies
    const compileFeatureModule = (featureModule: any) => {
      return Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
          }),
          featureModule,
        ],
      }).compile();
    };

    it('ProductsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(ProductsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('MediaModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(MediaModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('OrdersModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(OrdersModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('PaymentsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(PaymentsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('AuthModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(AuthModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('FraudModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(FraudModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('AnalyticsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(AnalyticsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('AdminModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(AdminModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('CategoriesModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(CategoriesModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('ChatModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(ChatModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('CouponsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(CouponsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('EmailModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(EmailModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('NotificationsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(NotificationsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('SearchModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(SearchModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('SubscriptionsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(SubscriptionsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('ShippingModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(ShippingModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('RefundsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(RefundsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('ListingsModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(ListingsModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('MilestonesModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(MilestonesModule);
      expect(module).toBeDefined();
      await module.close();
    });

    it('ArchivingModule should compile without DI errors', async () => {
      const module = await compileFeatureModule(ArchivingModule);
      expect(module).toBeDefined();
      await module.close();
    });
  });
});
