/**
 * Shared Event Contract Interface
 * 
 * This file defines the base interface and validation utilities for all domain events.
 * It ensures consistent payload shapes across producers and consumers.
 */

export interface BaseEventContract {
  /** Unique identifier for the event instance */
  eventId: string;
  
  /** The type/name of the event (e.g., 'order.created', 'payment.failed') */
  eventType: string;
  
  /** ISO 8601 timestamp when the event occurred */
  occurredAt: string;
  
  /** The domain that produced this event (e.g., 'order', 'payment', 'notification') */
  domain: string;
  
  /** Version of the event schema for backward compatibility */
  schemaVersion: string;
  
  /** Correlation ID for tracing related events */
  correlationId?: string;
  
  /** Causation ID for tracking event chain */
  causationId?: string;
}

/**
 * Validates that an event payload conforms to the base contract
 */
export function validateEventContract(event: any): event is BaseEventContract {
  if (!event) return false;
  
  const hasRequiredFields = 
    typeof event.eventId === 'string' &&
    typeof event.eventType === 'string' &&
    typeof event.occurredAt === 'string' &&
    typeof event.domain === 'string' &&
    typeof event.schemaVersion === 'string';
  
  if (!hasRequiredFields) {
    return false;
  }
  
  // Validate timestamp is valid ISO 8601
  const timestamp = new Date(event.occurredAt);
  if (isNaN(timestamp.getTime())) {
    return false;
  }
  
  return true;
}

/**
 * Creates a base event contract with common fields
 */
export function createBaseEventContract(
  domain: string,
  eventType: string,
  options?: {
    correlationId?: string;
    causationId?: string;
    occurredAt?: Date;
  }
): BaseEventContract {
  return {
    eventId: generateEventId(),
    eventType,
    occurredAt: (options?.occurredAt || new Date()).toISOString(),
    domain,
    schemaVersion: '1.0.0',
    correlationId: options?.correlationId,
    causationId: options?.causationId,
  };
}

/**
 * Generates a unique event ID
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `evt_${timestamp}_${random}`;
}

/**
 * Event envelope for wrapping domain-specific payloads
 */
export interface EventEnvelope<T = any> extends BaseEventContract {
  /** The actual event payload/data */
  payload: T;
  
  /** Metadata about the event producer */
  metadata?: {
    producerService?: string;
    producerVersion?: string;
    [key: string]: any;
  };
}

/**
 * Creates a typed event envelope
 */
export function createEventEnvelope<T>(
  domain: string,
  eventType: string,
  payload: T,
  options?: {
    correlationId?: string;
    causationId?: string;
    occurredAt?: Date;
    metadata?: Record<string, any>;
  }
): EventEnvelope<T> {
  return {
    ...createBaseEventContract(domain, eventType, {
      correlationId: options?.correlationId,
      causationId: options?.causationId,
      occurredAt: options?.occurredAt,
    }),
    payload,
    metadata: options?.metadata ? {
      producerService: 'marketx-backend',
      ...options.metadata,
    } : {
      producerService: 'marketx-backend',
    },
  };
}
