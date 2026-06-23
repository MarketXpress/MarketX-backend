import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import {
  EventNames,
  OrderUpdatedEvent,
  OrderCompletedEvent,
  PaymentReleasedEvent,
} from '../common/events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class EscrowService implements OnModuleInit, OnModuleDestroy {
  private releaseTimer: NodeJS.Timeout | null = null;
  private activeTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    const checkInterval = process.env.NODE_ENV === 'test' ? 1000 : 60000;
    this.releaseTimer = setInterval(
      () => this.checkAndReleaseEscrows(),
      checkInterval,
    );
  }

  onModuleDestroy() {
    if (this.releaseTimer) {
      clearInterval(this.releaseTimer);
    }
    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();
  }

  private getDisputeWindowMs(): number {
    if (process.env.NODE_ENV === 'test') {
      return 100;
    }
    const envVal = process.env.ESCROW_DISPUTE_WINDOW_MS;
    return envVal ? parseInt(envVal, 10) : 24 * 60 * 60 * 1000;
  }

  async createEscrow(data: {
    orderId: string;
    buyerPublicKey: string;
    sellerPublicKey: string;
    buyerSecretKey?: string;
    amount: number;
  }): Promise<Escrow> {
    this.logger.info('Creating escrow record', {
      orderId: data.orderId,
      amount: data.amount,
    });

    let escrow = await this.escrowRepository.findOne({
      where: { orderId: data.orderId },
    });

    if (escrow) {
      this.logger.warn('Escrow already exists for order', {
        orderId: data.orderId,
      });
      return escrow;
    }

    let buyerId: string | undefined;
    try {
      const order = await this.dataSource.getRepository(Order).findOne({
        where: { id: data.orderId },
      });
      if (order) {
        buyerId = order.buyerId;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to locate order buyerId during escrow creation: ${error.message}`,
      );
    }

    escrow = this.escrowRepository.create({
      orderId: data.orderId,
      amount: data.amount,
      buyerPublicKey: data.buyerPublicKey,
      sellerPublicKey: data.sellerPublicKey,
      buyerSecretKey: data.buyerSecretKey,
      userId: buyerId,
      status: EscrowStatus.PENDING,
    });

    return await this.escrowRepository.save(escrow);
  }

  async findByOrderId(orderId: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { orderId },
    });
    if (!escrow) {
      throw new NotFoundException(`Escrow record not found for order ID: ${orderId}`);
    }
    return escrow;
  }

  @OnEvent(EventNames.ORDER_UPDATED)
  async handleOrderUpdated(event: OrderUpdatedEvent) {
    this.logger.info(
      `Escrow service processing order update event: ${event.orderId} to status ${event.status}`,
    );

    const escrow = await this.escrowRepository.findOne({
      where: { orderId: event.orderId },
    });
    if (!escrow) {
      this.logger.debug(`No escrow details mapped to order: ${event.orderId}`);
      return;
    }

    if (event.status === OrderStatus.PAID) {
      if (escrow.status === EscrowStatus.PENDING) {
        escrow.status = EscrowStatus.FUNDED;
        await this.escrowRepository.save(escrow);
        this.logger.info(`Escrow transitioned: PENDING -> FUNDED for order ${event.orderId}`);
      }
    } else if (event.status === OrderStatus.SHIPPED) {
      if (escrow.status === EscrowStatus.FUNDED) {
        escrow.status = EscrowStatus.IN_TRANSIT;
        await this.escrowRepository.save(escrow);
        this.logger.info(`Escrow transitioned: FUNDED -> IN_TRANSIT for order ${event.orderId}`);
      }
    } else if (event.status === OrderStatus.DELIVERED) {
      this.logger.info(`Order delivered. Triggering escrow release schedule for order ${event.orderId}`);
      this.scheduleEscrowRelease(escrow.id);
    } else if (
      event.status === OrderStatus.CANCELLED ||
      event.status === OrderStatus.REFUNDED ||
      event.status === 'DISPUTE_REFUNDED'
    ) {
      escrow.status = EscrowStatus.REFUNDED;
      await this.escrowRepository.save(escrow);
      this.logger.info(`Escrow transitioned to REFUNDED for order ${event.orderId}`);
    } else if (event.status === 'DISPUTE_RELEASED') {
      escrow.status = EscrowStatus.RELEASED;
      await this.escrowRepository.save(escrow);
      this.logger.info(`Escrow transitioned to RELEASED (Dispute Resolved) for order ${event.orderId}`);
    }
  }

  scheduleEscrowRelease(escrowId: string) {
    if (this.activeTimeouts.has(escrowId)) {
      return;
    }
    const delay = this.getDisputeWindowMs();
    const timeout = setTimeout(async () => {
      this.activeTimeouts.delete(escrowId);
      await this.releaseEscrow(escrowId);
    }, delay);
    this.activeTimeouts.set(escrowId, timeout);
  }

  async checkAndReleaseEscrows() {
    try {
      const delay = this.getDisputeWindowMs();
      const cutoffDate = new Date(Date.now() - delay);

      const escrowsToRelease = await this.escrowRepository
        .createQueryBuilder('escrow')
        .innerJoin(Order, 'order', 'order.id = escrow.orderId')
        .where('escrow.status IN (:...statuses)', {
          statuses: [EscrowStatus.FUNDED, EscrowStatus.IN_TRANSIT],
        })
        .andWhere('order.status = :orderStatus', {
          orderStatus: OrderStatus.DELIVERED,
        })
        .andWhere('order.deliveredAt <= :cutoffDate', { cutoffDate })
        .getMany();

      for (const escrow of escrowsToRelease) {
        await this.releaseEscrow(escrow.id);
      }
    } catch (error) {
      this.logger.error(
        `Error executing periodic checkAndReleaseEscrows: ${error.message}`,
        error.stack,
      );
    }
  }

  async releaseEscrow(escrowId: string) {
    await this.dataSource.transaction(async (manager) => {
      const escrow = await manager.findOne(Escrow, {
        where: { id: escrowId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        this.logger.warn(`Escrow ${escrowId} not found for release.`);
        return;
      }

      if (escrow.status === EscrowStatus.RELEASED) {
        return;
      }

      if (escrow.status === EscrowStatus.DISPUTED) {
        this.logger.info(`Escrow ${escrowId} is disputed. Skipping automatic release.`);
        return;
      }

      escrow.status = EscrowStatus.RELEASED;
      await manager.save(escrow);
      this.logger.info(`Escrow ${escrow.id} auto-released.`);

      if (escrow.orderId) {
        const order = await manager.findOne(Order, {
          where: { id: escrow.orderId },
          lock: { mode: 'pessimistic_write' },
        });

        if (order && order.status === OrderStatus.DELIVERED) {
          const previousStatus = order.status;
          order.status = OrderStatus.COMPLETED;
          order.completedAt = new Date();
          await manager.save(order);

          this.logger.info(`Order ${order.id} status set to COMPLETED.`);

          this.eventEmitter.emit(
            EventNames.ORDER_UPDATED,
            new OrderUpdatedEvent(
              order.id,
              order.buyerId,
              `ORD-${order.id.substring(0, 8)}`,
              order.status,
              previousStatus,
            ),
          );

          this.eventEmitter.emit(
            EventNames.ORDER_COMPLETED,
            new OrderCompletedEvent(
              order.id,
              order.buyerId,
              `ORD-${order.id.substring(0, 8)}`,
              Number(order.totalAmount),
            ),
          );
        }
      }

      this.eventEmitter.emit(
        EventNames.PAYMENT_RELEASED,
        new PaymentReleasedEvent(
          escrow.id,
          escrow.orderId || '',
          escrow.sellerPublicKey || '',
          Number(escrow.amount),
          escrow.transactionHash || 'auto-released-hash',
          new Date(),
          true,
        ),
      );
    });
  }

  async handleDisputeRaised(orderId: string) {
    const escrow = await this.escrowRepository.findOne({
      where: { orderId },
    });
    if (escrow && escrow.status !== EscrowStatus.DISPUTED) {
      escrow.status = EscrowStatus.DISPUTED;
      await this.escrowRepository.save(escrow);
      this.logger.info(`Escrow status marked as DISPUTED for order ID: ${orderId}`);
    }
  }
}
