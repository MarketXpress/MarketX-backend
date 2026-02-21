import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudAlert } from './entities/fraud-alert.entity';
import { evaluateAllRules } from './score';
import type { AdminService } from '../admin/admin.service';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    @InjectRepository(FraudAlert)
    private readonly repo: Repository<FraudAlert>,
    private readonly adminService?: AdminService,
  ) {}

  async analyzeRequest(input: {
    userId?: string;
    orderId?: string;
    ip?: string;
    deviceFingerprint?: string;
    metadata?: any;
  }) {
    const result = await evaluateAllRules(input);

    // create an alert if above conservative threshold
    if (result.riskScore >= 20) {
      const alert = this.repo.create({
        userId: input.userId,
        orderId: input.orderId,
        ip: input.ip,
        deviceFingerprint: input.deviceFingerprint,
        riskScore: result.riskScore,
        reason: result.reason,
        metadata: input.metadata,
        status: result.riskScore >= 70 ? 'suspended' : 'pending',
      });

      await this.repo.save(alert);

      // Automatic suspension action for high-risk users
      if (result.riskScore >= 70 && input.userId && this.adminService) {
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
