/**
 * Pact State Handlers
 * 
 * Setup application state for contract verification
 * These handlers prepare the backend to match the expected state for each contract test
 */

import { productStateHandlers } from './product.state-handler';
import { orderStateHandlers } from './order.state-handler';
import { userStateHandlers } from './user.state-handler';
import { paymentStateHandlers } from './payment.state-handler';

/**
 * State handler function type
 */
export type StateHandler = (params?: any) => Promise<void>;

/**
 * Combine all state handlers
 */
export function setupStateHandlers(): Record<string, StateHandler> {
  return {
    ...productStateHandlers,
    ...orderStateHandlers,
    ...userStateHandlers,
    ...paymentStateHandlers,
  };
}

/**
 * Base state handler utilities
 */
export const stateUtils = {
  /**
   * Generate a test UUID
   */
  generateTestId: (prefix: string = 'test'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Clean up test data after verification
   */
  cleanupTestData: async (ids: string[]): Promise<void> => {
    // Implement cleanup logic if needed
    console.log(`Cleaning up test data: ${ids.join(', ')}`);
  },

  /**
   * Create mock authentication token
   */
  createMockAuthToken: (): string => {
    return 'mock-auth-token-for-pact-testing';
  },
};
