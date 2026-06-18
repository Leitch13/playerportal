// Stripe's `application_fee_percent` must be a clean decimal (≤2 dp). A naive
// `rate * 100` produces IEEE-754 float artefacts — e.g. 0.035 * 100 =
// 3.5000000000000004 — which Stripe rejects with "Invalid decimal", breaking
// checkout for any academy on a 3.5% fee (i.e. any org whose platform_plan_id
// didn't resolve to the 2% Pro plan). Always round to 2 dp.
//
// Value-preserving: 0.035 → 3.5, 0.02 → 2, 0.025 → 2.5. Only the float
// representation is cleaned; the fee itself is unchanged (Protected #1).
export function feePercentFromRate(rate: number): number {
  return Math.round(rate * 10000) / 100
}
