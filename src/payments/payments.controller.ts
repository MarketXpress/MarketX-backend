import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { PaymentMonitorService } from './payment-monitor.service';
import {
  InitiatePaymentDto,
  PaymentResponseDto,
  PaymentStatusDto,
  PaymentWebhookDto,
  PaymentCurrency,
} from './dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentMonitorService: PaymentMonitorService,
  ) {}

  /**
   * Initiate a payment for an order
   */
  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate a payment for an order',
    description: 'Creates a pending payment and returns wallet address for payment',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid order or order not in PENDING status',
  })
  @ApiResponse({
    status: 404,
    description: 'Order or wallet not found',
  })
  async initiatePayment(
    @Body() initiatePaymentDto: InitiatePaymentDto,
  ): Promise<PaymentResponseDto> {
    this.logger.log(
      `Initiating payment for order ${initiatePaymentDto.orderId} with currency ${initiatePaymentDto.currency}`,
    );

    if (!Object.values(PaymentCurrency).includes(initiatePaymentDto.currency)) {
      throw new BadRequestException(
        `Invalid currency. Supported: ${Object.values(PaymentCurrency).join(', ')}`,
      );
    }

    const payment = await this.paymentsService.initiatePayment(initiatePaymentDto);

    // Start monitoring the payment
    try {
      await this.paymentMonitorService.monitorPayment(
        payment.id,
        payment.destinationWalletAddress,
      );
      this.logger.log(`Started monitoring payment ${payment.id}`);
    } catch (error) {
      this.logger.error(`Failed to start monitoring payment: ${error.message}`);
      // Don't fail the request if monitoring fails, client can retry
    }

    return payment;
  }

  /**
   * Get payment status by payment ID
   */
  @Get(':paymentId')
  @ApiOperation({
    summary: 'Get payment status',
    description: 'Retrieve current status and details of a payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async getPaymentStatus(@Param('paymentId') paymentId: string): Promise<PaymentResponseDto> {
    this.logger.log(`Fetching payment status for ${paymentId}`);
    return await this.paymentsService.getPaymentById(paymentId);
  }

  /**
   * Get payment by order ID
   */
  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Get payment by order ID',
    description: 'Retrieve payment details associated with an order',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found for order',
  })
  async getPaymentByOrderId(@Param('orderId') orderId: string): Promise<PaymentResponseDto> {
    this.logger.log(`Fetching payment for order ${orderId}`);
    return await this.paymentsService.getPaymentByOrderId(orderId);
  }

  /**
   * Stellar webhook endpoint for payment confirmations
   * This endpoint receives transaction callbacks from Stellar Horizon
   */
  @Post('webhook/stellar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stellar payment webhook',
    description:
      'Webhook endpoint for receiving payment confirmations from Stellar network. Called by external payment processor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook data',
  })
  async handleStellarWebhook(@Body() webhookData: PaymentWebhookDto): Promise<{ status: string }> {
    this.logger.log(`Received Stellar webhook for transaction ${webhookData.transactionHash}`);

    try {
      // Validate webhook data
      if (!webhookData.destinationAccount || !webhookData.amount || !webhookData.transactionHash) {
        throw new BadRequestException('Missing required webhook fields');
      }

      // Find payment by destination address
      // In production, you'd want additional webhook signature verification
      // for security purposes
      // Note: This is a simplified implementation

      this.logger.log(
        `Webhook received for destination ${webhookData.destinationAccount} amount ${webhookData.amount}`,
      );

      return {
        status: 'received',
      };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Manual payment verification endpoint
   * Useful for clients to verify payment without waiting for webhook
   */
  @Post(':paymentId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually verify a payment',
    description:
      'Trigger manual verification of a payment. Useful when webhook is delayed or missed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async manualVerifyPayment(
    @Param('paymentId') paymentId: string,
    @Body() transactionData: Record<string, any>,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Manual verification requested for payment ${paymentId}`);

    if (!transactionData.id || !transactionData.amount) {
      throw new BadRequestException('Transaction data must include id and amount');
    }

    return await this.paymentsService.verifyAndConfirmPayment(paymentId, transactionData);
  }

  /**
   * Get payment statistics for buyer
   */
  @Get('buyer/:buyerId/stats')
  @ApiOperation({
    summary: 'Get payment statistics for buyer',
    description: 'Retrieve aggregate payment statistics for a buyer',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Buyer not found',
  })
  async getPaymentStats(@Param('buyerId') buyerId: string): Promise<Record<string, any>> {
    this.logger.log(`Fetching payment stats for buyer ${buyerId}`);
    return await this.paymentsService.getPaymentStats(buyerId);
  }

  /**
   * Get monitoring status
   * Used for debugging and monitoring
   */
  @Get('monitor/status')
  @ApiOperation({
    summary: 'Get payment monitor status',
    description: 'Get current payment monitoring service status',
  })
  @ApiResponse({
    status: 200,
    description: 'Monitor status retrieved',
  })
  async getMonitorStatus(): Promise<{ activeStreams: number }> {
    return {
      activeStreams: this.paymentMonitorService.getActiveStreamCount(),
    };
  }
}
