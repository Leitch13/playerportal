/**
 * Places in a class on one day: members + trials booked for that day.
 *
 * CFCoaching, 19 Oct 2026: CFC INTRO (6 places) had 6 paid members and a free
 * trial on top, 7 children in a class of 6. Sign-ups already stopped at the limit,
 * but trial bookings never looked at it. John: "how do we make sure this doesn't
 * happen?" … "build".
 *
 * The rule, for every academy:
 *   • a trial takes one place on the day it is booked for
 *   • a trial can't be booked onto a day that is already full (free or paid,
 *     checked in the form and again on the server)
 *   • a paying member always beats a trial: a sign-up is never refused because
 *     of a trial. If a class fills after trials were booked, the academy is
 *     emailed and the day shows in red ("7 for 6 places") until it is sorted.
 *
 * Members are counted the way the sign-up limit counts them (get_group_seat_counts),
 * so the two never disagree. A class with no limit set is treated as 20, as the
 * booking page and the sign-up check do.
 */

import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

/** Service client for the public trial routes (counts are aggregates, no parent details leave the server). */
export const placesDb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

/** Trials that are coming and hold a place. */
export const TRIAL_HOLDS_PLACE = ['pending', 'confirmed'] as const
export const DEFAULT_CAPACITY = 20

const normName = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()

export const capacityOf = (max: number | null | undefined) => (max != null && Number(max) > 0 ? Number(max) : DEFAULT_CAPACITY)

/** Is there a place left for one more trial on this day? */
export const hasPlace = (capacity: number, members: number, trialsThatDay: number) => members + trialsThatDay < capacity

/** How many children over the limit a day is (0 when it fits). */
export const overBy = (capacity: number, members: number, trialsThatDay: number) => Math.max(0, members + trialsThatDay - capacity)

/** "7 for 6 places (6 members + 1 trial: Kylan Bamford)" */
export function overLine(capacity: number, members: number, trials: string[]): string {
  const total = members + trials.length
  return `${total} for ${capacity} places (${members} member${members === 1 ? '' : 's'} + ${trials.length} trial${trials.length === 1 ? '' : 's'}: ${trials.join(', ')})`
}

export interface ClassPlaces { capacity: number; members: number; trials: Record<string, { id: string; child: string }[]> }

/** Members and upcoming trials for some classes of one academy, between two dates. */
export async function loadClassPlaces(db: Db, orgId: string, groupIds: string[], fromIso: string, toIso: string): Promise<Map<string, ClassPlaces>> {
  const out = new Map<string, ClassPlaces>()
  if (!groupIds.length) return out
  const [{ data: groups }, { data: seats }, { data: trials }, { data: enrolled }] = await Promise.all([
    db.from('training_groups').select('id, max_capacity').in('id', groupIds),
    db.rpc('get_group_seat_counts', { p_org_id: orgId }),
    db.from('trial_bookings').select('id, training_group_id, child_name, preferred_date').in('training_group_id', groupIds)
      .in('status', TRIAL_HOLDS_PLACE as unknown as string[]).gte('preferred_date', fromIso).lte('preferred_date', toIso),
    db.from('enrolments').select('group_id, player:players(first_name, last_name)').in('group_id', groupIds).in('status', ['active', 'pending']),
  ])
  // A trial child who has since joined is already counted as a member (Harper, CFC INTRO, 18 Oct 2026).
  const memberNames = new Set(((enrolled ?? []) as { group_id: string; player: { first_name: string | null; last_name: string | null } | null }[])
    .map((e) => `${e.group_id}|${normName(`${e.player?.first_name || ''} ${e.player?.last_name || ''}`)}`))
  for (const g of (groups ?? []) as { id: string; max_capacity: number | null }[]) {
    const seat = ((seats ?? []) as { group_id: string; seat_count: number | string }[]).find((s) => s.group_id === g.id)
    out.set(g.id, { capacity: capacityOf(g.max_capacity), members: Number(seat?.seat_count ?? 0), trials: {} })
  }
  for (const t of (trials ?? []) as { id: string; training_group_id: string; child_name: string | null; preferred_date: string }[]) {
    const c = out.get(t.training_group_id); if (!c) continue
    if (memberNames.has(`${t.training_group_id}|${normName(t.child_name || '')}`)) continue
    ;(c.trials[t.preferred_date] ||= []).push({ id: t.id, child: (t.child_name || 'A child').replace(/\s+/g, ' ').trim() })
  }
  return out
}

