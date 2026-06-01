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
