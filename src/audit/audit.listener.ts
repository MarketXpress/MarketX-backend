import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from './audit.service';
import { IAuditEvent } from './interfaces/audit-event.interface';

/**
 * Global Event Listener for Audit Logging
 * Listens to critical account modification events across the application
 * and logs them with immutable append-only records
 */
@Injectable()
export class AuditEventListener {
  private readonly logger = new Logger(AuditEventListener.name);

  constructor(private readonly auditService: AuditService) {}

  /**
   * Handle password change events
   * Event: user.password_changed
   * Required fields: userId, ipAddress, oldPassword hash, newPassword hash
   */
  @OnEvent('user.password_changed')
  async handlePasswordChange(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Password change event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'PASSWORD_CHANGE',
        resourceType: 'user',
        resourceId: event.userId,
        // Password fields are intentionally redacted for security
        // Only track that a change occurred, not the values themselves
        statePreviousValue: event.statePreviousValue
          ? { passwordUpdated: true }
          : undefined,
        stateNewValue: event.stateNewValue
          ? { passwordUpdated: true }
          : undefined,
      });

      this.logger.log(
        `✓ Audit log recorded: Password changed for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log password change: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle email change events
   * Event: user.email_changed
   * Required fields: userId, ipAddress, oldEmail, newEmail
   */
  @OnEvent('user.email_changed')
  async handleEmailChange(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Email change event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'EMAIL_CHANGE',
        resourceType: 'user',
        resourceId: event.userId,
      });

      this.logger.log(
        `✓ Audit log recorded: Email changed for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log email change: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle wallet withdrawal events
   * Event: wallet.withdrawal_requested
   * Required fields: userId, ipAddress, amount, destination, walletId
   */
  @OnEvent('wallet.withdrawal_requested')
  async handleWithdrawalRequested(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Withdrawal requested event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'WITHDRAWAL',
        resourceType: 'wallet',
        resourceId: event.resourceId || event.userId,
        status: 'SUCCESS',
      });

      this.logger.log(
        `✓ Audit log recorded: Withdrawal requested by user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log withdrawal request: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle wallet withdrawal completion events
   * Event: wallet.withdrawal_completed
   * Required fields: userId, ipAddress, transactionHash, amount
   */
  @OnEvent('wallet.withdrawal_completed')
  async handleWithdrawalCompleted(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Withdrawal completed event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'WITHDRAWAL',
        resourceType: 'wallet',
        resourceId: event.resourceId || event.userId,
        status: 'SUCCESS',
      });

      this.logger.log(
        `✓ Audit log recorded: Withdrawal completed for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log withdrawal completion: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle user profile update events
   * Event: user.profile_updated
   * Required fields: userId, ipAddress, previous state, current state
   */
  @OnEvent('user.profile_updated')
  async handleProfileUpdate(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Profile update event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'UPDATE',
        resourceType: 'user_profile',
        resourceId: event.userId,
      });

      this.logger.log(
        `✓ Audit log recorded: Profile updated for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log profile update: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle generic account modification events
   * Event: account.modified
   * Catch-all for any critical account modification
   */
  @OnEvent('account.modified')
  async handleAccountModified(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Account modified event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange(event);

      this.logger.log(
        `✓ Audit log recorded: Account modified for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log account modification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle permission or role changes
   * Event: user.permissions_changed
   * Required fields: userId, ipAddress, previousPermissions, newPermissions
   */
  @OnEvent('user.permissions_changed')
  async handlePermissionsChanged(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Permissions changed event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'PERMISSION_CHANGE',
        resourceType: 'user_permissions',
        resourceId: event.userId,
      });

      this.logger.log(
        `✓ Audit log recorded: Permissions changed for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log permissions change: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle fraud alert creation events
   * Event: fraud.alert_created
   * Required fields: userId, ipAddress, riskScore, triggeredRules
   */
  @OnEvent('fraud.alert_created')
  async handleFraudAlertCreated(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Fraud alert created event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'FRAUD_ALERT',
        resourceType: 'fraud_alert',
        resourceId: event.resourceId,
      });

      this.logger.log(
        `✓ Audit log recorded: Fraud alert created for user ${event.userId} (score: ${event.metadata?.riskScore})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log fraud alert creation: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle fraud account lockout events
   * Event: fraud.account_locked
   * Required fields: userId, ipAddress, fraudAlertId, riskScore, flagCount
   */
  @OnEvent('fraud.account_locked')
  async handleFraudAccountLocked(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Fraud account lockout event received for user ${event.userId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'FRAUD_LOCKOUT',
        resourceType: 'user',
        resourceId: event.userId,
        status: 'WARNING',
      });

      this.logger.log(
        `✓ Audit log recorded: Account locked due to fraud for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log fraud account lockout: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle fraud alert review events
   * Event: fraud.alert_reviewed
   * Required fields: userId (reviewer), resourceId (alertId), reviewAction
   */
  @OnEvent('fraud.alert_reviewed')
  async handleFraudAlertReviewed(event: IAuditEvent) {
    try {
      this.logger.debug(
        `Audit: Fraud alert reviewed event received for alert ${event.resourceId}`,
      );

      await this.auditService.logStateChange({
        ...event,
        actionType: 'FRAUD_REVIEW',
        resourceType: 'fraud_alert',
        resourceId: event.resourceId,
      });

      this.logger.log(
        `✓ Audit log recorded: Fraud alert ${event.resourceId} reviewed by ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log fraud alert review: ${error.message}`,
        error.stack,
      );
    }
  }
}
