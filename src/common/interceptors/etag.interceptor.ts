import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as crypto from 'crypto';
import { Request, Response } from 'express';

/**
 * ETagInterceptor
 * Calculates a SHA-256 hash of the response body and implements HTTP 304 Not Modified logic.
 * This drastically reduces bandwidth for large, unchanging datasets.
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    // Only apply to GET requests as per HTTP standards for ETags
    if (request.method !== 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Skip if no data or if response already has an ETag or is an error
        if (
          data === undefined || 
          data === null || 
          response.getHeader('ETag') ||
          response.statusCode >= 400
        ) {
          return data;
        }

        // Calculate precise SHA-256 hash based directly on the response payload body
        // Support for buffers, objects (JSON), and primitives
        let content: string | Buffer;
        if (Buffer.isBuffer(data)) {
          content = data;
        } else if (typeof data === 'object') {
          content = JSON.stringify(data);
        } else {
          content = String(data);
        }

        const etag = `"${crypto.createHash('sha256').update(content).digest('hex')}"`;

        // Check If-None-Match header from subsequent requests
        const ifNoneMatch = request.headers['if-none-match'];

        if (ifNoneMatch === etag) {
          // Provide 304 Not Modified payload forcing local frontend reliance
          response.status(304);
          // For 304, the body must be empty
          return null;
        }

        // Provide this in the headers explicitly upon return
        response.setHeader('ETag', etag);
        
        // Instruct client to revalidate the cache with the server
        if (!response.getHeader('Cache-Control')) {
          response.setHeader('Cache-Control', 'no-cache');
        }

        return data;
      }),
    );
  }
}
