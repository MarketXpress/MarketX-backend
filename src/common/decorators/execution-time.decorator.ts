import { applyDecorators } from '@nestjs/common';

/**
 * Decorator to automatically log method execution time
 *
 * @example
 * @ExecutionTime()
 * async myMethod() {
 *   // execution time will be automatically logged
 * }
 */
export function ExecutionTime() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const context = {
        class: target.constructor.name,
        method: propertyKey,
      };

      try {
        // Get logger from dependency injection
        const logger = this.logger || this.customLogger;

        if (logger) {
          logger.debug(`[${context.class}] ${context.method} - Started`, {
            context,
          });
        }

        const result = await originalMethod.apply(this, args);

        const duration = Date.now() - startTime;
        if (logger) {
          if (duration > 1000) {
            logger.warn(`[${context.class}] ${context.method} - Completed (SLOW)`, {
              duration: `${duration}ms`,
              context,
              threshold: '1000ms',
            });
          } else {
            logger.debug(`[${context.class}] ${context.method} - Completed`, {
              duration: `${duration}ms`,
              context,
            });
          }
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const logger = this.logger || this.customLogger;

        if (logger) {
          logger.error(
            `[${context.class}] ${context.method} - Failed`,
            {
              duration: `${duration}ms`,
              context,
              errorMessage: error?.message,
            },
            error,
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to log async method with custom metadata
 *
 * @example
 * @LogExecution({ component: 'OrderService', action: 'create' })
 * async createOrder(data) {
 *   // method execution will be logged with component and action
 * }
 */
export function LogExecution(metadata?: {
  component?: string;
  action?: string;
  [key: string]: any;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const logger = this.logger || this.customLogger;
      const component = metadata?.component || target.constructor.name;
      const action = metadata?.action || propertyKey;

      if (logger) {
        logger.info(`${component}::${action} started`, { metadata });
      }

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        if (logger) {
          logger.info(`${component}::${action} completed`, {
            duration: `${duration}ms`,
            ...metadata,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (logger) {
          logger.error(
            `${component}::${action} failed`,
            {
              duration: `${duration}ms`,
              ...metadata,
              error: error?.message,
            },
            error,
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}
