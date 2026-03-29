/**
 * Application Event Dictionary
 *
 * This file contains all application events with strict typing.
 * Events are organized by domain and follow the pattern: domain.action
 *
 * Usage:
 * - Controllers should emit events using EventEmitter2
 * - Listeners should use @OnEvent decorator to handle side-effects
 * - This decouples business logic from side-effects (email, notifications, analytics, etc.)
 */

// ============================================================================
// ORDER EVENTS
// ============================================================================

export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly totalAmount: number,
    public readonly items: any[],
    public readonly currency: string = 'USD',
  ) {}
}

export class OrderUpdatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly status: string,
    public readonly previousStatus: string,
  ) {}
}

export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly reason: string,
  ) {}
}

export class OrderCompletedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly totalAmount: number,
  ) {}
}

// ============================================================================
// PAYMENT EVENTS
// ============================================================================

export class PaymentInitiatedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly destinationAddress: string,
    public readonly expectedAmount: number,
    public readonly currency: string,
  ) {}
}

export class PaymentConfirmedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly stellarTransactionId: string,
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly userId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly reason: string,
  ) {}
}

export class PaymentTimeoutEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
  ) {}
}

export class PaymentStreamConfirmedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly stellarTransactionId: string,
  ) {}
}

export class PaymentReleasedEvent {
  constructor(
    public readonly escrowId: string,
    public readonly orderId: string,
    public readonly sellerPublicKey: string,
    public readonly amount: number,
    public readonly releaseTransactionHash: string,
    public readonly releasedAt: Date,
    public readonly autoReleased: boolean = true,
  ) {}
}

// ============================================================================
// USER/AUTH EVENTS
// ============================================================================

export class UserPasswordChangedEvent {
  constructor(
    public readonly actionType: 'PASSWORD_CHANGE',
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly status: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
    public readonly errorMessage?: string,
    public readonly resourceType: string = 'user',
    public readonly resourceId?: string,
    public readonly statePreviousValue?: Record<string, any>,
    public readonly stateNewValue?: Record<string, any>,
    public readonly metadata?: Record<string, any>,
  ) {}
}

export class UserEmailChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly oldEmail: string,
    public readonly newEmail: string,
    public readonly userAgent?: string,
  ) {}
}

export class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly changes: Record<string, any>,
    public readonly userAgent?: string,
  ) {}
}

export class UserPermissionsChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly previousPermissions: string[],
    public readonly newPermissions: string[],
    public readonly userAgent?: string,
  ) {}
}

export class AuthPasswordResetRequestedEvent {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly resetUrl: string,
  ) {}
}

// ============================================================================
// WALLET EVENTS
// ============================================================================

export class WalletWithdrawalRequestedEvent {
  constructor(
    public readonly actionType: 'WITHDRAWAL',
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly status: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
    public readonly errorMessage?: string,
    public readonly resourceType: string = 'wallet',
    public readonly resourceId?: string,
    public readonly statePreviousValue?: Record<string, any>,
    public readonly stateNewValue?: Record<string, any>,
    public readonly metadata?: Record<string, any>,
  ) {}
}

export class WalletWithdrawalCompletedEvent {
  constructor(
    public readonly actionType: 'WITHDRAWAL',
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly status: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
    public readonly errorMessage?: string,
    public readonly resourceType: string = 'wallet',
    public readonly resourceId?: string,
    public readonly metadata?: Record<string, any>,
  ) {}
}

export class WalletDepositRequestedEvent {
  constructor(
    public readonly actionType: 'DEPOSIT',
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly status: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
    public readonly errorMessage?: string,
    public readonly resourceType: string = 'wallet',
    public readonly resourceId?: string,
    public readonly statePreviousValue?: Record<string, any>,
    public readonly stateNewValue?: Record<string, any>,
    public readonly metadata?: Record<string, any>,
  ) {}
}

// ============================================================================
// REFUND/RETURN EVENTS
// ============================================================================

export class ReturnRequestedEvent {
  constructor(
    public readonly returnRequestId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
  ) {}
}

export class ReturnReviewedEvent {
  constructor(
    public readonly returnRequestId: string,
    public readonly status: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
  ) {}
}

export class RefundRequestedEvent {
  constructor(
    public readonly refundId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly amount: number,
  ) {}
}

