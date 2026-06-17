import { Processor, Process } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Escrow } from '../entities/escrow.entity';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { Transaction, TransactionStatus } from '../entities/transaction.entity';
import { LoggerService } from '../common/logger/logger.service';
import {
  PaymentConfirmedEvent,
  OrderUpdatedEvent,
  EventNames,
} from '../common/events';

@Processor('stellar-webhook')
export class StellarWebhookProcessor {
  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  @Process('process-payment')
  async handleProcessPayment(job: Job<any>) {
    const { transactionHash } = job.data;
    this.logger.info('Started processing Stellar payment event', {
      jobId: job.id,
      transactionHash,
    });

    try {
      await this.dataSource.transaction(async (manager) => {
        // 1. Map transactionHash to an escrow record
        const escrow = await manager.findOne(Escrow, {
          where: { transactionHash },
        });

        if (!escrow) {
          this.logger.error(
            `Escrow record not found for transactionHash: ${transactionHash}`,
          );
          throw new Error(
            `Escrow record not found for transactionHash: ${transactionHash}`,
          );
        }

        if (escrow.released) {
          this.logger.warn(
            `Escrow already released for transactionHash: ${transactionHash}`,
            { escrowId: escrow.id },
          );
          return;
        }

        // 2. Advance escrow state (set released to true)
        escrow.released = true;
        await manager.save(escrow);
        this.logger.info(
          `Escrow state advanced (released = true) for transactionHash: ${transactionHash}`,
          { escrowId: escrow.id },
        );

        // 3. Find associated transaction in the database
        const transaction = await manager.findOne(Transaction, {
          where: { stellarHash: transactionHash },
        });

        if (transaction) {
          if (transaction.status !== TransactionStatus.COMPLETED) {
            const previousTxStatus = transaction.status;
            transaction.status = TransactionStatus.COMPLETED;
            transaction.completedAt = new Date();
            await manager.save(transaction);
            this.logger.info(
              `Transaction status updated from ${previousTxStatus} to COMPLETED`,
              { transactionId: transaction.id },
            );
          }

          // 4. Update the related Order if there is one
          if (transaction.orderId) {
            const order = await manager.findOne(Order, {
              where: { id: transaction.orderId },
            });

            if (order) {
              const previousOrderStatus = order.status;

              // Only update if not already paid/completed
              if (order.status !== OrderStatus.PAID) {
                order.paymentStatus = PaymentStatus.PAID;
                order.status = OrderStatus.PAID;
                order.confirmedAt = new Date();
                await manager.save(order);
                this.logger.info(
                  `Order payment status and state updated to PAID`,
                  { orderId: order.id },
                );

                // 5. Emit events
                this.eventEmitter.emit(
                  EventNames.PAYMENT_CONFIRMED,
                  new PaymentConfirmedEvent(
                    transaction.id,
                    order.buyerId,
                    order.id,
                    Number(transaction.amount),
                    transaction.currency,
                    transactionHash,
                  ),
                );

                this.eventEmitter.emit(
                  EventNames.ORDER_UPDATED,
                  new OrderUpdatedEvent(
                    order.id,
                    order.buyerId,
                    `ORD-${order.id.substring(0, 8)}`,
                    order.status,
                    previousOrderStatus,
                  ),
                );
              }
            } else {
              this.logger.warn(
                `Order with ID ${transaction.orderId} associated with transaction not found`,
              );
            }
          }
        } else {
          this.logger.warn(
            `No transaction record found with stellarHash: ${transactionHash}`,
          );
        }
      });

      this.logger.info(
        `Successfully processed Stellar payment event for transactionHash: ${transactionHash}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process Stellar payment event for transactionHash: ${transactionHash}`,
        error.message,
        error,
      );
      throw error;
    }
  }
}
