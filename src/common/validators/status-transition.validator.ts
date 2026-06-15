import { BadRequestException } from '@nestjs/common';

/**
 * Generic status transition validator
 * Validates state transitions against a defined transition map
 * Prevents invalid state progression with clear error messages
 */
export class StatusTransitionValidator<T extends string> {
  private validTransitions: Record<T, T[]>;
  private entityName: string;

  constructor(
    transitions: Record<T, T[]>,
    entityName: string = 'Entity',
  ) {
    this.validTransitions = transitions;
    this.entityName = entityName;
  }

  /**
   * Validate a status transition
   * @param currentStatus The current status of the entity
   * @param newStatus The requested new status
   * @throws BadRequestException if transition is invalid
   */
  validate(currentStatus: T, newStatus: T): void {
    const allowed = this.validTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      const allowedTransitions =
        allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';

      throw new BadRequestException(
        `Invalid ${this.entityName} status transition from '${currentStatus}' to '${newStatus}'. ` +
          `Allowed transitions: ${allowedTransitions}`,
      );
    }
  }

  /**
   * Check if a transition is valid without throwing
   * @param currentStatus The current status
   * @param newStatus The requested new status
   * @returns true if transition is valid, false otherwise
   */
  isValid(currentStatus: T, newStatus: T): boolean {
    const allowed = this.validTransitions[currentStatus] || [];
    return allowed.includes(newStatus);
  }

  /**
   * Get allowed transitions from current status
   * @param currentStatus The current status
   * @returns Array of allowed next statuses
   */
  getAllowedTransitions(currentStatus: T): T[] {
    return this.validTransitions[currentStatus] || [];
  }

  /**
   * Check if status is terminal (no further transitions allowed)
   * @param status The status to check
   * @returns true if terminal state
   */
  isTerminalState(status: T): boolean {
    const allowed = this.validTransitions[status] || [];
    return allowed.length === 0;
  }
}
