export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  signature: string;
  attempts: number;
  maxRetries: number;
  nextRetryAt?: Date;
  status: 'pending' | 'success' | 'failed' | 'exhausted';
  response?: {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };
  createdAt: Date;
  updatedAt: Date;
}
