import { ETagInterceptor } from './etag.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import * as crypto from 'crypto';

describe('ETagInterceptor', () => {
  let interceptor: ETagInterceptor;

  beforeEach(() => {
    interceptor = new ETagInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should add ETag header for GET request', async () => {
    const request = {
      method: 'GET',
      headers: {},
    };
    const response = {
      getHeader: jest.fn().mockReturnValue(null),
      setHeader: jest.fn(),
      statusCode: 200,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    const data = { foo: 'bar' };
    const next: CallHandler = {
      handle: () => of(data),
    };

    const result = await interceptor.intercept(context, next).toPromise();

    expect(result).toEqual(data);
    expect(response.setHeader).toHaveBeenCalledWith('ETag', expect.any(String));
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
  });

  it('should return 304 if ETag matches If-None-Match', async () => {
    const data = { foo: 'bar' };
    const content = JSON.stringify(data);
    const etag = `"${crypto.createHash('sha256').update(content).digest('hex')}"`;

    const request = {
      method: 'GET',
      headers: {
        'if-none-match': etag,
      },
    };
    const response = {
      getHeader: jest.fn().mockReturnValue(null),
      setHeader: jest.fn(),
      status: jest.fn(),
      statusCode: 200,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of(data),
    };

    const result = await interceptor.intercept(context, next).toPromise();

    expect(result).toBeNull();
    expect(response.status).toHaveBeenCalledWith(304);
  });

  it('should skip non-GET requests', async () => {
    const request = {
      method: 'POST',
      headers: {},
    };
    const response = {
      setHeader: jest.fn(),
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    const data = { foo: 'bar' };
    const next: CallHandler = {
      handle: () => of(data),
    };

    const result = await interceptor.intercept(context, next).toPromise();

    expect(result).toEqual(data);
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
