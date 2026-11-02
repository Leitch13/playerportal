import type { SupabaseClient } from '@supabase/supabase-js'
import { emailKey } from './auth-email-links'

/**
 * Families whose emails aren't reaching them (John, 2 Nov 2026: No.1's Nicki Evans never got her
 * November pay email, her address is blocked, and nothing told the academy).
 *
 * Every hour /api/cron/email-delivery reads what Resend did with the emails since the last look. An
 * email that bounced, was blocked or was marked as spam is recorded against the address (audit_log,
 * 'email.not_delivered', keyed by emailKey so the address itself isn't stored). A later email that
 * does arrive clears it ('email.delivered_again'). Pages show those families in red with "use
 * WhatsApp"; the academy's WhatsApp it buttons send the same links.
 */

export const NOT_DELIVERED = 'email.not_delivered'
export const DELIVERED_AGAIN = 'email.delivered_again'
const SCAN = 'email.delivery_scan'
const SCAN_ID = '00000000-0000-4000-8000-0000000e3a11'
const BAD = ['bounced', 'complained', 'suppressed', 'failed']
const GOOD = ['delivered', 'opened', 'clicked']

export type Reach = { event: string; at: string; subject: string | null }

/** For these addresses: the ones whose last news is an email that didn't arrive (last 120 days). */
export async function emailsNotReaching(db: SupabaseClient, emails: Array<string | null | undefined>): Promise<Map<string, Reach>> {
  const out = new Map<string, Reach>()
  const byKey = new Map<string, string>()
  for (const e of emails) { const a = String(e || '').trim().toLowerCase(); if (a.includes('@')) byKey.set(emailKey(a), a) }
  if (!byKey.size) return out
  const since = new Date(Date.now() - 120 * 86400e3).toISOString()
  const { data } = await db.from('audit_log').select('entity_id, action, created_at, details').in('action', [NOT_DELIVERED, DELIVERED_AGAIN])
    .in('entity_id', [...byKey.keys()]).gte('created_at', since).order('created_at', { ascending: false }).limit(2000)
  const seen = new Set<string>()
  for (const r of data ?? []) {
    const k = r.entity_id as string
    if (seen.has(k)) continue
    seen.add(k)
    if (r.action !== NOT_DELIVERED) continue
    const d = (r.details || {}) as { event?: string; at?: string; subject?: string }
    out.set(byKey.get(k)!, { event: d.event || 'bounced', at: d.at || (r.created_at as string), subject: d.subject ?? null })
  }
  return out
}

/** One line for the academy: "Emails aren't reaching them (blocked 1 Nov). WhatsApp or call instead." */
export function reachLine(r: Reach): string {
  const how = r.event === 'suppressed' ? 'blocked' : r.event === 'complained' ? 'marked as spam' : 'bounced'
  const when = new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
  return `Emails aren't reaching them (${how} ${when}). WhatsApp or call instead.`
}

type ResendEmail = { id: string; to: string[]; subject: string; created_at: string; last_event: string }

/** The hourly look at Resend. Returns how many addresses were marked and cleared. */
export async function scanDeliveries(db: SupabaseClient, apiKey: string, fetcher: typeof fetch = fetch): Promise<{ scanned: number; marked: number; cleared: number }> {
  const { data: last } = await db.from('audit_log').select('details').eq('action', SCAN).order('created_at', { ascending: false }).limit(1).maybeSingle()
  // Look back two hours past the last look: an email's final news (bounced/delivered) can come a while after it's sent.
  const prev = (last?.details as { newest?: string } | null)?.newest
  const stopAt = prev ? new Date(Date.parse(prev) - 2 * 3600e3).toISOString() : new Date(Date.now() - 21 * 86400e3).toISOString()
  const emails: ResendEmail[] = []
  let after: string | null = null
  for (let page = 0; page < (prev ? 10 : 30); page++) {
    const u = new URL('https://api.resend.com/emails'); u.searchParams.set('limit', '100'); if (after) u.searchParams.set('after', after)
    const r = await fetcher(u, { headers: { authorization: `Bearer ${apiKey}` } })
    if (!r.ok) break
    const j = await r.json() as { data?: ResendEmail[]; has_more?: boolean }
    const batch = j.data ?? []
    emails.push(...batch)
    const tail = batch[batch.length - 1]
    if (!j.has_more || !tail || tail.created_at < stopAt) break
    after = tail.id
    await new Promise((res) => setTimeout(res, 600)) // Resend allows 2 requests a second
  }
  const recent = emails.filter((e) => e.created_at >= stopAt)
  const bad = recent.filter((e) => BAD.includes(e.last_event))
  const good = recent.filter((e) => GOOD.includes(e.last_event))
  const keyOf = (a: string) => emailKey(a.trim().toLowerCase())

  // Already recorded (the two-hour overlap sees some emails twice).
  const badKeys = [...new Set(bad.flatMap((e) => e.to.map(keyOf)))]
  const { data: had } = badKeys.length ? await db.from('audit_log').select('details').eq('action', NOT_DELIVERED).in('entity_id', badKeys).limit(5000) : { data: [] }
  const known = new Set((had ?? []).map((h) => (h.details as { email_id?: string } | null)?.email_id).filter(Boolean))
  const rows = bad.filter((e) => !known.has(e.id)).flatMap((e) => e.to.map((a) => ({ action: NOT_DELIVERED, entity_type: 'email', entity_id: keyOf(a), details: { event: e.last_event, at: e.created_at, subject: e.subject?.slice(0, 120) ?? null, email_id: e.id } })))
  if (rows.length) await db.from('audit_log').insert(rows)

  // A later email that arrived clears the warning.
  let cleared = 0
  const goodByKey = new Map<string, string>()
  for (const e of good) for (const a of e.to) { const k = keyOf(a); if ((goodByKey.get(k) || '') < e.created_at) goodByKey.set(k, e.created_at) }
  if (goodByKey.size) {
    const { data: flagged } = await db.from('audit_log').select('entity_id, action, details, created_at').in('action', [NOT_DELIVERED, DELIVERED_AGAIN]).in('entity_id', [...goodByKey.keys()]).order('created_at', { ascending: false }).limit(5000)
    const latest = new Map<string, { action: string; at: string }>()
    for (const f of flagged ?? []) if (!latest.has(f.entity_id as string)) latest.set(f.entity_id as string, { action: f.action as string, at: ((f.details as { at?: string } | null)?.at || f.created_at) as string })
    const clears = [...latest].filter(([k, v]) => v.action === NOT_DELIVERED && (goodByKey.get(k) || '') > v.at).map(([k]) => ({ action: DELIVERED_AGAIN, entity_type: 'email', entity_id: k, details: { at: goodByKey.get(k) } }))
    if (clears.length) { await db.from('audit_log').insert(clears); cleared = clears.length }
  }
  const newest = emails[0]?.created_at || prev || new Date().toISOString()
  await db.from('audit_log').insert({ action: SCAN, entity_type: 'email', entity_id: SCAN_ID, details: { newest, scanned: recent.length, marked: rows.length, cleared } })
  return { scanned: recent.length, marked: rows.length, cleared }
}
