import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreatePaymentIntentOptions {
  amount: number; // Amount in cents
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  applicationFeeAmount?: number;
  transferData?: {
    destination: string; // Seller's Stripe account ID
  };
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
}

@Injectable()
export class StripePaymentService implements OnModuleInit {
  private stripe: Stripe;
  private readonly logger = new Logger(StripePaymentService.name);
  private platformFeePercent: number;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const stripeApiKey = this.configService.get<string>('STRIPE_API_KEY');

    if (!stripeApiKey) {
      this.logger.warn(
        'Stripe API key not configured. Payment functionality will be disabled.',
      );
      return;
    }

    this.stripe = new Stripe(stripeApiKey, {
      // Use default API version
    });

    this.platformFeePercent =
      this.configService.get<number>('PLATFORM_FEE_PERCENT') || 10;
    this.logger.log('Stripe payment service initialized');
  }

  isInitialized(): boolean {
    return !!this.stripe;
  }

  /**
   * Create a PaymentIntent for escrow funding
   * Automatically applies platform fee as application_fee
   */
  async createEscrowPaymentIntent(
    options: CreatePaymentIntentOptions,
  ): Promise<PaymentIntentResult> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    const {
      amount,
      currency = 'usd',
      customerId,
      metadata,
      applicationFeeAmount,
      transferData,
    } = options;

    // Calculate platform fee if not provided
    const feeAmount =
      applicationFeeAmount ??
      Math.round(amount * (this.platformFeePercent / 100));

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount,
      currency,
      payment_method_types: ['card'],
      metadata: {
        ...metadata,
        type: 'escrow_funding',
      },
    };

    if (customerId) {
      paymentIntentParams.customer = customerId;
    }

    // Set up application fee and transfer for marketplace payout
    if (transferData) {
      paymentIntentParams.application_fee_amount = feeAmount;
      paymentIntentParams.transfer_data = {
        destination: transferData.destination,
      };
    } else {
      // Just collect the fee, no transfer (for held funds)
      paymentIntentParams.metadata!['platformFee'] = feeAmount.toString();
    }

    try {
      const paymentIntent =
        await this.stripe.paymentIntents.create(paymentIntentParams);

      this.logger.log(
        `Created payment intent ${paymentIntent.id} for amount ${amount}`,
      );

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create payment intent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve a PaymentIntent
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent | null> {
    if (!this.stripe) {
      return null;
    }

    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      this.logger.error(`Failed to retrieve payment intent: ${error.message}`);
      return null;
    }
  }

  /**
   * Confirm a PaymentIntent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<PaymentIntentResult | null> {
    if (!this.stripe) {
      return null;
    }

    try {
      const confirmParams: Stripe.PaymentIntentConfirmParams = {};
      if (paymentMethodId) {
        confirmParams.payment_method = paymentMethodId;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        confirmParams,
      );

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error: any) {
      this.logger.error(`Failed to confirm payment intent: ${error.message}`);
      return null;
    }
  }

  /**
   * Cancel a PaymentIntent (for refunds)
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<boolean> {
    if (!this.stripe) {
      return false;
    }

    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      this.logger.log(`Cancelled payment intent ${paymentIntentId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to cancel payment intent: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a refund for a PaymentIntent
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund | null> {
    if (!this.stripe) {
      return null;
    }

    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundParams.amount = amount; // Partial refund
      }

      const refund = await this.stripe.refunds.create(refundParams);
      this.logger.log(
        `Created refund ${refund.id} for payment intent ${paymentIntentId}`,
      );

      return refund;
    } catch (error: any) {
      this.logger.error(`Failed to create refund: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a Stripe Connect account for a seller
   */
  async createConnectAccount(
    email: string,
    businessType: 'individual' | 'company' = 'individual',
  ): Promise<{ accountId: string; onboardingUrl: string } | null> {
    if (!this.stripe) {
      return null;
    }

    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        business_type: businessType,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      const accountLink = await this.stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${this.configService.get('APP_URL')}/stripe/reauth`,
        return_url: `${this.configService.get('APP_URL')}/stripe/return`,
        type: 'account_onboarding',
      });

      return {
        accountId: account.id,
        onboardingUrl: accountLink.url,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create Connect account: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the platform fee percentage
   */
  getPlatformFeePercent(): number {
    return this.platformFeePercent;
  }
}
