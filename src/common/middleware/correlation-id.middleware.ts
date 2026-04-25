import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runWithCorrelationId } from '../logger/correlation-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) ||
      (req.headers['x-request-id'] as string) ||
      uuidv4();

    (req as any).correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    runWithCorrelationId(correlationId, () => next());
  }
}

export class CorrelationIdHelper {
  static getFromRequest(req: Request): string {
    return (req as any).correlationId || 'unknown';
  }

  static createHeaders(correlationId: string): Record<string, string> {
    return {
      [CORRELATION_ID_HEADER]: correlationId,
      'x-request-id': correlationId,
    };
  }
}
