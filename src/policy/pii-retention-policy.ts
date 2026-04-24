/**
 * PII Retention Policy Configuration
 *
 * This file defines the retention periods and purge schedules for different types of
 * Personally Identifiable Information (PII) in compliance with GDPR, CCPA, and other data protection regulations.
 */

export enum PIIDataType {
  EMAIL = 'email',
  PHONE = 'phone',
  NAME = 'name',
  ADDRESS = 'address',
  IP_ADDRESS = 'ip_address',
  FINANCIAL_DATA = 'financial_data',
  COMMUNICATION_PREFERENCES = 'communication_preferences',
  VERIFICATION_DOCUMENTS = 'verification_documents',
  TRANSACTION_HISTORY = 'transaction_history',
  SUPPORT_TICKETS = 'support_tickets',
  AUDIT_LOGS = 'audit_logs',
  ANALYTICS_DATA = 'analytics_data',
}

export enum RetentionTrigger {
  ACCOUNT_DELETION = 'account_deletion',
  ACCOUNT_INACTIVE = 'account_inactive',
  LEGAL_HOLD = 'legal_hold',
  CONSENT_WITHDRAWN = 'consent_withdrawn',
  BUSINESS_NECESSITY_EXPIRED = 'business_necessity_expired',
  REGULATORY_REQUIREMENT = 'regulatory_requirement',
}

export interface PIIRetentionRule {
  dataType: PIIDataType;
  retentionPeriodDays: number;
  purgeMethod: PurgeMethod;
  retentionTrigger: RetentionTrigger;
  requiresLegalHold: boolean;
  requiresConsent: boolean;
  businessJustification: string;
  applicableRegulations: string[];
}

export enum PurgeMethod {
  SOFT_DELETE = 'soft_delete', // Mark as deleted but keep for audit
  ANONYMIZE = 'anonymize', // Replace with pseudonymous data
  SECURE_DELETE = 'secure_delete', // Permanent deletion with data overwrite
  ARCHIVE_THEN_DELETE = 'archive_then_delete', // Archive for compliance then delete
}