export class RefundProcessedEvent {
  constructor(
    public readonly refundId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly amount: number,
    public readonly txHash: string,
  ) {}
}

export class RefundRejectedEvent {
  constructor(
    public readonly refundId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
  ) {}
}

export class RefundFailedEvent {
  constructor(
    public readonly refundId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly error: string,
  ) {}
}

export class RefundInventoryRestoreEvent {
  constructor(public readonly orderId: string) {}
}

// ============================================================================
// INVENTORY EVENTS
// ============================================================================

export class InventoryLowStockEvent {
  constructor(
    public readonly productId: string,
    public readonly title: string,
    public readonly available: number,
    public readonly listingId?: string,
  ) {}
}

// ============================================================================
// PRODUCT EVENTS
// ============================================================================

export class ProductPriceUpdatedEvent {
  constructor(
    public readonly productId: string,
    public readonly sellerId: string,
    public readonly basePrice: string,
    public readonly basePriceMinor: string,
    public readonly baseCurrency: string,
    public readonly rateSnapshot: Record<string, string | number>,
    public readonly rateTimestamp: string,
    public readonly updatedAt: Date,
  ) {}
}

// ============================================================================
// NOTIFICATION EVENTS
// ============================================================================

export class NotificationCreatedEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string,
    public readonly message: string,
    public readonly channel: string,
  ) {}
}

export class NotificationSendPushEvent {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly message: string,
    public readonly data?: Record<string, any>,
  ) {}
}

export class NotificationReadEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
  ) {}
}

// ============================================================================
// MESSAGE EVENTS
// ============================================================================

export class MessageReceivedEvent {
  constructor(
    public readonly messageId: string,
    public readonly recipientId: string,
    public readonly senderId: string,
    public readonly senderName: string,
    public readonly content: string,
    public readonly conversationId: string,
  ) {}
}

// ============================================================================
// SHIPPING EVENTS
// ============================================================================

export class ShipmentCreatedEvent {
  constructor(
    public readonly shipmentId: string,
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly carrier: string,
  ) {}
}

export class ShipmentStatusUpdatedEvent {
  constructor(
    public readonly shipmentId: string,
    public readonly orderId: string,
    public readonly status: string,
    public readonly previousStatus: string,
  ) {}
}

// ============================================================================
// ACCOUNT EVENTS
// ============================================================================

export class AccountModifiedEvent {
  constructor(
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly actionType: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly userAgent?: string,
    public readonly statePreviousValue?: Record<string, any>,
    public readonly stateNewValue?: Record<string, any>,
    public readonly metadata?: Record<string, any>,
  ) {}
}

// ============================================================================
// EVENT NAME CONSTANTS
// ============================================================================

export const EventNames = {
  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_COMPLETED: 'order.completed',

  // Payment events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_TIMEOUT: 'payment.timeout',
  PAYMENT_STREAM_CONFIRMED: 'payment.stream.confirmed',
  PAYMENT_RELEASED: 'payment.released',

  // User/Auth events
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_EMAIL_CHANGED: 'user.email_changed',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_PERMISSIONS_CHANGED: 'user.permissions_changed',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',

  // Wallet events
  WALLET_WITHDRAWAL_REQUESTED: 'wallet.withdrawal_requested',
  WALLET_WITHDRAWAL_COMPLETED: 'wallet.withdrawal_completed',
  WALLET_DEPOSIT_REQUESTED: 'wallet.deposit_requested',

  // Refund/Return events
  RETURN_REQUESTED: 'return.requested',
  RETURN_REVIEWED: 'return.reviewed',
  REFUND_REQUESTED: 'refund.requested',
  REFUND_PROCESSED: 'refund.processed',
  REFUND_REJECTED: 'refund.rejected',
  REFUND_FAILED: 'refund.failed',
  REFUND_INVENTORY_RESTORE: 'refund.inventory.restore',

  // Inventory events
  INVENTORY_LOW_STOCK: 'inventory.low_stock',

  // Product events
  PRODUCT_PRICE_UPDATED: 'product.price.updated',

  // Notification events
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_SEND_PUSH: 'notification.send_push',
  NOTIFICATION_READ: 'notification.read',

  // Message events
  MESSAGE_RECEIVED: 'message.received',

  // Shipping events
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_STATUS_UPDATED: 'shipment.status_updated',

  // Account events
  ACCOUNT_MODIFIED: 'account.modified',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
