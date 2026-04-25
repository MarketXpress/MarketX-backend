import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { correlationStorage } from '../context/correlation.context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      uuidv4();

    (req as any).correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    correlationStorage.run({ correlationId }, () => next());
  }
}

export class CorrelationIdHelper {
  static getFromRequest(req: Request): string {
    return (req as any).correlationId || 'unknown';
  }

  static createHeaders(correlationId: string): Record<string, string> {
    return {
      'x-correlation-id': correlationId,
      'x-request-id': correlationId,
    };
  }
}
