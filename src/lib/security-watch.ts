/**
 * Daily security watch (John, 6 Nov 2026: "these guys are going to try and bring it down").
 *
 * Every morning we take a snapshot of the things an attacker would change and compare it
 * with yesterday's. Anything different is emailed to John: a new platform admin, a new
 * academy admin, an academy's payout account, plan, free/pilot flag or £35 status
 * changing, and any internet address that had 5+ bookings refused in a day.
 *
 * Most changes will be normal (an academy connecting Stripe, a new owner). The email
 * lists them so a change nobody made gets noticed the same day. No email when nothing
 * changed. Snapshots live in audit_log ('security.snapshot', no academy on the row).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const SNAPSHOT_ACTION = 'security.snapshot'

export type OrgSnap = { name: string; stripe: string | null; plan: string | null; pilot: boolean; status: string | null }
export type Snapshot = {
  orgs: Record<string, OrgSnap>
  superAdmins: string[]
  admins: Record<string, string[]>
}

/** Pure: every difference between two snapshots, as plain sentences. */
export function diffSnapshots(before: Snapshot | null, after: Snapshot, names: Record<string, string> = {}): string[] {
  if (!before) return []
  const out: string[] = []
  const who = (id: string) => names[id] || id
  for (const id of after.superAdmins) {
    if (!before.superAdmins.includes(id)) out.push(`NEW PLATFORM ADMIN: ${who(id)}`)
  }
  for (const [orgId, now] of Object.entries(after.orgs)) {
    const was = before.orgs[orgId]
    if (!was) continue
    if (was.stripe !== now.stripe) out.push(`${now.name}: payout Stripe account changed ${was.stripe ?? 'none'} → ${now.stripe ?? 'none'}`)
    if (was.plan !== now.plan) out.push(`${now.name}: platform plan changed`)
    if (was.pilot !== now.pilot) out.push(`${now.name}: free/pilot flag turned ${now.pilot ? 'ON' : 'off'}`)
    if (was.status !== now.status) out.push(`${now.name}: £35 status ${was.status ?? 'none'} → ${now.status ?? 'none'}`)
  }
  for (const [orgId, ids] of Object.entries(after.admins)) {
    if (!before.orgs[orgId]) continue // brand-new academy: its first admin is expected
    const prior = before.admins[orgId] || []
    for (const id of ids) if (!prior.includes(id)) out.push(`${after.orgs[orgId]?.name || orgId}: new admin ${who(id)}`)
  }
  return out
}

export async function takeSnapshot(db: SupabaseClient): Promise<{ snap: Snapshot; names: Record<string, string> }> {
  const { data: orgs } = await db
    .from('organisations')
    .select('id, name, stripe_account_id, platform_plan_id, pilot, platform_subscription_status')
  const { data: staff } = await db
    .from('profiles')
    .select('id, email, organisation_id, role, is_super_admin')
    .or('role.eq.admin,is_super_admin.eq.true')
  const snap: Snapshot = { orgs: {}, superAdmins: [], admins: {} }
  const names: Record<string, string> = {}
  for (const o of orgs || []) {
    snap.orgs[o.id as string] = {
      name: String(o.name || ''),
      stripe: (o.stripe_account_id as string | null) ?? null,
      plan: (o.platform_plan_id as string | null) ?? null,
      pilot: !!o.pilot,
      status: (o.platform_subscription_status as string | null) ?? null,
    }
  }
  for (const p of staff || []) {
    names[p.id as string] = String(p.email || p.id)
    if (p.is_super_admin) snap.superAdmins.push(p.id as string)
    if (p.role === 'admin' && p.organisation_id) {
      ;(snap.admins[p.organisation_id as string] ||= []).push(p.id as string)
    }
  }
  snap.superAdmins.sort()
  for (const k of Object.keys(snap.admins)) snap.admins[k].sort()
  return { snap, names }
}

/** Internet addresses with 5+ refused bookings in the last day. */
export async function busyRefusers(db: SupabaseClient, since: string): Promise<string[]> {
  const { data } = await db
    .from('audit_log')
    .select('ip_address')
    .eq('action', 'trial.refused')
    .gte('created_at', since)
    .limit(5000)
  const count = new Map<string, number>()
  for (const r of data || []) {
    const ip = String(r.ip_address || 'unknown')
    count.set(ip, (count.get(ip) || 0) + 1)
  }
  return [...count.entries()].filter(([, n]) => n >= 5).map(([ip, n]) => `${n} bookings refused from ${ip}`)
}