/** One class, one day: is there a place for another trial? Used by both trial routes before booking. */
export async function trialPlaceFree(db: Db, groupId: string, dateIso: string | null | undefined): Promise<{ ok: boolean; capacity: number; members: number; trials: number }> {
  const { data: g } = await db.from('training_groups').select('organisation_id').eq('id', groupId).maybeSingle()
  if (!g || !dateIso) return { ok: true, capacity: 0, members: 0, trials: 0 }
  const c = (await loadClassPlaces(db, g.organisation_id as string, [groupId], dateIso, dateIso)).get(groupId)
  if (!c) return { ok: true, capacity: 0, members: 0, trials: 0 }
  const trials = (c.trials[dateIso] || []).length
  return { ok: hasPlace(c.capacity, c.members, trials), capacity: c.capacity, members: c.members, trials }
}

export const CLASS_FULL_TRIAL_MESSAGE = 'Sorry, that day is now full. Please pick another date, or join the class waiting list.'

export const OVER_LIMIT_ALERTED = 'class.over_limit_alerted'

/**
 * Days in the next two weeks where members + trials are over the class limit, for every
 * academy, each told once per class, day and head-count (a new trial or member on top
 * tells them again). Bell for every admin + one email to the academy's contact address.
 * Run hourly by /api/cron/class-over-limit, so a class that fills on a Sunday evening is
 * flagged before Monday's session.
 */
export async function alertOverLimitDays(db: Db, todayIso: string, sendEmail: (o: { to: string; subject: string; html: string; fromName?: string }) => Promise<unknown>) {
  const until = new Date(Date.parse(`${todayIso}T12:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10)
  const { data: rows } = await db.from('trial_bookings').select('organisation_id, training_group_id').in('status', TRIAL_HOLDS_PLACE as unknown as string[])
    .gte('preferred_date', todayIso).lte('preferred_date', until).not('training_group_id', 'is', null)
  const byOrg = new Map<string, Set<string>>()
  for (const r of (rows ?? []) as { organisation_id: string; training_group_id: string }[]) (byOrg.get(r.organisation_id) || byOrg.set(r.organisation_id, new Set()).get(r.organisation_id)!).add(r.training_group_id)
  const alerted: string[] = []
  for (const [orgId, gids] of byOrg) {
    const places = await loadClassPlaces(db, orgId, [...gids], todayIso, until)
    const { data: names } = await db.from('training_groups').select('id, name, time_slot').in('id', [...gids])
    for (const [gid, c] of places) {
      for (const [date, trials] of Object.entries(c.trials)) {
        if (!overBy(c.capacity, c.members, trials.length)) continue
        const total = c.members + trials.length
        const { data: prior } = await db.from('audit_log').select('details').eq('action', OVER_LIMIT_ALERTED).eq('entity_id', gid).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
        if ((prior ?? []).some((p: { details: { date?: string; total?: number } }) => p.details?.date === date && (p.details?.total ?? 0) >= total)) continue
        const g = ((names ?? []) as { id: string; name: string; time_slot: string | null }[]).find((n) => n.id === gid)
        const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
        const line = overLine(c.capacity, c.members, trials.map((t) => t.child))
        const { data: org } = await db.from('organisations').select('name, contact_email').eq('id', orgId).single()
        const { data: admins } = await db.from('profiles').select('id').eq('organisation_id', orgId).eq('role', 'admin')
        const link = `/dashboard/groups/${gid}`
        if (admins?.length) await db.from('notifications').insert((admins as { id: string }[]).map((a) => ({ user_id: a.id, organisation_id: orgId, type: 'class_over_limit', title: `${g?.name || 'A class'} is over its limit on ${day}`, body: `${line}. Move the trial to another day or class, or keep them.`, link })))
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
        const to = (org?.contact_email as string | null) || process.env.ADMIN_NOTIFICATION_EMAIL || 'johnleitch970@gmail.com'
        const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))
        await sendEmail({
          to, fromName: (org?.name as string) || undefined,
          subject: `${g?.name || 'A class'} on ${day}: ${total} children for ${c.capacity} places`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1b2430">
            <h2 style="margin:0 0 8px">${esc(g?.name || 'A class')} is over its limit on ${esc(day)}${g?.time_slot ? ` (${esc(g.time_slot)})` : ''}</h2>
            <p style="margin:0 0 10px;font-size:15px">${esc(line)}.</p>
            <p style="margin:0 0 14px;color:#5b6674">The class filled up after the trial${trials.length === 1 ? ' was' : 's were'} booked. Paying members always keep their place. Move the trial to another day or class, or keep them if you have room.</p>
            <p><a href="${appUrl}${link}" style="background:#4ecde6;color:#06222b;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600">Open the class</a></p></div>`,
        })
        await db.from('audit_log').insert({ organisation_id: orgId, action: OVER_LIMIT_ALERTED, entity_type: 'training_group', entity_id: gid, details: { date, total, capacity: c.capacity, members: c.members, trials: trials.map((t) => t.child) } })
        alerted.push(`${g?.name} ${date} ${total}/${c.capacity}`)
      }
    }
  }
  return alerted
}