export const PII_RETENTION_POLICY: Record<PIIDataType, PIIRetentionRule> = {
  [PIIDataType.EMAIL]: {
    dataType: PIIDataType.EMAIL,
    retentionPeriodDays: 365, // 1 year for inactive accounts, 7 years for deleted accounts
    purgeMethod: PurgeMethod.ANONYMIZE,
    retentionTrigger: RetentionTrigger.ACCOUNT_INACTIVE,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'User identification and communication',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'CCPA 1798.105', 'PECR'],
  },

  [PIIDataType.PHONE]: {
    dataType: PIIDataType.PHONE,
    retentionPeriodDays: 365,
    purgeMethod: PurgeMethod.ANONYMIZE,
    retentionTrigger: RetentionTrigger.ACCOUNT_INACTIVE,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'User verification and communication',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'CCPA 1798.105'],
  },

  [PIIDataType.NAME]: {
    dataType: PIIDataType.NAME,
    retentionPeriodDays: 2555, // 7 years for financial records
    purgeMethod: PurgeMethod.ANONYMIZE,
    retentionTrigger: RetentionTrigger.ACCOUNT_DELETION,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'Financial and legal compliance',
    applicableRegulations: [
      'GDPR Art. 5(1)(e)',
      'CCPA 1798.105',
      'AML KYC requirements',
    ],
  },

  [PIIDataType.ADDRESS]: {
    dataType: PIIDataType.ADDRESS,
    retentionPeriodDays: 1825, // 5 years for shipping records
    purgeMethod: PurgeMethod.ANONYMIZE,
    retentionTrigger: RetentionTrigger.BUSINESS_NECESSITY_EXPIRED,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'Shipping and transaction records',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'CCPA 1798.105'],
  },

  [PIIDataType.IP_ADDRESS]: {
    dataType: PIIDataType.IP_ADDRESS,
    retentionPeriodDays: 90, // 3 months for security logs
    purgeMethod: PurgeMethod.SECURE_DELETE,
    retentionTrigger: RetentionTrigger.REGULATORY_REQUIREMENT,
    requiresLegalHold: false,
    requiresConsent: false,
    businessJustification: 'Security monitoring and fraud prevention',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'ePrivacy Directive'],
  },

  [PIIDataType.FINANCIAL_DATA]: {
    dataType: PIIDataType.FINANCIAL_DATA,
    retentionPeriodDays: 2555, // 7 years for tax compliance
    purgeMethod: PurgeMethod.ARCHIVE_THEN_DELETE,
    retentionTrigger: RetentionTrigger.BUSINESS_NECESSITY_EXPIRED,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'Tax compliance and financial regulations',
    applicableRegulations: [
      'GDPR Art. 5(1)(e)',
      'CCPA 1798.105',
      'Tax regulations',
    ],
  },

  [PIIDataType.COMMUNICATION_PREFERENCES]: {
    dataType: PIIDataType.COMMUNICATION_PREFERENCES,
    retentionPeriodDays: 365,
    purgeMethod: PurgeMethod.SECURE_DELETE,
    retentionTrigger: RetentionTrigger.CONSENT_WITHDRAWN,
    requiresLegalHold: false,
    requiresConsent: true,
    businessJustification: 'Marketing and user communication',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'CCPA 1798.105', 'CAN-SPAM'],
  },

  [PIIDataType.VERIFICATION_DOCUMENTS]: {
    dataType: PIIDataType.VERIFICATION_DOCUMENTS,
    retentionPeriodDays: 1825, // 5 years for KYC compliance
    purgeMethod: PurgeMethod.SECURE_DELETE,
    retentionTrigger: RetentionTrigger.BUSINESS_NECESSITY_EXPIRED,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'KYC and AML compliance',
    applicableRegulations: [
      'GDPR Art. 5(1)(e)',
      'CCPA 1798.105',
      'AML KYC requirements',
    ],
  },

  [PIIDataType.TRANSACTION_HISTORY]: {
    dataType: PIIDataType.TRANSACTION_HISTORY,
    retentionPeriodDays: 2555, // 7 years for financial compliance
    purgeMethod: PurgeMethod.ARCHIVE_THEN_DELETE,
    retentionTrigger: RetentionTrigger.BUSINESS_NECESSITY_EXPIRED,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'Financial compliance and dispute resolution',
    applicableRegulations: [
      'GDPR Art. 5(1)(e)',
      'CCPA 1798.105',
      'Tax regulations',
    ],
  },

  [PIIDataType.SUPPORT_TICKETS]: {
    dataType: PIIDataType.SUPPORT_TICKETS,
    retentionPeriodDays: 1825, // 5 years for service quality
    purgeMethod: PurgeMethod.ANONYMIZE,
    retentionTrigger: RetentionTrigger.BUSINESS_NECESSITY_EXPIRED,
    requiresLegalHold: false,
    requiresConsent: false,
    businessJustification: 'Service improvement and dispute resolution',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'CCPA 1798.105'],
  },

  [PIIDataType.AUDIT_LOGS]: {
    dataType: PIIDataType.AUDIT_LOGS,
    retentionPeriodDays: 2555, // 7 years for security compliance
    purgeMethod: PurgeMethod.SECURE_DELETE,
    retentionTrigger: RetentionTrigger.REGULATORY_REQUIREMENT,
    requiresLegalHold: true,
    requiresConsent: false,
    businessJustification: 'Security monitoring and compliance',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'SOX', 'PCI DSS'],
  },

  [PIIDataType.ANALYTICS_DATA]: {
    dataType: PIIDataType.ANALYTICS_DATA,
    retentionPeriodDays: 730, // 2 years for business analytics
    purgeMethod: PurgeMethod.ANONYMIZE,
    retentionTrigger: RetentionTrigger.BUSINESS_NECESSITY_EXPIRED,
    requiresLegalHold: false,
    requiresConsent: false,
    businessJustification: 'Business analytics and product improvement',
    applicableRegulations: ['GDPR Art. 5(1)(e)', 'CCPA 1798.105'],
  },
};

