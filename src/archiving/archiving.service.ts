import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import {
  Transaction,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { ArchivedOrder } from './entities/archived-order.entity';
import { ArchivedTransaction } from './entities/archived-transaction.entity';
import { OrderStatus } from '../orders/dto/create-order.dto';

@Injectable()
export class ArchivingService {
  private readonly logger = new Logger(ArchivingService.name);
  private readonly BATCH_SIZE = 1000;

  constructor(private dataSource: DataSource) {}

  @Cron('0 2 * * 0') // 2:00 AM every Sunday
  async handleWeeklyArchiving() {
    this.logger.log('Starting automated transaction archiving pipeline...');

    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - 18);

    try {
      await this.archiveOrders(threshold);
      await this.archiveTransactions(threshold);
      this.logger.log('Archiving pipeline completed successfully.');
    } catch (error) {
      this.logger.error('Archiving pipeline failed:', error.stack);
    }
  }

  private async archiveOrders(threshold: Date) {
    let totalMoved = 0;
    let hasMore = true;

    this.logger.log(
      `Archiving orders completed before ${threshold.toISOString()}`,
    );

    while (hasMore) {
      const moved = await this.dataSource.transaction(async (manager) => {
        // Find IDs to move to avoid locking the whole table during selection
        const ordersToMove = await manager.getRepository(Order).find({
          where: {
            status: OrderStatus.COMPLETED,
            updatedAt: LessThan(threshold),
          },
          take: this.BATCH_SIZE,
          select: ['id'],
        });

        if (ordersToMove.length === 0) {
          return 0;
        }

        const ids = ordersToMove.map((o) => o.id);

        // Move to archive
        // We fetch full data for these IDs and save them to the archive
        // Then delete from primary
        const fullData = await manager.getRepository(Order).findByIds(ids);

        // Deep copy items to avoid reference issues if any
        const archivedItems = fullData.map((order) => {
          const archived = new ArchivedOrder();
          Object.assign(archived, order);
          return archived;
        });

        await manager.save(ArchivedOrder, archivedItems);
        await manager.delete(Order, ids);

        return ids.length;
      });

      totalMoved += moved;
      hasMore = moved === this.BATCH_SIZE;

      if (moved > 0) {
        this.logger.log(`Moved ${moved} orders (Total: ${totalMoved})...`);
      }
    }

    this.logger.log(`Finished archiving orders. Total moved: ${totalMoved}`);
  }

  private async archiveTransactions(threshold: Date) {
    let totalMoved = 0;
    let hasMore = true;

    this.logger.log(
      `Archiving transactions completed before ${threshold.toISOString()}`,
    );

    while (hasMore) {
      const moved = await this.dataSource.transaction(async (manager) => {
        const transactionsToMove = await manager
          .getRepository(Transaction)
          .find({
            where: {
              status: TransactionStatus.COMPLETED,
              updatedAt: LessThan(threshold),
            },
            take: this.BATCH_SIZE,
            select: ['id'],
          });

        if (transactionsToMove.length === 0) {
          return 0;
        }

        const ids = transactionsToMove.map((t) => t.id);
        const fullData = await manager
          .getRepository(Transaction)
          .findByIds(ids);

        const archivedTransactions = fullData.map((tx) => {
          const archived = new ArchivedTransaction();
          Object.assign(archived, tx);
          // Ensure sender/receiver are just IDs in the archive entity
          // The ArchivedTransaction entity we created doesn't have the relations,
          // so Object.assign will just ignore them if they are objects,
          // but we should make sure senderId and receiverId are preserved.
          return archived;
        });

        await manager.save(ArchivedTransaction, archivedTransactions);
        await manager.delete(Transaction, ids);

        return ids.length;
      });

      totalMoved += moved;
      hasMore = moved === this.BATCH_SIZE;

      if (moved > 0) {
        this.logger.log(
          `Moved ${moved} transactions (Total: ${totalMoved})...`,
        );
      }
    }

    this.logger.log(
      `Finished archiving transactions. Total moved: ${totalMoved}`,
    );
  }
}
