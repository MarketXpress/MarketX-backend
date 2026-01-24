/**
 * Rate Limiting Configuration
 * Centralized configuration for all rate limiting rules
 */

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const RATE_LIMIT_CONFIG = {
  // Authentication endpoints - very strict
  AUTH: {
    limit: parseInt(process.env.RATE_LIMIT_AUTH_LIMIT || '5', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || '900000', 10), // 15 minutes
  },

  // Login attempts - strict
  LOGIN: {
    limit: parseInt(process.env.RATE_LIMIT_LOGIN_LIMIT || '5', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW || '900000', 10),
  },

  // Registration - moderate
  REGISTER: {
    limit: parseInt(process.env.RATE_LIMIT_REGISTER_LIMIT || '3', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || '3600000', 10), // 1 hour
  },

  // Password reset - strict
  PASSWORD_RESET: {
    limit: parseInt(process.env.RATE_LIMIT_PASSWORD_LIMIT || '3', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_PASSWORD_WINDOW || '3600000', 10),
  },

  // General API - standard
  API: {
    limit: parseInt(process.env.RATE_LIMIT_API_LIMIT || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW || '900000', 10),
  },

  // File uploads - moderate
  UPLOAD: {
    limit: parseInt(process.env.RATE_LIMIT_UPLOAD_LIMIT || '10', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW || '3600000', 10),
  },

  // Transactions - strict
  TRANSACTION: {
    limit: parseInt(process.env.RATE_LIMIT_TRANSACTION_LIMIT || '20', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_TRANSACTION_WINDOW || '60000', 10), // 1 minute
  },

  // Payments - strict
  PAYMENT: {
    limit: parseInt(process.env.RATE_LIMIT_PAYMENT_LIMIT || '10', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_PAYMENT_WINDOW || '3600000', 10),
  },

  // Search - moderate
  SEARCH: {
    limit: parseInt(process.env.RATE_LIMIT_SEARCH_LIMIT || '30', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_SEARCH_WINDOW || '300000', 10), // 5 minutes
  },

  // Export/Download - moderate
  EXPORT: {
    limit: parseInt(process.env.RATE_LIMIT_EXPORT_LIMIT || '5', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_EXPORT_WINDOW || '3600000', 10),
  },
} as const;

/**
 * Security Headers Configuration
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security':
    process.env.HSTS_MAX_AGE || 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': process.env.CSP_POLICY || "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
} as const;

/**
 * Request Size Limits Configuration
 */
export const REQUEST_SIZE_LIMITS = {
  JSON: process.env.MAX_JSON_SIZE || '10mb',
  URLENCODED: process.env.MAX_URLENCODED_SIZE || '10mb',
  FILE: process.env.MAX_FILE_SIZE || '50mb',
} as const;

/**
 * IP Blocking Configuration
 */
export const IP_BLOCKING_CONFIG = {
  BLOCKED_IPS: process.env.BLOCKED_IPS?.split(',') || [],
  WHITELIST_IPS: process.env.IP_WHITELIST?.split(',') || [],
  ENABLE_WHITELIST: process.env.ENABLE_IP_WHITELIST === 'true',
} as const;

/**
 * CORS Configuration
 */
export const CORS_CONFIG = {
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
  ],
  credentials: true,
  maxAge: 3600,
} as const;

/**
 * Suspicious Pattern Detection Configuration
 */
export const SUSPICIOUS_PATTERNS = [
  /(\bor\b|\band\b|union|select|drop|insert|update|delete|exec|script|javascript|onerror|onclick)/i,
  /(<script|javascript:|on\w+\s*=|eval\(|alert\()/i,
  /\.\.\/\.\.\/|\.\.%2f%2f/i, // Path traversal
  /\x00|%00/, // Null byte injection
  /;.*drop|;.*delete|;.*exec/i, // SQL injection
] as const;
