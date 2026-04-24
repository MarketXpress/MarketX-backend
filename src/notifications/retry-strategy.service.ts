/**
 * Retry Strategy Service
 * 
 * Implements bounded backoff retry strategy for failed outbound notifications
 * with observability hooks for monitoring and debugging.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  
  /** Maximum delay in milliseconds (cap for exponential backoff) */
  maxDelayMs: number;
  
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier: number;
  
  /** Whether to use jitter to prevent thundering herd */
  useJitter: boolean;
}

export interface RetryAttempt {
  attemptNumber: number;
  delayMs: number;
  timestamp: Date;
  error?: Error;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  attempts: RetryAttempt[];
  totalDurationMs: number;
  error?: Error;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  useJitter: true,
};

@Injectable()
export class RetryStrategyService {
  private readonly logger = new Logger(RetryStrategyService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Execute a function with retry logic using bounded exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: Record<string, any>,
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();

    // First attempt
    try {
      const result = await operation();
      return {
        success: true,
        result,
        attempts: [],
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      attempts.push({
        attemptNumber: 0,
        delayMs: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });

      this.logger.warn(
        `Operation failed on first attempt, ${finalConfig.maxRetries} retries remaining`,
        { context, error },
      );

      // Emit retry event for observability
      this.eventEmitter.emit('notification.retry.started', {
        context,
        attemptNumber: 0,
        maxRetries: finalConfig.maxRetries,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Retry attempts
    for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
      const delayMs = this.calculateBackoff(attempt, finalConfig);
      
      this.logger.debug(
        `Waiting ${delayMs}ms before retry attempt ${attempt}/${finalConfig.maxRetries}`,
      );

      await this.sleep(delayMs);

      try {
        const result = await operation();
        
        attempts.push({
          attemptNumber: attempt,
          delayMs,
          timestamp: new Date(),
        });

        this.logger.log(
          `Operation succeeded on retry attempt ${attempt}/${finalConfig.maxRetries}`,
          { context },
        );

        // Emit success after retry event
        this.eventEmitter.emit('notification.retry.succeeded', {
          context,
          attemptNumber: attempt,
          totalAttempts: attempts.length,
          totalDurationMs: Date.now() - startTime,
        });

        return {
          success: true,
          result,
          attempts,
          totalDurationMs: Date.now() - startTime,
        };
      } catch (error) {
        attempts.push({
          attemptNumber: attempt,
          delayMs,
          timestamp: new Date(),
          error: error instanceof Error ? error : new Error(String(error)),
        });

        this.logger.warn(
          `Retry attempt ${attempt}/${finalConfig.maxRetries} failed`,
          { context, error },
        );

        // Emit retry attempt failed event
        this.eventEmitter.emit('notification.retry.attempt_failed', {
          context,
          attemptNumber: attempt,
          maxRetries: finalConfig.maxRetries,
          error: error instanceof Error ? error.message : String(error),
          nextRetryInMs: attempt < finalConfig.maxRetries 
            ? this.calculateBackoff(attempt + 1, finalConfig) 
            : 0,
        });
      }
    }

    // All retries exhausted
    const finalError = attempts[attempts.length - 1]?.error;
    
    this.logger.error(
      `Operation failed after ${finalConfig.maxRetries} retry attempts`,
      { context, totalAttempts: attempts.length },
    );

    // Emit retry exhausted event
    this.eventEmitter.emit('notification.retry.exhausted', {
      context,
      totalAttempts: attempts.length,
      totalDurationMs: Date.now() - startTime,
      error: finalError?.message,
      attempts: attempts.map(a => ({
        attemptNumber: a.attemptNumber,
        error: a.error?.message,
        timestamp: a.timestamp,
      })),
    });

    return {
      success: false,
      attempts,
      totalDurationMs: Date.now() - startTime,
      error: finalError,
    };
  }

  /**
   * Calculate backoff delay with optional jitter
   */
  private calculateBackoff(attempt: number, config: RetryConfig): number {
    // Exponential backoff: initialDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay = config.initialDelayMs * Math.pow(
      config.backoffMultiplier,
      attempt - 1,
    );

    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

    // Add jitter if enabled (prevents thundering herd problem)
    if (config.useJitter) {
      // Random value between 0 and cappedDelay
      return Math.floor(Math.random() * cappedDelay);
    }

    return cappedDelay;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry configuration for a specific notification type
   */
  getConfigForNotificationType(notificationType: string): Partial<RetryConfig> {
    // Different notification types can have different retry configs
    switch (notificationType) {
      case 'email':
        return {
          maxRetries: 5,
          initialDelayMs: 2000,
          maxDelayMs: 60000,
        };
      case 'push':
        return {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
        };
      case 'sms':
        return {
          maxRetries: 4,
          initialDelayMs: 3000,
          maxDelayMs: 45000,
        };
      default:
        return DEFAULT_RETRY_CONFIG;
    }
  }
}
