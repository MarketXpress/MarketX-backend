import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as StellarSdk from 'stellar-sdk';
import { ConfigService } from '@nestjs/config';

import { Payment } from './entities/payment.entity';
import { PaymentStatus, PaymentCurrency } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

interface StreamingConnection {
  paymentId: string;
  destinationAddress: string;
  closeFunction?: () => void;
}

@Injectable()
export class PaymentMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentMonitorService.name);
  private stellarServer: StellarSdk.Server;
  private networkPassphrase: string;
  private activeStreams: Map<string, StreamingConnection> = new Map();
  private timeoutIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private paymentsService: PaymentsService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.stellarServer = new StellarSdk.Server(horizonUrl);
    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ||
      StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE;
  }

  /**
   * Initialize module and set up timeout monitoring
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('PaymentMonitorService initialized');

    // Set up periodic cleanup of expired payments
    this.setupTimeoutMonitoring();

    // Restart monitoring for any pending payments in database
    await this.resumePendingPaymentMonitoring();
  }

  /**
   * Clean up all streams on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Cleaning up payment monitoring streams');
    this.closeAllStreams();
    this.clearAllTimeouts();
  }

  /**
   * Start monitoring a payment for incoming transactions
   */
  async monitorPayment(paymentId: string, destinationAddress: string): Promise<void> {
    // Check if already monitoring
    if (this.activeStreams.has(paymentId)) {
      this.logger.warn(`Already monitoring payment ${paymentId}`);
      return;
    }

    this.logger.log(`Starting payment monitor for ${paymentId} on address ${destinationAddress}`);

    try {
      // Stream transactions to this address
      const closeFunction = await this.stellarServer
        .transactions()
        .forAccount(destinationAddress)
        .stream({
          onmessage: (transaction: any) => {
            this.handleIncomingTransaction(paymentId, transaction, destinationAddress);
          },
          onerror: (error: Error) => {
            this.logger.error(
              `Stream error for payment ${paymentId}: ${error.message}`,
              error.stack,
            );
          },
        });

      this.activeStreams.set(paymentId, {
        paymentId,
        destinationAddress,
        closeFunction,
      });

      // Also set up timeout monitoring
      this.setupPaymentTimeout(paymentId);
    } catch (error) {
      this.logger.error(
        `Failed to start monitoring payment ${paymentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Stop monitoring a specific payment
   */
  stopMonitoringPayment(paymentId: string): void {
    const stream = this.activeStreams.get(paymentId);
    if (stream && stream.closeFunction) {
      this.logger.log(`Stopping monitoring for payment ${paymentId}`);
      stream.closeFunction();
      this.activeStreams.delete(paymentId);
    }

    this.clearPaymentTimeout(paymentId);
  }

  /**
   * Handle incoming transaction from Stellar network
   */
  private async handleIncomingTransaction(
    paymentId: string,
    transaction: any,
    destinationAddress: string,
  ): Promise<void> {
    this.logger.log(`Received transaction for payment ${paymentId}: ${transaction.id}`);

    try {
      const payment = await this.paymentsRepository.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        this.logger.warn(`Payment ${paymentId} not found in database`);
        return;
      }

      // Skip if payment already confirmed/failed
      if (payment.status !== PaymentStatus.PENDING) {
        this.logger.log(`Payment ${paymentId} is already ${payment.status}, skipping`);
        return;
      }

      // Check if transaction has operations
      const operations = await transaction.operations();

      for (const operation of operations.records) {
        // Look for payment operations
        if (operation.type === 'payment' || operation.type === 'path_payment_strict_receive') {
          const isRelevantPayment = await this.checkPaymentOperation(
            payment,
            operation,
            destinationAddress,
          );

          if (isRelevantPayment) {
            this.logger.log(
              `Found relevant payment operation in transaction ${transaction.id} for payment ${paymentId}`,
            );

            // Prepare transaction data for verification
            const transactionData = {
              id: transaction.id,
              source_account: operation.from,
              to: operation.to || operation.destination,
              amount: operation.amount,
              asset_code: operation.asset_code || 'XLM',
              created_at: transaction.created_at,
              ledger: transaction.ledger_attr,
              confirmations: 1,
              hash: transaction.hash,
            };

            // Verify and confirm payment
            await this.paymentsService.verifyAndConfirmPayment(paymentId, transactionData);

            // Stop monitoring once confirmed
            this.stopMonitoringPayment(paymentId);

            // Emit confirmation event
            this.eventEmitter.emit('payment.stream.confirmed', {
              paymentId,
              transactionId: transaction.id,
            });

            return;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing transaction for payment ${paymentId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Check if a payment operation matches the expected payment
   */
  private async checkPaymentOperation(
    payment: Payment,
    operation: any,
    destinationAddress: string,
  ): Promise<boolean> {
    // Verify destination matches
    const destination = operation.to || operation.destination;
    if (destination !== destinationAddress) {
      return false;
    }

    // Verify amount matches (with small tolerance)
    const operationAmount = parseFloat(operation.amount);
    const paymentAmount = parseFloat(payment.amount.toString());
    const tolerance = 0.0001;

    if (Math.abs(operationAmount - paymentAmount) > tolerance) {
      this.logger.warn(
        `Amount mismatch for payment ${payment.id}: expected ${paymentAmount}, got ${operationAmount}`,
      );
      return false;
    }

    // Verify asset code matches (if specified)
    if (payment.currency !== PaymentCurrency.XLM) {
      const assetCode = operation.asset_code?.toUpperCase() || 'XLM';
      if (assetCode !== payment.currency) {
        return false;
      }
    }

    return true;
  }

  /**
   * Set up timeout for a payment
   */
  private setupPaymentTimeout(paymentId: string): void {
    const payment = this.paymentsRepository.findOne({ where: { id: paymentId } });

    if (!payment) {
      return;
    }

    // Set timeout based on payment's timeout setting
    const timeoutMs = 30 * 60 * 1000; // Default 30 minutes

    const timeoutHandle = setTimeout(async () => {
      this.logger.log(`Payment ${paymentId} timeout triggered`);

      const currentPayment = await this.paymentsRepository.findOne({
        where: { id: paymentId },
      });

      if (currentPayment && currentPayment.status === PaymentStatus.PENDING) {
        await this.paymentsService.handlePaymentTimeout(paymentId);
        this.stopMonitoringPayment(paymentId);
      }

      this.timeoutIntervals.delete(paymentId);
    }, timeoutMs);

    this.timeoutIntervals.set(paymentId, timeoutHandle);
  }

  /**
   * Clear timeout for a payment
   */
  private clearPaymentTimeout(paymentId: string): void {
    const timeout = this.timeoutIntervals.get(paymentId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeoutIntervals.delete(paymentId);
    }
  }

  /**
   * Set up periodic monitoring of expired payments
   */
  private setupTimeoutMonitoring(): void {
    // Run every 5 minutes to check for expired payments
    const intervalHandle = setInterval(async () => {
      await this.checkAndHandleExpiredPayments();
    }, 5 * 60 * 1000);

    try {
      this.schedulerRegistry.addInterval(
        'payment-timeout-monitor',
        intervalHandle as any,
      );
    } catch (error) {
      // Interval might already exist, that's okay
      this.logger.debug('Payment timeout monitor interval already exists');
    }
  }

  /**
   * Check for payments that have expired and handle them
   */
  private async checkAndHandleExpiredPayments(): Promise<void> {
    const now = new Date();
    const expiredPayments = await this.paymentsRepository.find({
      where: [
        {
          status: PaymentStatus.PENDING,
        },
      ],
    });

    for (const payment of expiredPayments) {
      if (payment.expiresAt && payment.expiresAt < now) {
        this.logger.log(`Handling expired payment ${payment.id}`);
        await this.paymentsService.handlePaymentTimeout(payment.id);
        this.stopMonitoringPayment(payment.id);
      }
    }
  }

  /**
   * Resume monitoring for any pending payments from database
   */
  private async resumePendingPaymentMonitoring(): Promise<void> {
    const pendingPayments = await this.paymentsRepository.find({
      where: { status: PaymentStatus.PENDING },
    });

    this.logger.log(`Found ${pendingPayments.length} pending payments to resume monitoring`);

    for (const payment of pendingPayments) {
      // Check if not expired
      const now = new Date();
      if (payment.expiresAt && payment.expiresAt > now) {
        try {
          await this.monitorPayment(payment.id, payment.destinationWalletAddress);
        } catch (error) {
          this.logger.error(
            `Failed to resume monitoring for payment ${payment.id}: ${error.message}`,
          );
        }
      } else if (payment.expiresAt) {
        // Payment already expired
        await this.paymentsService.handlePaymentTimeout(payment.id);
      }
    }
  }

  /**
   * Close all active streams
   */
  private closeAllStreams(): void {
    for (const [paymentId, stream] of this.activeStreams.entries()) {
      if (stream.closeFunction) {
        try {
          stream.closeFunction();
          this.logger.log(`Closed stream for payment ${paymentId}`);
        } catch (error) {
          this.logger.error(`Error closing stream for payment ${paymentId}: ${error.message}`);
        }
      }
    }
    this.activeStreams.clear();
  }

  /**
   * Clear all timeout intervals
   */
  private clearAllTimeouts(): void {
    for (const [paymentId, timeout] of this.timeoutIntervals.entries()) {
      clearTimeout(timeout);
      this.logger.log(`Cleared timeout for payment ${paymentId}`);
    }
    this.timeoutIntervals.clear();
  }

  /**
   * Get monitoring status for a payment
   */
  isMonitoring(paymentId: string): boolean {
    return this.activeStreams.has(paymentId);
  }

  /**
   * Get count of active streams
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }
}
