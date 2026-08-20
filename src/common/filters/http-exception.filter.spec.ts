import { Test, TestingModule } from '@nestjs/testing';
import { HttpExceptionFilter } from './http-exception.filter';
import { LoggerService } from '../logger/logger.service';
import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';

jest.mock('nestjs-i18n', () => ({
  I18nContext: {
    current: jest.fn(),
  },
}));

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let loggerService: jest.Mocked<LoggerService>;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'GET',
      url: '/test-route',
      ip: '127.0.0.1',
      user: undefined,
      locale: undefined,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpExceptionFilter,
        {
          provide: LoggerService,
          useValue: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);
    loggerService = module.get(LoggerService) as jest.Mocked<LoggerService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockHost = (response = mockResponse, request = mockRequest) => ({
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  });

  describe('unhandled non-HTTP exceptions', () => {
    it('returns the normalised envelope for a generic Error', () => {
      const error = new Error('Something went wrong');
      const host = createMockHost();

      filter.catch(error, host as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          path: '/test-route',
          message: 'Something went wrong',
        }),
      );
    });

    it('does not expose stack traces in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Secret internal detail');
      const host = createMockHost();

      filter.catch(error, host as any);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('details');
      expect(jsonCall.message).toBe('Internal Server Error');

      process.env.NODE_ENV = originalEnv;
    });

    it('includes details in non-production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Dev detail');
      const host = createMockHost();

      filter.catch(error, host as any);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('details');
      expect(jsonCall.details.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('HttpException handling', () => {
    it('preserves 4xx status and message', () => {
      const exception = new ConflictException('Duplicate entry');
      const host = createMockHost();

      filter.catch(exception, host as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: 'Duplicate entry',
        }),
      );
    });
  });

  describe('structured logging', () => {
    it('calls LoggerService.error for a 5xx', () => {
      const error = new Error('Server failure');
      const host = createMockHost();

      filter.catch(error, host as any);

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('500'),
        expect.objectContaining({
          statusCode: 500,
          method: 'GET',
          url: '/test-route',
          ip: '127.0.0.1',
        }),
        expect.any(Error),
      );
    });

    it('calls LoggerService.warn for a 4xx', () => {
      const exception = new ConflictException('Conflict');
      const host = createMockHost();

      filter.catch(exception, host as any);

      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('409'),
        expect.objectContaining({
          statusCode: 409,
          method: 'GET',
          url: '/test-route',
          ip: '127.0.0.1',
        }),
      );
    });
  });
});
