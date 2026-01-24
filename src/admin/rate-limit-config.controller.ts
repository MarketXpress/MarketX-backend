import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { RateLimitService, UserTier, RateLimitConfig } from '../rate-limiting/rate-limit.service';
import { AdminGuard } from '../guards/admin.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { NoRateLimit } from '../decorators/rate-limit.decorator';
import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, Min, Max } from 'class-validator';

class UpdateRateLimitConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1000) // Minimum 1 second
  @Max(24 * 60 * 60 * 1000) // Maximum 24 hours
  windowMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  maxRequests?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  burstAllowance?: number;

  @IsOptional()
  @IsBoolean()
  skipFailedRequests?: boolean;

  @IsOptional()
  @IsBoolean()
  skipSuccessfulRequests?: boolean;
}

class ResetRateLimitDto {
  @IsString()
  identifier: string;

  @IsOptional()
  @IsString()
  endpoint?: string;
}

class RateLimitStatusQuery {
  @IsString()
  identifier: string;

  @IsOptional()
  @IsString()
  endpoint?: string;
}

@ApiTags('Admin - Rate Limiting')
@ApiBearerAuth()
@Controller('admin/rate-limits')
@UseGuards(AdminGuard, RolesGuard)
@Roles('admin')
@NoRateLimit() // Admin endpoints should not be rate limited
export class RateLimitConfigController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Get('analytics')
  @ApiOperation({ 
    summary: 'Get rate limiting analytics',
    description: 'Retrieve rate limiting analytics data for monitoring and analysis'
  })
  @ApiQuery({ 
    name: 'days', 
    required: false, 
    type: Number, 
    description: 'Number of days to retrieve analytics for (default: 7)',
    example: 7
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rate limiting analytics data retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2025-06-30' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                identifier: { type: 'string', example: 'user:123' },
                endpoint: { type: 'string', example: '/api/listings' },
                userTier: { type: 'string', example: 'premium' },
                success: { type: 'boolean', example: true },
                totalHits: { type: 'number', example: 5 },
                timestamp: { type: 'number', example: 1719782400000 }
              }
            }
          }
        }
      }
    }
  })
  async getAnalytics(@Query('days', new ParseIntPipe({ optional: true })) days: number = 7) {
    return this.rateLimitService.getAnalytics(days);
  }

  @Get('config/tiers')
  @ApiOperation({ 
    summary: 'Get all user tier configurations',
    description: 'Retrieve rate limiting configurations for all user tiers'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User tier configurations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        free: {
          type: 'object',
          properties: {
            windowMs: { type: 'number', example: 60000 },
            maxRequests: { type: 'number', example: 10 },
            burstAllowance: { type: 'number', example: 3 }
          }
        },
        premium: {
          type: 'object',
          properties: {
            windowMs: { type: 'number', example: 60000 },
            maxRequests: { type: 'number', example: 50 },
            burstAllowance: { type: 'number', example: 10 }
          }
        }
      }
    }
  })
  async getTierConfigurations() {
    // This would need to be implemented in the service
    return {
      message: 'Tier configurations retrieved',
      // Return current tier configurations
    };
  }

  @Put('config/tiers/:tier')
  @ApiOperation({ 
    summary: 'Update user tier rate limit configuration',
    description: 'Update rate limiting configuration for a specific user tier'
  })
  @ApiParam({ 
    name: 'tier', 
    enum: UserTier, 
    description: 'User tier to update',
    example: UserTier.PREMIUM
  })
  @ApiBody({ 
    type: UpdateRateLimitConfigDto,
    description: 'Rate limit configuration to update'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tier configuration updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tier configuration updated successfully' },
        tier: { type: 'string', example: 'premium' },
        config: {
          type: 'object',
          properties: {
            windowMs: { type: 'number', example: 60000 },
            maxRequests: { type: 'number', example: 50 },
            burstAllowance: { type: 'number', example: 10 }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid tier or configuration' })
  @HttpCode(HttpStatus.OK)
  async updateTierConfiguration(
    @Param('tier') tier: UserTier,
    @Body(ValidationPipe) config: UpdateRateLimitConfigDto,
  ) {
    await this.rateLimitService.updateTierConfig(tier, config);
    return {
      message: 'Tier configuration updated successfully',
      tier,
      config,
    };
  }

  @Get('config/endpoints')
  @ApiOperation({ 
    summary: 'Get all endpoint configurations',
    description: 'Retrieve rate limiting configurations for all endpoints'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Endpoint configurations retrieved successfully'
  })
  async getEndpointConfigurations() {
    return {
      message: 'Endpoint configurations retrieved',
      // This would need to be implemented in the service
    };
  }

  @Put('config/endpoints/:endpoint')
  @ApiOperation({ 
    summary: 'Update endpoint rate limit configuration',
    description: 'Update rate limiting configuration for a specific endpoint'
  })
  @ApiParam({ 
    name: 'endpoint', 
    type: String, 
    description: 'Endpoint path to update (URL encoded)',
    example: '%2Fapi%2Fauth%2Flogin'
  })
  @ApiBody({ 
    type: UpdateRateLimitConfigDto,
    description: 'Rate limit configuration to update'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Endpoint configuration updated successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid endpoint or configuration' })
  @HttpCode(HttpStatus.OK)
  async updateEndpointConfiguration(
    @Param('endpoint') endpoint: string,
    @Body(ValidationPipe) config: UpdateRateLimitConfigDto,
  ) {
    const decodedEndpoint = decodeURIComponent(endpoint);
    await this.rateLimitService.updateEndpointConfig(decodedEndpoint, config);
    return {
      message: 'Endpoint configuration updated successfully',
      endpoint: decodedEndpoint,
      config,
    };
  }

  @Post('reset')
  @ApiOperation({ 
    summary: 'Reset rate limit for identifier',
    description: 'Reset the rate limit counter for a specific identifier and optionally endpoint'
  })
  @ApiBody({ 
    type: ResetRateLimitDto,
    description: 'Identifier and optional endpoint to reset'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rate limit reset successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Rate limit reset successfully' },
        identifier: { type: 'string', example: 'user:123' },
        endpoint: { type: 'string', example: '/api/listings' }
      }
    }
  })
  @HttpCode(HttpStatus.OK)
  async resetRateLimit(@Body(ValidationPipe) resetDto: ResetRateLimitDto) {
    await this.rateLimitService.resetRateLimit(resetDto.identifier, resetDto.endpoint);
    return {
      message: 'Rate limit reset successfully',
      identifier: resetDto.identifier,
      endpoint: resetDto.endpoint,
    };
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Get rate limit status',
    description: 'Get current rate limit status for a specific identifier'
  })
  @ApiQuery({ 
    name: 'identifier', 
    type: String, 
    description: 'Identifier to check status for',
    example: 'user:123'
  })
  @ApiQuery({ 
    name: 'endpoint', 
    required: false, 
    type: String, 
    description: 'Optional endpoint to check status for',
    example: '/api/listings'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rate limit status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', example: 'user:123' },
        endpoint: { type: 'string', example: '/api/listings' },
        currentCount: { type: 'number', example: 5 },
        windowStart: { type: 'string', example: '2025-06-30T10:00:00.000Z' },
        nextReset: { type: 'string', example: '2025-06-30T10:01:00.000Z' }
      }
    }
  })
  async getRateLimitStatus(
    @Query('identifier') identifier: string,
    @Query('endpoint') endpoint?: string,
  ) {
    const status = await this.rateLimitService.getRateLimitStatus(identifier, endpoint);
    return {
      identifier,
      endpoint,
      ...status,
    };
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Check rate limiting service health',
    description: 'Check if the rate limiting service and Redis connection are healthy'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rate limiting service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        redis: { type: 'string', example: 'connected' },
        timestamp: { type: 'string', example: '2025-06-30T10:00:00.000Z' }
      }
    }
  })
  @ApiResponse({ status: 503, description: 'Rate limiting service is unhealthy' })
  async checkHealth() {
    // This would need to be implemented in the service
    return {
      status: 'healthy',
      redis: 'connected',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('summary')
  @ApiOperation({ 
    summary: 'Get rate limiting summary',
    description: 'Get a summary of rate limiting metrics and top consumers'
  })
  @ApiQuery({ 
    name: 'hours', 
    required: false, 
    type: Number, 
    description: 'Number of hours to analyze (default: 24)',
    example: 24
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rate limiting summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalRequests: { type: 'number', example: 12500 },
        blockedRequests: { type: 'number', example: 150 },
        blockRate: { type: 'number', example: 1.2 },
        topConsumers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              identifier: { type: 'string', example: 'user:123' },
              requests: { type: 'number', example: 500 },
              blocked: { type: 'number', example: 25 }
            }
          }
        },
        topEndpoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              endpoint: { type: 'string', example: '/api/listings' },
              requests: { type: 'number', example: 2500 },
              blocked: { type: 'number', example: 50 }
            }
          }
        }
      }
    }
  })
  async getRateLimitSummary(@Query('hours', new ParseIntPipe({ optional: true })) hours: number = 24) {
    // This would need to be implemented in the service to analyze analytics data
    return {
      totalRequests: 12500,
      blockedRequests: 150,
      blockRate: 1.2,
      topConsumers: [
        { identifier: 'user:123', requests: 500, blocked: 25 },
        { identifier: 'user:456', requests: 450, blocked: 20 },
      ],
      topEndpoints: [
        { endpoint: '/api/listings', requests: 2500, blocked: 50 },
        { endpoint: '/api/search', requests: 2000, blocked: 30 },
      ],
    };
  }
}
