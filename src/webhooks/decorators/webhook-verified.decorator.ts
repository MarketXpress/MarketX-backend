import { SetMetadata } from '@nestjs/common';
import { WEBHOOK_VERIFIED_OPTIONS } from '../constants/webhook.constants';

export interface WebhookVerifiedOptions {
  secretHeader?: string;
  signatureHeader?: string;
  timestampHeader?: string;
  nonceHeader?: string;
  timestampToleranceMs?: number;
  provider?: 'stripe' | 'sendgrid' | 'stellar' | 'generic';
}

export const WebhookVerified = (options: WebhookVerifiedOptions = {}) => {
  const defaultOptions: WebhookVerifiedOptions = {
    secretHeader: 'X-Webhook-Secret',
    signatureHeader: 'X-Webhook-Signature',
    timestampHeader: 'X-Webhook-Timestamp',
    nonceHeader: 'X-Webhook-Nonce',
    timestampToleranceMs: 300000, // 5 minutes
    provider: 'generic',
    ...options,
  };

  return SetMetadata(WEBHOOK_VERIFIED_OPTIONS, defaultOptions);
};
