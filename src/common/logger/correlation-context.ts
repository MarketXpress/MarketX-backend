import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationContext {
  correlationId: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

export function runWithCorrelationId<T>(
  correlationId: string,
  fn: () => T,
): T {
  return correlationStorage.run({ correlationId }, fn);
}
