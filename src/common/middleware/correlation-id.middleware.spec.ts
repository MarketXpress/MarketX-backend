import { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from './correlation-id.middleware';
import { getCorrelationId, runWithCorrelationId } from '../logger/correlation-context';
import { Request, Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    mockReq = { headers: {}, ip: '127.0.0.1', method: 'GET', url: '/test' };
    mockRes = { setHeader: jest.fn() };
    nextFn = jest.fn();
  });

  it('generates a correlation ID when none is provided', () => {
    middleware.use(mockReq as Request, mockRes as Response, nextFn);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    );
    expect((mockReq as any).correlationId).toBeDefined();
    expect(nextFn).toHaveBeenCalled();
  });

  it('uses existing x-correlation-id header', () => {
    const existingId = 'existing-correlation-id';
    mockReq.headers = { [CORRELATION_ID_HEADER]: existingId };

    middleware.use(mockReq as Request, mockRes as Response, nextFn);

    expect((mockReq as any).correlationId).toBe(existingId);
    expect(mockRes.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, existingId);
  });

  it('falls back to x-request-id header', () => {
    const requestId = 'request-id-123';
    mockReq.headers = { 'x-request-id': requestId };

    middleware.use(mockReq as Request, mockRes as Response, nextFn);

    expect((mockReq as any).correlationId).toBe(requestId);
  });

  it('propagates correlation ID via AsyncLocalStorage', (done) => {
    const existingId = 'als-test-id';
    mockReq.headers = { [CORRELATION_ID_HEADER]: existingId };

    nextFn.mockImplementation(() => {
      expect(getCorrelationId()).toBe(existingId);
      done();
    });

    middleware.use(mockReq as Request, mockRes as Response, nextFn);
  });
});

describe('correlation-context', () => {
  it('getCorrelationId returns undefined outside of context', () => {
    // Outside any runWithCorrelationId call
    expect(getCorrelationId()).toBeUndefined();
  });

  it('runWithCorrelationId makes ID available inside callback', () => {
    const id = 'test-correlation-id';
    runWithCorrelationId(id, () => {
      expect(getCorrelationId()).toBe(id);
    });
  });

  it('isolates correlation IDs between concurrent contexts', async () => {
    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) =>
        runWithCorrelationId('id-A', () => {
          setTimeout(() => {
            results.push(getCorrelationId()!);
            resolve();
          }, 10);
        }),
      ),
      new Promise<void>((resolve) =>
        runWithCorrelationId('id-B', () => {
          setTimeout(() => {
            results.push(getCorrelationId()!);
            resolve();
          }, 5);
        }),
      ),
    ]);

    expect(results).toContain('id-A');
    expect(results).toContain('id-B');
  });
});
