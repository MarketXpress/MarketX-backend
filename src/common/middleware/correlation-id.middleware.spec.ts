import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { correlationStorage, getCorrelationId } from '../context/correlation.context';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware],
    }).compile();

    middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);
  });

  function makeReq(headers: Record<string, string> = {}): Request {
    return { headers, ip: '127.0.0.1' } as unknown as Request;
  }

  function makeRes(): { res: Response; headers: Record<string, string> } {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (key: string, value: string) => { headers[key] = value; },
    } as unknown as Response;
    return { res, headers };
  }

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('uses x-correlation-id header when provided', (done) => {
    const req = makeReq({ 'x-correlation-id': 'test-id-123' });
    const { res, headers } = makeRes();

    middleware.use(req, res, () => {
      expect((req as any).correlationId).toBe('test-id-123');
      expect(headers['x-correlation-id']).toBe('test-id-123');
      done();
    });
  });

  it('falls back to x-request-id header', (done) => {
    const req = makeReq({ 'x-request-id': 'req-id-456' });
    const { res, headers } = makeRes();

    middleware.use(req, res, () => {
      expect((req as any).correlationId).toBe('req-id-456');
      expect(headers['x-correlation-id']).toBe('req-id-456');
      done();
    });
  });

  it('generates a UUID when no correlation header is present', (done) => {
    const req = makeReq();
    const { res, headers } = makeRes();

    middleware.use(req, res, () => {
      const id = (req as any).correlationId as string;
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(headers['x-correlation-id']).toBe(id);
      done();
    });
  });

  it('propagates correlation ID into AsyncLocalStorage', (done) => {
    const req = makeReq({ 'x-correlation-id': 'als-test-id' });
    const { res } = makeRes();

    middleware.use(req, res, () => {
      expect(getCorrelationId()).toBe('als-test-id');
      done();
    });
  });

  it('ALS store is undefined outside of middleware context', () => {
    // Outside of a correlationStorage.run() call, getCorrelationId returns undefined
    const id = correlationStorage.getStore()?.correlationId;
    expect(id).toBeUndefined();
  });
});
