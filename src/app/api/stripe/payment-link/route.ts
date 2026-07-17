import { NextResponse } from 'next/server'

// Disabled 2026-07-17: this route created Stripe Payment Links on the
// PLATFORM account — no Connect routing to the academy (no on_behalf_of /
// transfer_data), no application fee, and no payments-ledger row. Any funds
// paid through such a link would land on the platform entity and be invisible
// in the app. Never used in production (verified: zero payment links on the
// live Stripe account).
//
// Re-enable by restoring the original handler (git history, pre-2026-07-17)
// plus the standard Connect block used by every other parent-paying route:
//   • isConnectChargeReady pre-flight (src/lib/connect-readiness.ts)
//   • fee rate from platform_plans.transaction_fee_percent
//   • on_behalf_of + transfer_data.destination = org stripe_account_id
//   • a payments row so the link shows in the app's ledger
export async function POST() {
  return NextResponse.json(
    { error: 'Payment links are temporarily unavailable.' },
    { status: 503 }
  )
}
