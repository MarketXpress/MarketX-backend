import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '@nestjs/config';

import { Payment } from './entities/payment.entity';
import { Order } from 'src/orders/entities/order.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import {
  CreatePaymentDto,
  PaymentStatus,
  PaymentCurrency,
  PaymentResponseDto,
  InitiatePaymentDto,
} from './dto/payment.dto';
import { OrderStatus } from 'src/orders/dto/create-order.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stellarServer: StellarSdk.Horizon.Server;
  private networkPassphrase: string;

  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    // Initialize Stellar SDK
    const horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
    this.stellarServer = new StellarSdk.Horizon.Server(horizonUrl);
    this.networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ||
      StellarSdk.Networks.TESTNET;
  }

  /**
   * Create a pending payment record for an order
   */
  async initiatePayment(initiatePaymentDto: InitiatePaymentDto): Promise<PaymentResponseDto> {
    // Verify order exists and is in PENDING status
    const order = await this.ordersRepository.findOne({
      where: { id: initiatePaymentDto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${initiatePaymentDto.orderId}" not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order must be in PENDING status to initiate payment`);
    }

    // Get or create a payment record
    const existingPayment = await this.paymentsRepository.findOne({
      where: {
        orderId: initiatePaymentDto.orderId,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPayment) {
      return this.mapToResponseDto(existingPayment);
    }

    // Get buyer's wallet to get payment address
    const wallet = await this.walletsRepository.findOne({
      where: { userId: order.buyerId },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for buyer`);
    }

    // Create new payment record
    const timeoutMinutes = initiatePaymentDto.timeoutMinutes || 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + timeoutMinutes);

    const payment = this.paymentsRepository.create({
      orderId: initiatePaymentDto.orderId,
      amount: parseFloat(order.totalAmount.toString()),
      currency: initiatePaymentDto.currency,
      status: PaymentStatus.PENDING,
      destinationWalletAddress: wallet.publicKey,
      timeoutMinutes,
      expiresAt,
      buyerId: order.buyerId,
    });

    const savedPayment = await this.paymentsRepository.save(payment);

    this.logger.log(
      `Payment initiated for order ${initiatePaymentDto.orderId}: ${savedPayment.id}`,
    );

    // Emit event for payment monitoring
    this.eventEmitter.emit('payment.initiated', {
      paymentId: savedPayment.id,
      orderId: initiatePaymentDto.orderId,
      destinationAddress: wallet.publicKey,
      expectedAmount: savedPayment.amount,
      currency: initiatePaymentDto.currency,
    });

    return this.mapToResponseDto(savedPayment);
  }

  /**
   * Verify payment from Stellar network and update payment status
   */
  async verifyAndConfirmPayment(
    paymentId: string,
    transactionData: Record<string, any>,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID "${paymentId}" not found`);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is no longer in PENDING status`);
    }

    // Verify transaction data
    const { isValid, errorMessage } = await this.validateTransaction(payment, transactionData);

    if (!isValid) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = errorMessage;
      payment.failedAt = new Date();
      await this.paymentsRepository.save(payment);

      this.logger.warn(`Payment ${paymentId} validation failed: ${errorMessage}`);

      this.eventEmitter.emit('payment.failed', {
        paymentId,
        orderId: payment.orderId,
        reason: errorMessage,
      });

      return this.mapToResponseDto(payment);
    }

    // Payment is valid, update status
    payment.status = PaymentStatus.CONFIRMED;
    payment.confirmedAt = new Date();
    payment.stellarTransactionId = transactionData.id;
    payment.sourceWalletAddress = transactionData.source_account;
    payment.stellarTransactionData = transactionData;
    payment.confirmationCount = transactionData.confirmations || 1;

    await this.paymentsRepository.save(payment);

    // Update order status to PAID
    const order = payment.order;
    order.status = OrderStatus.PAID;
    order.updatedAt = new Date();
    await this.ordersRepository.save(order);

    this.logger.log(
      `Payment ${paymentId} confirmed. Order ${payment.orderId} updated to PAID status`,
    );

    // Emit event for downstream services
    this.eventEmitter.emit('payment.confirmed', {
      paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      stellarTransactionId: payment.stellarTransactionId,
    });

    return this.mapToResponseDto(payment);
  }

  /**
   * Handle payment timeout
   */
  async handlePaymentTimeout(paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID "${paymentId}" not found`);
    }

    if (payment.status === PaymentStatus.PENDING) {
      payment.status = PaymentStatus.TIMEOUT;
      payment.failureReason = 'Payment timeout - no confirmation received within expected time';
      payment.failedAt = new Date();
      await this.paymentsRepository.save(payment);

      this.logger.warn(`Payment ${paymentId} timed out`);

      this.eventEmitter.emit('payment.timeout', {
        paymentId,
        orderId: payment.orderId,
      });
    }

    return this.mapToResponseDto(payment);
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID "${id}" not found`);
    }

    return this.mapToResponseDto(payment);
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found for order "${orderId}"`);
    }

    return this.mapToResponseDto(payment);
  }

  /**
   * Get all payments for a buyer
   */
  async getPaymentsByBuyerId(buyerId: string): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentsRepository.find({
      where: { buyerId },
      order: { createdAt: 'DESC' },
    });

    return payments.map(payment => this.mapToResponseDto(payment));
  }

  /**
   * Validate Stellar transaction against payment requirements
   */
  private async validateTransaction(
    payment: Payment,
    transactionData: Record<string, any>,
  ): Promise<{ isValid: boolean; errorMessage?: string }> {
    // Verify destination address matches
    if (transactionData.to !== payment.destinationWalletAddress) {
      return {
        isValid: false,
        errorMessage: `Transaction destination ${transactionData.to} does not match payment destination ${payment.destinationWalletAddress}`,
      };
    }

    // Verify amount matches (handle different decimal formats)
    const transactionAmount = parseFloat(transactionData.amount);
    const paymentAmount = parseFloat(payment.amount.toString());

    const tolerance = 0.0001; // Small tolerance for float comparison
    if (Math.abs(transactionAmount - paymentAmount) > tolerance) {
      return {
        isValid: false,
        errorMessage: `Transaction amount ${transactionAmount} does not match expected amount ${paymentAmount}`,
      };
    }

    // Verify asset/currency matches
    if (transactionData.asset_code) {
      const assetCode = transactionData.asset_code.toUpperCase();
      if (assetCode !== payment.currency) {
        return {
          isValid: false,
          errorMessage: `Transaction asset ${assetCode} does not match payment currency ${payment.currency}`,
        };
      }
    }

    // Verify transaction is not expired
    const txTime = new Date(transactionData.created_at);
    const now = new Date();
    const ageMinutes = (now.getTime() - txTime.getTime()) / (1000 * 60);

    if (ageMinutes > payment.timeoutMinutes) {
      return {
        isValid: false,
        errorMessage: `Transaction is too old (${ageMinutes.toFixed(2)} minutes)`,
      };
    }

    return { isValid: true };
  }

  /**
   * Map Payment entity to DTO
   */
  private mapToResponseDto(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: parseFloat(payment.amount.toString()),
      currency: payment.currency,
      status: payment.status,
      stellarTransactionId: payment.stellarTransactionId,
      destinationWalletAddress: payment.destinationWalletAddress,
      sourceWalletAddress: payment.sourceWalletAddress,
      confirmationCount: payment.confirmationCount,
      createdAt: payment.createdAt,
      confirmedAt: payment.confirmedAt,
      expiresAt: payment.expiresAt || new Date(),
    };
  }

  /**
   * Get payment statistics for a buyer
   */
  async getPaymentStats(buyerId: string): Promise<Record<string, any>> {
    const payments = await this.paymentsRepository.find({
      where: { buyerId },
    });

    const stats = {
      totalPayments: payments.length,
      confirmedCount: payments.filter(p => p.status === PaymentStatus.CONFIRMED).length,
      pendingCount: payments.filter(p => p.status === PaymentStatus.PENDING).length,
      failedCount: payments.filter(p => p.status === PaymentStatus.FAILED).length,
      timeoutCount: payments.filter(p => p.status === PaymentStatus.TIMEOUT).length,
      totalConfirmedAmount: payments
        .filter(p => p.status === PaymentStatus.CONFIRMED)
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0),
    };

    return stats;
  }
}
