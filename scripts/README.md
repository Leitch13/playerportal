# Reconciliation + probe scripts

## stage3-testclock-probe.mjs

Test-mode-only Stage 3 lifecycle probe. Drives a Stripe Test Clock
through SIGNUP (setup-mode Checkout) → ACTIVATION (advance to start_date,
create subscription with anchor = 1st of next month) → RENEWAL (advance
past anchor). Asserts no charge today, prorated amount on activation,
full amount on renewal, and that Connect params are present in the cron
path (via code-level diff against Stage 2's production-verified subscribe
route).

Refuses to run unless `STRIPE_SECRET_KEY` in `.env.local` starts with
`sk_test_`. Self-cleans the Test Clock on success or failure.

```sh
node scripts/stage3-testclock-probe.mjs
```

## _cleanup.mjs

Deletes any orphan Test Clocks + `stage3-probe-*` Connect accounts left
behind by a probe that crashed before cleanup ran. Test mode only.

## reconcile-stripe-drift.ts (Stage A)

Read-only diagnostic that compares Stripe (source of truth for money)
against Supabase (source of truth for academy data) for one organisation.

Reports every break in the customer trust chain:

```
Pay → Subscription → Enrolment → Booking permission → Dashboard
```

### Run

```bash
# Pull production env locally (won't commit)
vercel env pull /tmp/.env.prod --environment=production --yes
set -a; source /tmp/.env.prod; set +a

# Run for Jamie Allan Academy
npx tsx scripts/reconcile-stripe-drift.ts \
  --org=d99aa6e4-514b-42db-9c2a-523aab90e678 \
  --days=90
```

### Flags

- `--org=<uuid>` — required, organisation to reconcile
- `--days=<n>` — window for Checkout sessions + invoices + PaymentIntents (default 90)
- `--testmode` — use `STRIPE_SECRET_KEY_TEST` if set, otherwise falls back to live
- `--verbose` — also print sections with 0 drifts

### What it checks

Twelve drift categories:

| Category | Trust-chain link |
|---|---|
| `sub_in_stripe_not_db` | Sub → DB |
| `sub_in_db_not_stripe` | DB → Sub |
| `sub_status_mismatch` | Stripe ⇄ DB |
| `session_paid_no_payment_row` | Pay → Payment row |
| `invoice_paid_no_payment_row` | Renewal → Payment row |
| `payment_row_no_stripe_object` | DB → Stripe |
| `sub_active_no_enrolment` | Sub → Enrolment |
| `enrolment_active_no_sub` | Enrolment ← Sub |
| `customer_paid_no_enrolment` | Pay → Enrolment |
| `booking_blocked_by_disagreement` | Sub → Booking permission |
| `dashboard_shows_subscribe_despite_stripe_sub` | Sub → Dashboard |
| `customer_no_profile` | Customer → Profile |

### What it does NOT do

- No writes to Supabase
- No writes to Stripe
- No emails sent
- No customer impact

Re-running the script produces the same result. Safe to repeat.
