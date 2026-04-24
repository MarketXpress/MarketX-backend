/**
 * Standard interface for all audit events
 * This ensures consistency across all events emitted in the application
 */
import { AuditActionType, AuditStatus } from '../entities/audit-log.entity';

export interface IAuditEvent {
  /**
   * Event type - corresponds to AuditActionType
   */
  actionType: AuditActionType | string;

  /**
   * User ID performing the action
   */
  userId: string;

  /**
   * IP Address of the request source
   */
  ipAddress: string;

  /**
   * User agent string from the request
   */
  userAgent?: string;

  /**
   * Previous state of the resource
   */
  statePreviousValue?: Record<string, any>;

  /**
   * New state of the resource
   */
  stateNewValue?: Record<string, any>;

  /**
   * Resource type (e.g., 'user', 'wallet', 'order')
   */
  resourceType?: string;

  /**
   * Resource ID
   */
  resourceId?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Timestamp of the event
   */
  timestamp?: Date;

  /**
   * Status of the operation
   */
  status?: AuditStatus | string;

  /**
   * Error message if operation failed
   */
  errorMessage?: string;
}

/**
 * Event payload for password change
 */
export interface IPasswordChangeEvent extends IAuditEvent {
  actionType: 'PASSWORD_CHANGE';
  userId: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: {
    changedAt?: Date;
    reason?: string;
  };
}

/**
 * Event payload for withdrawal
 */
export interface IWithdrawalEvent extends IAuditEvent {
  actionType: 'WITHDRAWAL';
  userId: string;
  ipAddress: string;
  resourceType: 'wallet';
  resourceId: string;
  metadata?: {
    amount: number;
    currency: string;
    destination: string;
    transactionHash?: string;
  };
}

/**
 * Event payload for email change
 */
export interface IEmailChangeEvent extends IAuditEvent {
  actionType: 'EMAIL_CHANGE';
  userId: string;
  ipAddress: string;
  statePreviousValue: { email: string };
  stateNewValue: { email: string };
  metadata?: {
    verificationRequired: boolean;
  };
}
