import { Injectable, NestMiddleware, Logger, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FraudService } from '../fraud.service';
import { GeolocationService } from '../../geolocation/geolocation.service';

@Injectable()
export class RequestMonitorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestMonitorMiddleware.name);

  constructor(
    private readonly fraud: FraudService,
    private readonly geolocationService: GeolocationService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req.headers['x-user-id'] as string);
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      let ip = req.ip || (req.headers['x-forwarded-for'] as string);

      // normalize x-forwarded-for list to first entry
      if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
      }

      // get geolocation from IP (required by acceptance criteria)
      const ipLocation = await this.geolocationService.getLocationFromIp(ip);
      if (ipLocation) {
        this.logger.debug(`Request IP geolocation: ${JSON.stringify(ipLocation)}`);
      }

      const shippingAddress =
        (req.body && (req.body.shippingAddress || req.body.address || req.body.order?.shippingAddress)) ||
        undefined;

      const metadata: any = { path: req.path, method: req.method };
      if (shippingAddress) {
        metadata.shippingAddress = shippingAddress;
      }
      if (ipLocation) {
        metadata.ipGeoPoint = ipLocation;
      }

      const result = await this.fraud.analyzeRequest({
        userId,
        ip,
        deviceFingerprint,
        metadata,
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
