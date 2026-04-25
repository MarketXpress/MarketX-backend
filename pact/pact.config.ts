/**
 * Pact Configuration
 * 
 * Central configuration for Consumer-Driven Contract Testing
 */

// Ensure `process` is available in environments without Node type defs
declare const process: {
  env: { [key: string]: string | undefined };
};

export const PACT_CONFIG = {
  // Provider details
  provider: {
    name: 'MarketX-Backend',
    version: process.env.npm_package_version || '0.0.1',
  },

  // Pact Broker configuration
  broker: {
    url: process.env.PACT_BROKER_URL || 'http://localhost:9292',
    token: process.env.PACT_BROKER_TOKEN || '',
    username: process.env.PACT_BROKER_USERNAME || '',
    password: process.env.PACT_BROKER_PASSWORD || '',
  },

  // Provider verification settings
  verification: {
    providerBaseUrl: process.env.PROVIDER_BASE_URL || 'http://localhost:3000',
    publishVerificationResult: process.env.CI === 'true',
    providerVersionTags: [
      process.env.GIT_BRANCH || 'local',
      process.env.NODE_ENV || 'development',
    ],
    providerVersion: process.env.GIT_COMMIT || 'local',
    enablePending: true,
    includeWipPactsSince: process.env.WIP_PACTS_SINCE,
  },

  // Consumer contract paths
  contracts: {
    dir: './pact/contracts',
    pattern: '**/*.json',
  },

  // Logging
  log: './pact/logs',
  logLevel: (process.env.PACT_LOG_LEVEL || 'info') as
    | 'trace'
    | 'debug'
    | 'info'
    | 'warn'
    | 'error',

  // State handlers directory
  stateHandlers: './pact/state-handlers',
};

/**
 * Consumer names for different frontend applications
 */
export const CONSUMERS = {
  WEB_APP: 'MarketX-Web-Frontend',
  MOBILE_APP: 'MarketX-Mobile-App',
  ADMIN_PANEL: 'MarketX-Admin-Panel',
} as const;

/**
 * API endpoints that are contract-tested
 */
export const CONTRACT_ENDPOINTS = {
  PRODUCTS: {
    LIST: '/products',
    GET: '/products/:id',
    CREATE: '/products',
    UPDATE: '/products/:id',
    DELETE: '/products/:id',
  },
  ORDERS: {
    LIST: '/orders',
    GET: '/orders/:id',
    CREATE: '/orders',
    UPDATE_STATUS: '/orders/:id/status',
    CANCEL: '/orders/:id/cancel',
  },
  USERS: {
    PROFILE: '/users/profile',
    UPDATE: '/users/profile',
  },
  PAYMENTS: {
    CREATE: '/payments',
    STATUS: '/payments/:id',
  },
} as const;
