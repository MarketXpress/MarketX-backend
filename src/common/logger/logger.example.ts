import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Example service demonstrating comprehensive logging usage
 *
 * This file shows best practices for using the LoggerService
 * across different scenarios in your application.
 */

@Injectable()
export class ExampleLoggingService {
  constructor(
    private logger: LoggerService,
    // private userRepository: Repository<User>,
  ) {}

  /**
   * Example 1: Basic CRUD operation logging
   */
  async exampleCreateUser(userData: any) {
    try {
      this.logger.info('User creation initiated', {
        email: userData.email,
        role: userData.role,
      });

      // Simulate user creation
      const user = { id: '123', ...userData };

      this.logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
      });

      return user;
    } catch (error) {
      this.logger.error(
        'Failed to create user',
        {
          email: userData.email,
          error: error.message,
        },
        error,
      );
      throw error;
    }
  }

  /**
   * Example 2: Authentication event logging
   */
  async exampleLogin(email: string, password: string) {
    try {
      this.logger.info('Login attempt', { email });

      // Validate credentials (password is automatically redacted in logs)
      const isValid = email && password; // Simplified

      if (!isValid) {
        this.logger.logAuthEvent('failed_login', undefined, {
          email,
          reason: 'Invalid credentials',
        });
        throw new Error('Invalid credentials');
      }

      const user = { id: '123', email };

      this.logger.logAuthEvent('login', user.id, {
        email,
        loginTime: new Date().toISOString(),
      });

      return user;
    } catch (error) {
      this.logger.error('Login failed', { email }, error);
      throw error;
    }
  }

  /**
   * Example 3: Performance monitoring
   */
  async exampleComplexOperation() {
    const startTime = Date.now();

    try {
      this.logger.info('Starting complex operation');

      // Simulate expensive operation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const duration = Date.now() - startTime;

      // This will log as WARN because duration > 1000ms
      this.logger.logPerformance('Complex operation', duration, {
        itemsProcessed: 5000,
        status: 'completed',
      });

      return { success: true };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        'Complex operation failed',
        { duration: `${duration}ms` },
        error,
      );
      throw error;
    }
  }

  /**
   * Example 4: Database operation logging (development only)
   */
  async exampleDatabaseOperation() {
    const startTime = Date.now();

    try {
      // Simulate database query
      // const users = await this.userRepository.find();

      const duration = Date.now() - startTime;

      // Only logged in development mode
      this.logger.logDatabaseQuery(
        'SELECT * FROM users',
        [],
        duration,
      );

      return [];
    } catch (error) {
      this.logger.error(
        'Database query failed',
        { query: 'SELECT * FROM users' },
        error,
      );
      throw error;
    }
  }

  /**
   * Example 5: Sensitive data handling
   * Note: Passwords and tokens are automatically redacted
   */
  async exampleSensitiveDataHandling(credentials: {
    email: string;
    password: string;
    apiKey: string;
  }) {
    try {
      // This object will be automatically sanitized when logged
      this.logger.info('Processing credentials', credentials);
      // Output: { email: 'user@example.com', password: '***REDACTED***', apiKey: '***REDACTED***' }

      return { success: true };
    } catch (error) {
      this.logger.error('Credential processing failed', credentials, error);
      throw error;
    }
  }

  /**
   * Example 6: Request lifecycle logging
   * Note: This is typically handled by the interceptor automatically
   */
  async exampleRequestLifecycle() {
    this.logger.debug('Request processing started');

    try {
      // Process request
      const result = { data: 'example' };

      this.logger.debug('Request processing completed', {
        resultSize: JSON.stringify(result).length,
      });

      return result;
    } catch (error) {
      this.logger.error('Request processing failed', {}, error);
      throw error;
    }
  }

  /**
   * Example 7: Using different log levels appropriately
   */
  exampleLogLevels() {
    // ERROR: Critical issues that need attention
    this.logger.error('Database connection failed', {
      host: 'localhost',
      port: 5432,
    });

    // WARN: Potentially problematic situations
    this.logger.warn('High memory usage detected', {
      percentage: 85,
      threshold: 80,
    });

    // INFO: General informational messages
    this.logger.info('API server started', {
      port: 3000,
      environment: 'production',
    });

    // DEBUG: Detailed debugging information
    this.logger.debug('Incoming request details', {
      headers: { 'content-type': 'application/json' },
      bodySize: 1024,
    });
  }

  /**
   * Example 8: Context propagation through operations
   */
  async exampleContextPropagation(userId: string, orderId: string) {
    const context = {
      userId,
      orderId,
      operation: 'order-update',
    };

    try {
      this.logger.info('Starting order update', context);

      // Step 1: Fetch order
      this.logger.debug('Fetching order from database', context);

      // Step 2: Update order
      this.logger.debug('Updating order', { ...context, status: 'processing' });

      // Step 3: Send notification
      this.logger.debug('Sending notification', context);

      this.logger.info('Order updated successfully', context);
    } catch (error) {
      this.logger.error('Order update failed', context, error);
      throw error;
    }
  }
}

/**
 * Usage in Controllers
 *
 * @Controller('users')
 * export class UserController {
 *   constructor(
 *     private userService: UserService,
 *     private logger: LoggerService,
 *   ) {}
 *
 *   @Post()
 *   async create(@Body() createUserDto: CreateUserDto) {
 *     this.logger.info('POST /users received', { email: createUserDto.email });
 *     return this.userService.create(createUserDto);
 *   }
 *
 *   @Get(':id')
 *   async findOne(@Param('id') id: string) {
 *     this.logger.debug('GET /users/:id', { userId: id });
 *     return this.userService.findOne(id);
 *   }
 * }
 */

/**
 * Environment Configuration
 *
 * # .env file
 * LOG_LEVEL=info              # error, warn, info, debug
 * NODE_ENV=development        # development, production
 *
 * In production:
 * - Debug logs are not created
 * - Console output is still available
 * - File logs are created with rotation
 */
