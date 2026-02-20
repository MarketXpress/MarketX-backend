import { Injectable, NestMiddleware, Logger, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FraudService } from '../fraud.service';

@Injectable()
export class RequestMonitorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestMonitorMiddleware.name);

  constructor(private readonly fraud: FraudService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || req.headers['x-user-id'] as string;
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      const ip = req.ip || req.headers['x-forwarded-for'] as string;

      const result = await this.fraud.analyzeRequest({
        userId,
        ip,
        deviceFingerprint,
        metadata: { path: req.path, method: req.method },
      });

      if (result.flagged && result.alert?.riskScore >= 90) {
        // highly suspicious — block
        this.logger.warn(`Blocking request for user ${userId} score=${result.alert.riskScore}`);
        throw new ForbiddenException('Account suspended due to suspicious activity');
      }

      // allow request to continue for lower scores
      next();
    } catch (err) {
      next(err);
    }
  }
}
