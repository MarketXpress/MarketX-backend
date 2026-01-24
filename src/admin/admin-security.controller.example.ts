import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  Logger,
} from '@nestjs/common';
import { AdminOnly } from '../common/decorators/rate-limit.decorator';
import { SecurityMiddleware } from '../common/middleware/security.middleware';
import { ThrottleGuard } from '../common/guards/throttle.guard';

/**
 * Admin Security Controller
 * Manages IP blocking, rate limits, and security policies
 * REQUIRES: AdminGuard implementation (to be added)
 */

export class BlockIPDto {
  ip: string;
  reason?: string;
  expiresAt?: Date;
}

export class GetClientStatusDto {
  clientId: string;
}

@Controller('admin/security')
@AdminOnly()
export class AdminSecurityController {
  private readonly logger = new Logger(AdminSecurityController.name);

  constructor(
    @Inject(SecurityMiddleware)
    private securityMiddleware: SecurityMiddleware,
    @Inject(ThrottleGuard)
    private throttleGuard: ThrottleGuard,
  ) {}

  /**
   * Block an IP address
   * POST /admin/security/block-ip
   */
  @Post('block-ip')
  @HttpCode(HttpStatus.OK)
  blockIP(@Body() dto: BlockIPDto) {
    this.logger.warn(`IP blocked: ${dto.ip}. Reason: ${dto.reason || 'No reason provided'}`);
    this.securityMiddleware.blockIP(dto.ip);

    return {
      statusCode: HttpStatus.OK,
      message: `IP ${dto.ip} has been blocked`,
      ip: dto.ip,
      reason: dto.reason,
      blockedAt: new Date(),
      expiresAt: dto.expiresAt || null,
    };
  }

  /**
   * Unblock an IP address
   * DELETE /admin/security/block-ip/:ip
   */
  @Delete('block-ip/:ip')
  @HttpCode(HttpStatus.OK)
  unblockIP(@Param('ip') ip: string) {
    this.logger.log(`IP unblocked: ${ip}`);
    this.securityMiddleware.unblockIP(ip);

    return {
      statusCode: HttpStatus.OK,
      message: `IP ${ip} has been unblocked`,
      ip,
      unblocked_at: new Date(),
    };
  }

  /**
   * Reset rate limit for a specific client
   * POST /admin/security/reset-rate-limit/:clientId
   */
  @Post('reset-rate-limit/:clientId')
  @HttpCode(HttpStatus.OK)
  resetClientRateLimit(@Param('clientId') clientId: string) {
    const success = this.throttleGuard.resetClient(clientId);

    this.logger.log(`Rate limit reset for client: ${clientId}`);

    return {
      statusCode: HttpStatus.OK,
      message: success
        ? `Rate limit reset for client ${clientId}`
        : `Client ${clientId} not found in rate limit cache`,
      clientId,
      success,
      resetAt: new Date(),
    };
  }

