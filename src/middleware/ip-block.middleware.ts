import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpBlockMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlockMiddleware.name);
  private blacklistedIps: Set<string> = new Set();
  private lastUpdated: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  constructor(private configService: ConfigService) {
    this.loadBlacklistedIps();
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Refresh IP list if cache is stale
      await this.refreshIpListIfNeeded();

      const clientIp = this.getClientIp(req);
      
      if (this.isBlacklisted(clientIp)) {
        this.logBlockedAttempt(req, clientIp);
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Log error but don't block request if IP check fails
      this.logger.error(`IP blocking middleware error: ${error.message}`, error.stack);
      next();
    }
  }

  private getClientIp(req: Request): string {
    // Check various headers for the real IP address
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string;
    
    let clientIp = req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (forwarded) {
      clientIp = forwarded.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp;
    } else if (cfConnectingIp) {
      clientIp = cfConnectingIp;
    }

    // Handle IPv6 mapped IPv4 addresses
    if (clientIp && clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }

    return clientIp || 'unknown';
  }

  private isBlacklisted(ip: string): boolean {
    return this.blacklistedIps.has(ip);
  }

  private async refreshIpListIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastUpdated > this.CACHE_DURATION) {
      await this.loadBlacklistedIps();
    }
  }

  private async loadBlacklistedIps(): Promise<void> {
    try {
      this.blacklistedIps.clear();
      
      // Try to load from environment variable first
      const envIps = this.configService.get<string>('BLACKLISTED_IPS');
      if (envIps) {
        const ips = envIps.split(',').map(ip => ip.trim()).filter(ip => ip);
        ips.forEach(ip => this.blacklistedIps.add(ip));
        this.logger.log(`Loaded ${ips.length} blacklisted IPs from environment`);
      }

      // If you have database integration, uncomment and modify this section:
      /*
      // Load from database (requires database service injection)
      try {
        const dbIps = await this.databaseService.getBlacklistedIps();
        dbIps.forEach(ip => this.blacklistedIps.add(ip));
        this.logger.log(`Loaded ${dbIps.length} additional blacklisted IPs from database`);
      } catch (dbError) {
        this.logger.warn(`Failed to load IPs from database: ${dbError.message}`);
      }
      */

      this.lastUpdated = Date.now();
      this.logger.log(`Total blacklisted IPs loaded: ${this.blacklistedIps.size}`);
      
    } catch (error) {
      this.logger.error(`Failed to load blacklisted IPs: ${error.message}`, error.stack);
      // Keep existing IPs if reload fails
    }
  }

  private logBlockedAttempt(req: Request, clientIp: string): void {
    const logData = {
      timestamp: new Date().toISOString(),
      blockedIp: clientIp,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'] || 'unknown',
      referer: req.headers.referer || 'none',
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip']
      }
    };

    this.logger.warn(`🚫 BLOCKED ACCESS ATTEMPT`, logData);
    
    // Optional: Send to external logging service
    // this.securityService.reportBlockedAttempt(logData);
  }

  // Method to manually refresh IP list (useful for admin endpoints)
  public async forceRefreshIpList(): Promise<void> {
    await this.loadBlacklistedIps();
  }

  // Method to get current blacklist size (useful for monitoring)
  public getBlacklistSize(): number {
    return this.blacklistedIps.size;
  }
}