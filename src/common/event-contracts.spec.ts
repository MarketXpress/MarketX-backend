import {
  validateEventContract,
  createBaseEventContract,
  createEventEnvelope,
  BaseEventContract,
  EventEnvelope,
} from './event-contracts';

describe('Event Contracts', () => {
  describe('validateEventContract', () => {
    it('should return true for valid event contract', () => {
      const validEvent: BaseEventContract = {
        eventId: 'evt_123',
        eventType: 'order.created',
        occurredAt: new Date().toISOString(),
        domain: 'order',
        schemaVersion: '1.0.0',
      };

      expect(validateEventContract(validEvent)).toBe(true);
    });

    it('should return false for missing required fields', () => {
      const invalidEvent = {
        eventId: 'evt_123',
        eventType: 'order.created',
        // missing occurredAt, domain, schemaVersion
      };

      expect(validateEventContract(invalidEvent)).toBe(false);
    });

    it('should return false for invalid timestamp', () => {
      const invalidEvent = {
        eventId: 'evt_123',
        eventType: 'order.created',
        occurredAt: 'not-a-date',
        domain: 'order',
        schemaVersion: '1.0.0',
      };

      expect(validateEventContract(invalidEvent)).toBe(false);
    });

    it('should return false for null event', () => {
      expect(validateEventContract(null)).toBe(false);
    });

    it('should return false for undefined event', () => {
      expect(validateEventContract(undefined)).toBe(false);
    });
  });

  describe('createBaseEventContract', () => {
    it('should create a valid event contract with required fields', () => {
      const contract = createBaseEventContract('order', 'order.created');

      expect(contract.eventId).toBeDefined();
      expect(contract.eventType).toBe('order.created');
      expect(contract.domain).toBe('order');
      expect(contract.schemaVersion).toBe('1.0.0');
      expect(contract.occurredAt).toBeDefined();
      expect(validateEventContract(contract)).toBe(true);
    });

    it('should include optional fields when provided', () => {
      const contract = createBaseEventContract('payment', 'payment.failed', {
        correlationId: 'corr_123',
        causationId: 'cause_456',
      });

      expect(contract.correlationId).toBe('corr_123');
      expect(contract.causationId).toBe('cause_456');
    });

    it('should use custom occurredAt when provided', () => {
      const customDate = new Date('2024-01-01T00:00:00Z');
      const contract = createBaseEventContract('order', 'order.created', {
        occurredAt: customDate,
      });

      expect(contract.occurredAt).toBe(customDate.toISOString());
    });
  });

  describe('createEventEnvelope', () => {
    it('should create a valid event envelope with payload', () => {
      const payload = { orderId: '123', amount: 100 };
      const envelope = createEventEnvelope('order', 'order.created', payload);

      expect(envelope.eventId).toBeDefined();
      expect(envelope.eventType).toBe('order.created');
      expect(envelope.domain).toBe('order');
      expect(envelope.payload).toEqual(payload);
      expect(envelope.metadata?.producerService).toBe('marketx-backend');
      expect(validateEventContract(envelope)).toBe(true);
    });

    it('should include custom metadata when provided', () => {
      const payload = { userId: '456' };
      const envelope = createEventEnvelope('user', 'user.created', payload, {
        metadata: {
          customField: 'customValue',
          environment: 'production',
        },
      });

      expect(envelope.metadata?.customField).toBe('customValue');
      expect(envelope.metadata?.environment).toBe('production');
      expect(envelope.metadata?.producerService).toBe('marketx-backend');
    });

    it('should preserve all base contract fields', () => {
      const payload = { test: true };
      const envelope = createEventEnvelope('test', 'test.event', payload, {
        correlationId: 'corr_789',
        causationId: 'cause_012',
      });

      expect(envelope.correlationId).toBe('corr_789');
      expect(envelope.causationId).toBe('cause_012');
      expect(envelope.payload).toEqual(payload);
    });
  });
});
