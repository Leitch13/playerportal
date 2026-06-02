/**
 * Feature-flag gate for the start-date-driven prorated billing flow.
 *
 * Two env vars:
 *
 *   BILLING_FLOW_STARTDATE_ENABLED
 *     - empty or unset → new flow disabled globally (default; safest)
 *     - "*" → all orgs use new flow
 *     - "<uuid>,<uuid>" → comma-separated list of org UUIDs that get the new
 *       flow. Other orgs continue on the legacy tonight_then_sub path.
 *
 *   BILLING_FLOW_STARTDATE_KILL
 *     - empty or unset → flag respected normally
 *     - "true" → emergency kill: all signups forced to legacy regardless
 *       of the ENABLED flag. Used for instant rollback without a redeploy.
 *
 * Read only. No persistence. Decision happens at subscribe-route entry time,
 * so flipping the env var affects only NEW signups; in-flight checkout
 * sessions complete on whichever path they started.
 */

export function isStartDateBillingEnabled(orgId: string | null | undefined): boolean {
  if (!orgId) return false
  if (process.env.BILLING_FLOW_STARTDATE_KILL === 'true') return false
  const flag = (process.env.BILLING_FLOW_STARTDATE_ENABLED || '').trim()
  if (!flag) return false
  if (flag === '*') return true
  return flag
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(orgId)
}

/**
 * Stage 3 — future-start (deferred charging via SetupIntent + activation cron).
 *
 * Independent of isStartDateBillingEnabled. Stage 3 requires Stage 2 to also
 * be enabled for the same org (the dispatch logic in subscribe/route.ts
 * checks both — Stage 3 is strictly additive to Stage 2's immediate-start path).
 *
 *   BILLING_FUTURE_START_ENABLED
 *     - empty / unset → Stage 3 disabled. Parents picking a future date fall
 *       through to legacy behaviour (Option B picker clamps to today, so
 *       this is the de facto default until this flag is set).
 *     - "*" → all orgs (whose Stage 2 flag is also on) get future-start.
 *     - "<uuid>,<uuid>" → comma-separated list of org UUIDs.
 *
 *   BILLING_FUTURE_START_KILL
 *     - "true" → emergency disable, ignores ENABLED flag.
 */
export function isFutureStartBillingEnabled(orgId: string | null | undefined): boolean {
  if (!orgId) return false
  if (process.env.BILLING_FUTURE_START_KILL === 'true') return false
  const flag = (process.env.BILLING_FUTURE_START_ENABLED || '').trim()
  if (!flag) return false
  if (flag === '*') return true
  return flag
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(orgId)
}
