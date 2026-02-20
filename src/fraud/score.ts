import { evaluateVelocity } from './rules/velocity.rule';
import { evaluateDuplicateOrder } from './rules/duplicate-order.rule';
import { evaluateIpFingerprint } from './rules/ip-fingerprint.rule';

export async function evaluateAllRules(input: any) {
  const results = await Promise.all([
    evaluateVelocity(input),
    evaluateDuplicateOrder(input),
    evaluateIpFingerprint(input),
  ]);

  // Weighted sum — keep conservative weights to reduce false positives
  const weights = [0.4, 0.35, 0.25];
  const riskScore = Math.min(
    100,
    Math.round(results[0].score * weights[0] + results[1].score * weights[1] + results[2].score * weights[2]),
  );

  const reasons = results.map((r) => r.reason).filter(Boolean).join(';');

  return { riskScore, reason: reasons };
}