export interface PIIRetentionSchedule {
  dataType: PIIDataType;
  checkIntervalHours: number;
  batchSize: number;
  maxRetries: number;
  retryDelayMinutes: number;
  notificationChannels: string[];
}

export interface LegalHold {
  id: string;
  userId: string;
  dataType: PIIDataType;
  reason: string;
  placedAt: Date;
  expiresAt?: Date;
  placedBy: string;
  isActive: boolean;
}

export const PII_RETENTION_SCHEDULES: Record<
  PIIDataType,
  PIIRetentionSchedule
> = {
  [PIIDataType.EMAIL]: {
    dataType: PIIDataType.EMAIL,
    checkIntervalHours: 24,
    batchSize: 1000,
    maxRetries: 3,
    retryDelayMinutes: 60,
    notificationChannels: ['email', 'slack'],
  },
  [PIIDataType.PHONE]: {
    dataType: PIIDataType.PHONE,
    checkIntervalHours: 24,
    batchSize: 1000,
    maxRetries: 3,
    retryDelayMinutes: 60,
    notificationChannels: ['email', 'slack'],
  },
  [PIIDataType.NAME]: {
    dataType: PIIDataType.NAME,
    checkIntervalHours: 168, // Weekly
    batchSize: 500,
    maxRetries: 3,
    retryDelayMinutes: 60,
    notificationChannels: ['email'],
  },
  [PIIDataType.ADDRESS]: {
    dataType: PIIDataType.ADDRESS,
    checkIntervalHours: 168,
    batchSize: 500,
    maxRetries: 3,
    retryDelayMinutes: 60,
    notificationChannels: ['email'],
  },
  [PIIDataType.IP_ADDRESS]: {
    dataType: PIIDataType.IP_ADDRESS,
    checkIntervalHours: 24,
    batchSize: 5000,
    maxRetries: 3,
    retryDelayMinutes: 30,
    notificationChannels: ['slack'],
  },
  [PIIDataType.FINANCIAL_DATA]: {
    dataType: PIIDataType.FINANCIAL_DATA,
    checkIntervalHours: 168,
    batchSize: 100,
    maxRetries: 5,
    retryDelayMinutes: 120,
    notificationChannels: ['email', 'slack', 'compliance'],
  },
  [PIIDataType.COMMUNICATION_PREFERENCES]: {
    dataType: PIIDataType.COMMUNICATION_PREFERENCES,
    checkIntervalHours: 24,
    batchSize: 2000,
    maxRetries: 3,
    retryDelayMinutes: 60,
    notificationChannels: ['email'],
  },
  [PIIDataType.VERIFICATION_DOCUMENTS]: {
    dataType: PIIDataType.VERIFICATION_DOCUMENTS,
    checkIntervalHours: 168,
    batchSize: 50,
    maxRetries: 5,
    retryDelayMinutes: 120,
    notificationChannels: ['email', 'slack', 'compliance'],
  },
  [PIIDataType.TRANSACTION_HISTORY]: {
    dataType: PIIDataType.TRANSACTION_HISTORY,
    checkIntervalHours: 168,
    batchSize: 200,
    maxRetries: 5,
    retryDelayMinutes: 120,
    notificationChannels: ['email', 'slack', 'compliance'],
  },
  [PIIDataType.SUPPORT_TICKETS]: {
    dataType: PIIDataType.SUPPORT_TICKETS,
    checkIntervalHours: 168,
    batchSize: 500,
    maxRetries: 3,
    retryDelayMinutes: 60,
    notificationChannels: ['email'],
  },
  [PIIDataType.AUDIT_LOGS]: {
    dataType: PIIDataType.AUDIT_LOGS,
    checkIntervalHours: 24,
    batchSize: 1000,
    maxRetries: 5,
    retryDelayMinutes: 120,
    notificationChannels: ['slack', 'compliance'],
  },
  [PIIDataType.ANALYTICS_DATA]: {
    dataType: PIIDataType.ANALYTICS_DATA,
    checkIntervalHours: 168,
    batchSize: 1000,
    maxRetries: 3,
    retryDelayMinutes: 60,
    notificationChannels: ['email'],
  },
};
