import {
  Injectable,
  NestMiddleware,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface IPBlockConfig {
  blockedIPs: Set<string>;
  allowedIPs?: Set<string>;
  whitelist?: string[];
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);
  private readonly ipBlockConfig: IPBlockConfig = {
    blockedIPs: new Set(),
    allowedIPs: new Set(),
    whitelist: process.env.IP_WHITELIST?.split(',') || [],
  };

  private readonly maxRequestSize = process.env.MAX_REQUEST_SIZE || '10mb';
  private readonly maxJsonSize = process.env.MAX_JSON_SIZE || '10mb';
  private readonly maxUrlEncodedSize = process.env.MAX_URLENCODED_SIZE || '10mb';
  private readonly maxFileSize = process.env.MAX_FILE_SIZE || '50mb';

  // Security headers configuration
  private readonly securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };

  constructor() {
    this.initializeBlockedIPs();
  }

  use(req: Request, res: Response, next: NextFunction): void {
    try {
      // 1. Check IP blocking/whitelisting
      this.checkIPRestrictions(req);

      // 2. Validate request size
      this.validateRequestSize(req);

      // 3. Apply security headers
      this.applySecurityHeaders(res);

      // 4. Sanitize request
      this.sanitizeRequest(req);

      // 5. Log security-relevant information
      this.logRequestInfo(req);

      next();
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.logger.warn(`Security violation: ${error.message} from ${this.getClientIP(req)}`);
        res.status(error.getStatus()).json({
          statusCode: error.getStatus(),
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        next(error);
      }
    }
  }

  /**
   * Check if IP is blocked or not whitelisted
   */
  private checkIPRestrictions(req: Request): void {
    const clientIP = this.getClientIP(req);

    // Check whitelist if enabled
    if (this.ipBlockConfig.whitelist && this.ipBlockConfig.whitelist.length > 0) {
      const isWhitelisted = this.ipBlockConfig.whitelist.some((ip) =>
        this.ipMatches(clientIP, ip),
      );

      if (!isWhitelisted) {
        throw new BadRequestException(
          `Access denied. Your IP ${clientIP} is not whitelisted.`,
        );
      }
    }

    // Check if IP is explicitly blocked
    if (this.ipBlockConfig.blockedIPs.has(clientIP)) {
      throw new BadRequestException(
        `Access denied. Your IP ${clientIP} has been blocked due to suspicious activity.`,
      );
    }
  }

  /**
   * Validate request payload size
   */
  private validateRequestSize(req: Request): void {
    const contentLength = parseInt(
      req.headers['content-length'] || '0',
      10,
    );

    // Convert size limits to bytes
    const maxJsonBytes = this.parseSize(this.maxJsonSize);
    const maxUrlEncodedBytes = this.parseSize(this.maxUrlEncodedSize);
    const maxFileBytes = this.parseSize(this.maxFileSize);

    let maxAllowed = maxJsonBytes;

    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      maxAllowed = maxUrlEncodedBytes;
    } else if (req.headers['content-type']?.includes('multipart/form-data')) {
      maxAllowed = maxFileBytes;
    }

    if (contentLength > maxAllowed) {
      throw new BadRequestException(
        `Request payload too large. Max size: ${this.maxRequestSize}`,
      );
    }
  }

  /**
   * Apply security headers to response
   */
  private applySecurityHeaders(res: Response): void {
    Object.entries(this.securityHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });

    // Add CORS headers if configured
    if (process.env.CORS_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN);
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '3600');
    }
  }

  /**
   * Sanitize request data
   */
  private sanitizeRequest(req: Request): void {
    // Remove sensitive headers
    const sensitiveHeaders = [
      'x-api-key',
      'authorization',
      'cookie',
      'x-forwarded-for',
    ];

    sensitiveHeaders.forEach((header) => {
      if (req.headers[header]) {
        // Headers are logged separately, don't log sensitive data
        req.headers[header] = '***REDACTED***';
      }
    });

    // Prevent parameter pollution
    if (Array.isArray(req.query) || Array.isArray(req.body)) {
      throw new BadRequestException('Invalid request format');
    }
  }

  /**
   * Log security-relevant request information
   */
  private logRequestInfo(req: Request): void {
    const clientIP = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const method = req.method;
    const path = req.path;

    this.logger.debug(
      `[SECURITY] ${method} ${path} | IP: ${clientIP} | UserAgent: ${userAgent.substring(0, 50)}`,
    );

    // Log suspicious patterns
    if (this.isSuspiciousRequest(req)) {
      this.logger.warn(
        `[SUSPICIOUS] Potential attack pattern detected from ${clientIP}: ${method} ${path}`,
      );
    }
  }

  /**
   * Detect suspicious request patterns
   */
  private isSuspiciousRequest(req: Request): boolean {
    const path = req.path.toLowerCase();
    const queryString = JSON.stringify(req.query).toLowerCase();
    const body = JSON.stringify(req.body || {}).toLowerCase();

    // Check for common injection patterns
    const injectionPatterns = [
      /(\bor\b|\band\b|union|select|drop|insert|update|delete|exec|script|javascript|onerror|onclick)/i,
      /(<script|javascript:|on\w+\s*=|eval\(|alert\()/i,
      /\.\.\/\.\.\/|\.\.%2f%2f/i, // Path traversal
      /\x00|%00/, // Null byte injection
    ];

    const checkString = `${path}${queryString}${body}`;

    return injectionPatterns.some((pattern) => pattern.test(checkString));
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    let clientIP: string;

    if (typeof forwarded === 'string') {
      clientIP = forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      clientIP = forwarded[0];
    } else if (typeof req.headers['x-real-ip'] === 'string') {
      clientIP = req.headers['x-real-ip'];
    } else if (typeof req.socket.remoteAddress === 'string') {
      clientIP = req.socket.remoteAddress;
    } else {
      clientIP = 'unknown';
    }

    return clientIP.trim();
  }

  /**
   * Check if IP matches pattern (supports wildcards)
   */
  private ipMatches(ip: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === ip) return true;

    // Support CIDR notation or wildcards in simple cases
    const patternRegex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    return new RegExp(`^${patternRegex}$`).test(ip);
  }

  /**
   * Initialize blocked IPs from environment or database
   */
  private initializeBlockedIPs(): void {
    const blockedIPsEnv = process.env.BLOCKED_IPS || '';
    if (blockedIPsEnv) {
      blockedIPsEnv.split(',').forEach((ip) => {
        this.ipBlockConfig.blockedIPs.add(ip.trim());
      });
    }

    this.logger.debug(
      `Initialized with ${this.ipBlockConfig.blockedIPs.size} blocked IPs`,
    );
  }

  /**
   * Add IP to blocklist (call from admin endpoints)
   */
  public blockIP(ip: string): void {
    this.ipBlockConfig.blockedIPs.add(ip);
    this.logger.warn(`IP ${ip} has been blocked`);
  }

  /**
   * Remove IP from blocklist
   */
  public unblockIP(ip: string): void {
    this.ipBlockConfig.blockedIPs.delete(ip);
    this.logger.warn(`IP ${ip} has been unblocked`);
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    };

    const match = size.match(/^(\d+)(kb|mb|gb|b)?$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const amount = parseInt(match[1], 10);
    const unit = (match[2] || 'b').toLowerCase();

    return amount * (units[unit as keyof typeof units] || 1);
  }
}
