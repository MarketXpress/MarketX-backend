import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudAlert } from './entities/fraud-alert.entity';
import { evaluateAllRules } from './score';
import type { AdminService } from '../admin/admin.service';
import { GeolocationService } from '../geolocation/geolocation.service';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/dto/create-order.dto';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    @InjectRepository(FraudAlert)
    private readonly repo: Repository<FraudAlert>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly geolocationService: GeolocationService,
    private readonly adminService?: AdminService,
  ) {}

  async analyzeRequest(input: {
    userId?: string;
    orderId?: string;
    ip?: string;
    deviceFingerprint?: string;
    metadata?: any;
  }) {
    // enrich with geolocation context if shipping address is present
    const shippingAddress = input.metadata?.shippingAddress;
    if (input.ip && shippingAddress) {
      try {
        const ipLocation = await this.geolocationService.getLocationFromIp(input.ip);
        const shipLocation = await this.geolocationService.geocodeAddress(shippingAddress);

        if (ipLocation && shipLocation) {
          const distance = this.geolocationService.distanceMiles(ipLocation, shipLocation);
          input.metadata.geoDistanceMiles = distance;
          input.metadata.ipGeoPoint = ipLocation;
          input.metadata.shippingGeoPoint = shipLocation;
        }
      } catch (err) {
        this.logger.warn(`Geolocation enrichment failed: ${err?.message || err}`);
      }
    }

    const result = await evaluateAllRules(input);

    // create an alert if above conservative threshold
    if (result.riskScore >= 20) {
      const alertStatus =
        result.riskScore >= 90
          ? 'suspended'
          : result.riskScore >= 75
          ? 'manual_review'
          : 'pending';

      const alert = this.repo.create({
        userId: input.userId,
        orderId: input.orderId,
        ip: input.ip,
        deviceFingerprint: input.deviceFingerprint,
        riskScore: result.riskScore,
        reason: result.reason,
        metadata: input.metadata,
        status: alertStatus,
      });

      await this.repo.save(alert);

      // Mark order for manual review if score breaches 75
      if (result.riskScore >= 75 && input.orderId) {
        const order = await this.ordersRepository.findOne({
          where: { id: input.orderId },
        });
        if (order && order.status !== OrderStatus.MANUAL_REVIEW) {
          order.status = OrderStatus.MANUAL_REVIEW;
          await this.ordersRepository.save(order);
          this.logger.warn(
            `Order ${input.orderId} marked MANUAL_REVIEW (score=${result.riskScore})`,
          );
        }
      }

      // Automatic suspension action for high-risk users
      if (result.riskScore >= 90 && input.userId && this.adminService) {
        try {
          await this.adminService.suspendUser(String(input.userId));
        } catch (err) {
          this.logger.warn(`Unable to auto-suspend user ${input.userId}: ${err?.message || err}`);
        }
      }

      if (result.riskScore >= 90) {
        this.logger.warn(`Auto-suspended user ${input.userId} (score=${result.riskScore})`);
      }

      return { flagged: true, alert: result };
    }

    return { flagged: false, alert: result };
  }

  async getAlerts(opts: { page?: number; pageSize?: number } = {}) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 25;
    const [items, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    return { items, total, page, pageSize };
  }

  async reviewAlert(id: string, action: { mark: 'safe' | 'reviewed' | 'suspended'; reviewer?: string }) {
    const alert = await this.repo.findOneBy({ id } as any);
    if (!alert) return null;
    alert.status = action.mark;
    await this.repo.save(alert);
    return alert;
  }
}
