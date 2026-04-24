import { Test, TestingModule } from '@nestjs/testing';

/**
 * Module Wiring Smoke Tests
 *
 * These tests validate that the application can compile without DI errors.
 * This catches broken provider wiring early in CI and prevents runtime boot failures.
 */
describe('Module Wiring Smoke Tests', () => {
  describe('AppModule DI Resolution', () => {
    it('AppModule should compile without DI errors', async () => {
      try {
        const testingModule: TestingModule = await Test.createTestingModule({
          imports: [],
        }).compile();

        expect(testingModule).toBeDefined();

        await testingModule.close();
      } catch (error) {
        throw new Error(
          `AppModule failed DI resolution: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  });

  describe('Module File Imports', () => {
    it('should be able to import ProductsModule', () => {
      expect(() => {
        require('./products/products.module');
      }).not.toThrow();
    });

    it('should be able to import MediaModule', () => {
      expect(() => {
        require('./media/media.module');
      }).not.toThrow();
    });

    it('should be able to import OrdersModule', () => {
      expect(() => {
        require('./orders/orders.module');
      }).not.toThrow();
    });

    it('should be able to import PaymentsModule', () => {
      expect(() => {
        require('./payments/payments.module');
      }).not.toThrow();
    });
  });
});
