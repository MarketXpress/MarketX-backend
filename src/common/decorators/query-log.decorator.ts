/**
 * Decorator for logging database operations
 *
 * Logs database queries in development mode with parameters and execution time
 */

export function LogQuery() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const logger = this.logger || this.customLogger;
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        if (logger && process.env.NODE_ENV !== 'production') {
          logger.debug(`[Database] ${target.constructor.name}.${propertyKey}`, {
            duration: `${duration}ms`,
            resultCount: Array.isArray(result) ? result.length : 1,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (logger) {
          logger.error(
            `[Database] ${target.constructor.name}.${propertyKey} failed`,
            {
              duration: `${duration}ms`,
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

/**
 * Decorator for logging cached operations
 *
 * @example
 * @CacheLog('user-cache')
 * async getUser(id: string) {
 *   // Cache hits/misses will be logged
 * }
 */
export function CacheLog(cacheKey: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const logger = this.logger || this.customLogger;

      try {
        const result = await originalMethod.apply(this, args);

        if (logger) {
          logger.debug(`[Cache] ${cacheKey} - Hit/Set`, {
            method: propertyKey,
            args: JSON.stringify(args),
          });
        }

        return result;
      } catch (error) {
        if (logger) {
          logger.error(
            `[Cache] ${cacheKey} operation failed`,
            { method: propertyKey },
            error,
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}
