import { DisputeStatus } from '../dispute.entity';

export class DisputeStateMachine {
  static allowedTransitions: Record<DisputeStatus, DisputeStatus[]> = {
    [DisputeStatus.OPEN]: [DisputeStatus.ESCALATED, DisputeStatus.AUTO_RESOLVED, DisputeStatus.RESOLVED, DisputeStatus.REJECTED],
    [DisputeStatus.ESCALATED]: [DisputeStatus.RESOLVED, DisputeStatus.REJECTED],
    [DisputeStatus.RESOLVED]: [],
    [DisputeStatus.REJECTED]: [],
    [DisputeStatus.AUTO_RESOLVED]: [],
  };

  static canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
    return this.allowedTransitions[from]?.includes(to);
  }

  // Example: Automated resolution rule
  // If no evidence is submitted by respondent within X days, auto-resolve in favor of complainant
  static shouldAutoResolve(dispute: { status: DisputeStatus; createdAt: Date; evidences: any[]; respondentId: string }, now: Date, autoResolveDays = 3): boolean {
    if (dispute.status !== DisputeStatus.OPEN) return false;
    const msSinceCreated = now.getTime() - new Date(dispute.createdAt).getTime();
    const daysSinceCreated = msSinceCreated / (1000 * 60 * 60 * 24);
    const respondentEvidence = dispute.evidences?.some(e => e.submittedBy === dispute.respondentId);
    return daysSinceCreated >= autoResolveDays && !respondentEvidence;
  }
} 