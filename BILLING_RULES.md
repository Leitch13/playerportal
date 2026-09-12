# Billing rules — read before touching anything that charges a parent

John Leitch, 10 September 2026, after the sixth regression in three months:

> **The same billing, the same code, for every academy. Do not change this. Ever.**

## The rule
1. A parent joins, picks a start date (today or an upcoming class date within 28 days),
   and **pays now** for the sessions from that date to the end of that month:
   sessions left × (monthly ÷ 4), capped at one month. Weeks left if the class has no set day.
   Nothing today if nothing is left. Then the full plan on the 1st, and every 1st after.
   Code: `src/lib/billing/sessions.ts` `firstChargeFor()`.
2. One Stripe shape for that: `src/lib/billing/first-charge.ts` `sessionsBridgeCheckout()`.
   Every route that starts a membership uses it. Stripe's own calendar-day proration is never used.
3. Quarterly (pay every 3 months, academy-set discount) is available to **every** academy.
   The academy's own Settings toggle is the only thing that governs it.
4. Nothing about billing differs by academy. No flags, no allowlists, no pilots, no "just for X".
5. Any billing change a parent could notice is John's decision, in writing, before it is built.

## What enforces it
- `scripts/check-billing-invariants.mjs` runs before every build and fails it on any of the retired
  patterns (see the FORBIDDEN list). It cannot be bypassed by a Vercel setting.
- `.github/workflows/billing-guard.yml` runs the same check plus the tests on every push.
- Canary 12 reads real Stripe invoices every morning and emails John if any first invoice
  was ever charged by calendar days.
- `src/lib/billing/sessions.test.ts` and `src/lib/quarterly-billing.test.ts`.

## The one allowed exception
A migration with an admin-set first-billing date (the parent already paid the academy elsewhere):
£0 today, first charge on that date. Same for every academy.

## The 1-2-1 Slots module is a sealed room

Recurring 1-to-1 / 2-to-1 coaching lives in `src/lib/one-to-one`, `src/app/api/one-to-one`, its own pages and its own Stripe webhook route. It is not part of class billing and never will be:

- It may not import anything from `src/lib/billing`; class billing, the subscribe routes, the migration routes and the class webhook may not import anything from it. The build guard refuses either direction.
- It creates no Stripe subscriptions. Money there is one-off Connect charges (Checkout in payment mode, then off-session payment intents on the 1st). The guard refuses `subscriptions.create` and `mode: 'subscription'` under the module.
- Its cancellation tiers are fixed in code for every academy. An academy sets prices and session length only.
- The module is on for every academy. There is no allowlist and no pilot flag.
