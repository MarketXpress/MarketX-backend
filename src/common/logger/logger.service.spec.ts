import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Basic Logging Methods', () => {
    it('should log info messages', () => {
      const spy = jest.spyOn(service, 'info');
      service.info('Test message', { context: 'test' });

      expect(spy).toHaveBeenCalledWith('Test message', { context: 'test' });
      spy.mockRestore();
    });

    it('should log error messages', () => {
      const spy = jest.spyOn(service, 'error');
      const error = new Error('Test error');

      service.error('Error occurred', { context: 'test' }, error);

      expect(spy).toHaveBeenCalledWith(
        'Error occurred',
        { context: 'test' },
        error,
      );
      spy.mockRestore();
    });

    it('should log warning messages', () => {
      const spy = jest.spyOn(service, 'warn');
      service.warn('Warning message', { context: 'test' });

      expect(spy).toHaveBeenCalledWith('Warning message', { context: 'test' });
      spy.mockRestore();
    });

    it('should log debug messages', () => {
      const spy = jest.spyOn(service, 'debug');
      service.debug('Debug message', { context: 'test' });

      expect(spy).toHaveBeenCalledWith('Debug message', { context: 'test' });
      spy.mockRestore();
    });
  });

  describe('Sensitive Data Redaction', () => {
    it('should redact password fields', () => {
      const spy = jest.spyOn(service, 'info');
      const userData = {
        email: 'user@example.com',
        password: 'secretPassword123',
      };

      service.info('User data', userData);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should redact apiKey fields', () => {
      const spy = jest.spyOn(service, 'info');
      const apiData = {
        endpoint: 'https://api.example.com',
        apiKey: 'sk_live_abcd1234',
      };

      service.info('API data', apiData);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should redact token fields', () => {
      const spy = jest.spyOn(service, 'info');
      const authData = {
        userId: 'user123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      };

      service.info('Auth data', authData);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should redact creditCard fields', () => {
      const spy = jest.spyOn(service, 'info');
      const paymentData = {
        amount: 99.99,
        creditCard: '4111-1111-1111-1111',
      };

      service.info('Payment data', paymentData);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should redact nested sensitive fields', () => {
      const spy = jest.spyOn(service, 'info');
      const userData = {
        email: 'user@example.com',
        credentials: {
          password: 'secretPassword123',
          apiKey: 'sk_live_abcd1234',
        },
      };

      service.info('Complex data', userData);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should handle arrays of sensitive data', () => {
      const spy = jest.spyOn(service, 'info');
      const users = [
        { id: '1', password: 'pass1' },
        { id: '2', password: 'pass2' },
      ];

      service.info('Users list', users);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Request/Response Logging', () => {
    it('should log requests', () => {
      const spy = jest.spyOn(service, 'logRequest');

      service.logRequest('GET', '/api/users', { page: 1 }, null, '127.0.0.1');

      expect(spy).toHaveBeenCalledWith(
        'GET',
        '/api/users',
        { page: 1 },
        null,
        '127.0.0.1',
      );
      spy.mockRestore();
    });

    it('should log responses', () => {
      const spy = jest.spyOn(service, 'logResponse');

      service.logResponse('GET', '/api/users', 200, 45, {
        id: 'user123',
      });

      expect(spy).toHaveBeenCalledWith('GET', '/api/users', 200, 45, {
        id: 'user123',
      });
      spy.mockRestore();
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      const spy = jest.spyOn(service, 'logPerformance');

      service.logPerformance('Database query', 250, { query: 'SELECT *' });

      expect(spy).toHaveBeenCalledWith('Database query', 250, {
        query: 'SELECT *',
      });
      spy.mockRestore();
    });
  });

  describe('Database Query Logging', () => {
    it('should log database queries', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const spy = jest.spyOn(service, 'logDatabaseQuery');

      service.logDatabaseQuery('SELECT * FROM users', ['1'], 50);

      expect(spy).toHaveBeenCalledWith('SELECT * FROM users', ['1'], 50);

      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });

    it('should not log database queries in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const spy = jest.spyOn(service, 'logDatabaseQuery');

      service.logDatabaseQuery('SELECT * FROM users', ['1'], 50);

      expect(spy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });
  });

  describe('Authentication Event Logging', () => {
    it('should log login events', () => {
      const spy = jest.spyOn(service, 'logAuthEvent');

      service.logAuthEvent('login', 'user123', { email: 'user@example.com' });

      expect(spy).toHaveBeenCalledWith('login', 'user123', {
        email: 'user@example.com',
      });
      spy.mockRestore();
    });

    it('should log logout events', () => {
      const spy = jest.spyOn(service, 'logAuthEvent');

      service.logAuthEvent('logout', 'user123');

      expect(spy).toHaveBeenCalledWith('logout', 'user123');
      spy.mockRestore();
    });

    it('should log failed login events', () => {
      const spy = jest.spyOn(service, 'logAuthEvent');

      service.logAuthEvent('failed_login', undefined, {
        email: 'user@example.com',
      });

      expect(spy).toHaveBeenCalledWith('failed_login', undefined, {
        email: 'user@example.com',
      });
      spy.mockRestore();
    });

    it('should log token refresh events', () => {
      const spy = jest.spyOn(service, 'logAuthEvent');

      service.logAuthEvent('token_refresh', 'user123');

      expect(spy).toHaveBeenCalledWith('token_refresh', 'user123');
      spy.mockRestore();
    });
  });

  describe('Logger Instance', () => {
    it('should provide access to underlying winston logger', () => {
      const logger = service.getLogger();

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null context', () => {
      const spy = jest.spyOn(service, 'info');

      service.info('Test message', null);

      expect(spy).toHaveBeenCalledWith('Test message', null);
      spy.mockRestore();
    });

    it('should handle undefined context', () => {
      const spy = jest.spyOn(service, 'info');

      service.info('Test message');

      expect(spy).toHaveBeenCalledWith('Test message');
      spy.mockRestore();
    });

    it('should handle deeply nested objects', () => {
      const spy = jest.spyOn(service, 'info');

      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  password: 'secret',
                },
              },
            },
          },
        },
      };

      service.info('Deep object', deepObject);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should handle circular references gracefully', () => {
      const spy = jest.spyOn(service, 'info');

      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      expect(() => {
        service.info('Object with circular reference', obj);
      }).not.toThrow();

      spy.mockRestore();
    });
  });
});
