/**
 * Pure scoring engine — no DB deps, fully testable in isolation.
 * Each rule returns a partial score (0-100). Total is capped at 100.
 * Threshold guide:
 *   < 20  → clean, no alert created
 *   20–69 → flagged, alert created, status = 'pending'
 *   70–89 → high risk, auto-suspend user
 *   90+   → critical, logged as severe
 */

export interface FraudInput {
  userId?: string;
  orderId?: string;
  ip?: string;
  deviceFingerprint?: string;
  metadata?: {
    amount?: number;
    orderCount?: number;         // orders by this user in the past 10 min
    duplicateOrderInWindow?: boolean;
    knownBadIp?: boolean;
    accountAgeDays?: number;
    failedPaymentCount?: number; // failed attempts in the past hour
    isFirstOrder?: boolean;
  };
}

export interface ScoreResult {
  riskScore: number;
  reason: string;
  triggeredRules: string[];
}

interface Rule {
  name: string;
  score: number;
  check: (input: FraudInput) => boolean;
}

const RULES: Rule[] = [
  {
    name: 'high_velocity',
    score: 35,
    check: ({ metadata }) => (metadata?.orderCount ?? 0) >= 5,
  },
  {
    name: 'duplicate_order',
    score: 40,
    check: ({ metadata }) => metadata?.duplicateOrderInWindow === true,
  },
  {
    name: 'suspicious_amount',
    score: 25,
    check: ({ metadata }) => (metadata?.amount ?? 0) > 10_000,
  },
  {
    name: 'known_bad_ip',
    score: 50,
    check: ({ metadata }) => metadata?.knownBadIp === true,
  },
  {
    name: 'new_account_large_order',
    score: 30,
    check: ({ metadata }) =>
      (metadata?.accountAgeDays ?? 999) < 3 && (metadata?.amount ?? 0) > 500,
  },
  {
    name: 'repeated_payment_failures',
    score: 35,
    check: ({ metadata }) => (metadata?.failedPaymentCount ?? 0) >= 3,
  },
  {
    name: 'first_order_high_value',
    score: 20,
    check: ({ metadata }) =>
      metadata?.isFirstOrder === true && (metadata?.amount ?? 0) > 1_000,
  },
];

export async function evaluateAllRules(input: FraudInput): Promise<ScoreResult> {
  const triggered: Rule[] = [];

  for (const rule of RULES) {
    if (rule.check(input)) {
      triggered.push(rule);
    }
  }

  const rawScore = triggered.reduce((sum, r) => sum + r.score, 0);
  const riskScore = Math.min(rawScore, 100);
  const triggeredRules = triggered.map((r) => r.name);
  const reason = triggeredRules.length
    ? triggeredRules.join(', ')
    : 'no_rules_triggered';

  return { riskScore, reason, triggeredRules };
}