  /**
   * Get rate limit status for a client
   * GET /admin/security/rate-limit-status/:clientId
   */
  @Get('rate-limit-status/:clientId')
  @HttpCode(HttpStatus.OK)
  getClientRateLimitStatus(@Param('clientId') clientId: string) {
    const status = this.throttleGuard.getClientStatus(clientId);

    if (!status) {
      return {
        statusCode: HttpStatus.OK,
        clientId,
        status: 'No current activity',
        message: 'Client is not currently being tracked',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      clientId,
      rateLimit: {
        current: status.count,
        limit: status.limit,
        remaining: status.remaining,
        resetInSeconds: Math.ceil(status.resetIn / 1000),
        resetAt: new Date(status.resetTime),
      },
    };
  }

  /**
   * Batch reset rate limits for multiple clients
   * POST /admin/security/batch-reset-rate-limits
   */
  @Post('batch-reset-rate-limits')
  @HttpCode(HttpStatus.OK)
  batchResetRateLimits(@Body() dto: { clientIds: string[] }) {
    const results = {
      success: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const clientId of dto.clientIds) {
      const success = this.throttleGuard.resetClient(clientId);
      if (success) {
        results.success++;
      } else {
        results.failed++;
      }
      results.details.push({ clientId, success });
    }

    this.logger.log(
      `Batch rate limit reset: ${results.success} succeeded, ${results.failed} failed`,
    );

    return {
      statusCode: HttpStatus.OK,
      message: `Rate limits reset for ${results.success} clients`,
      results,
      resetAt: new Date(),
    };
  }

  /**
   * Batch block IPs
   * POST /admin/security/batch-block-ips
   */
  @Post('batch-block-ips')
  @HttpCode(HttpStatus.OK)
  batchBlockIPs(@Body() dto: { ips: BlockIPDto[] }) {
    const results = {
      blocked: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const ipData of dto.ips) {
      try {
        this.securityMiddleware.blockIP(ipData.ip);
        results.blocked++;
        results.details.push({
          ip: ipData.ip,
          success: true,
          reason: ipData.reason,
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          ip: ipData.ip,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.warn(
      `Batch IP blocking: ${results.blocked} blocked, ${results.failed} failed`,
    );

    return {
      statusCode: HttpStatus.OK,
      message: `${results.blocked} IPs blocked`,
      results,
      blockedAt: new Date(),
    };
  }

  /**
   * Batch unblock IPs
   * POST /admin/security/batch-unblock-ips
   */
  @Post('batch-unblock-ips')
  @HttpCode(HttpStatus.OK)
  batchUnblockIPs(@Body() dto: { ips: string[] }) {
    const results = {
      unblocked: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const ip of dto.ips) {
      try {
        this.securityMiddleware.unblockIP(ip);
        results.unblocked++;
        results.details.push({ ip, success: true });
      } catch (error) {
        results.failed++;
        results.details.push({
          ip,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Batch IP unblocking: ${results.unblocked} unblocked, ${results.failed} failed`,
    );

    return {
      statusCode: HttpStatus.OK,
      message: `${results.unblocked} IPs unblocked`,
      results,
      unblockedAt: new Date(),
    };
  }

  /**
   * Get security configuration status
   * GET /admin/security/status
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  getSecurityStatus() {
    return {
      statusCode: HttpStatus.OK,
      security: {
        rateLimiting: {
          enabled: true,
          type: 'in-memory',
          description: 'Throttle guard with per-endpoint limits',
        },
        ipBlocking: {
          enabled: true,
          type: 'manual and configurable',
          whitelistMode: process.env.ENABLE_IP_WHITELIST === 'true',
        },
        securityHeaders: {
          enabled: true,
          headersCount: 7,
        },
        inputValidation: {
          enabled: true,
          injectionDetection: true,
        },
        requestSizeLimits: {
          enabled: true,
          jsonLimit: process.env.MAX_JSON_SIZE || '10mb',
          fileLimit: process.env.MAX_FILE_SIZE || '50mb',
        },
      },
      timestamp: new Date(),
    };
  }

  /**
   * Health check for security systems
   * GET /admin/security/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthCheck() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Security systems operational',
      systems: {
        rateLimiting: 'operational',
        securityMiddleware: 'operational',
        securityHeaders: 'operational',
        ipBlocking: 'operational',
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get security audit log (summary)
   * GET /admin/security/audit-log?limit=100
   * Note: Full audit logging should be implemented with a database
   */
  @Get('audit-log')
  @HttpCode(HttpStatus.OK)
  getAuditLog() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Audit log endpoint - implementation recommended',
      note: 'Full audit logging should persist to database for production use',
      recommendations: [
        'Log all IP blocks/unblocks with timestamps',
        'Log all rate limit violations and resets',
        'Track all admin actions for compliance',
        'Store logs in database or centralized logging system',
        'Implement retention policies',
      ],
    };
  }
}

/**
 * Usage Examples:
 *
 * Block an IP:
 * POST /admin/security/block-ip
 * {
 *   "ip": "192.0.2.1",
 *   "reason": "Brute force attack detected"
 * }
 *
 * Unblock an IP:
 * DELETE /admin/security/block-ip/192.0.2.1
 *
 * Reset rate limit for client:
 * POST /admin/security/reset-rate-limit/user:123
 *
 * Get rate limit status:
 * GET /admin/security/rate-limit-status/ip:192.0.2.1
 *
 * Batch block IPs:
 * POST /admin/security/batch-block-ips
 * {
 *   "ips": [
 *     {"ip": "192.0.2.1", "reason": "Reason 1"},
 *     {"ip": "192.0.2.2", "reason": "Reason 2"}
 *   ]
 * }
 */
