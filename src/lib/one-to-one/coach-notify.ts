import type { SupabaseClient } from '@supabase/supabase-js'
import { sendCoachNotice } from './emails'
import { DAY, fmtDate, hhmm } from './db'

/**
 * Email a coach about their own 1-2-1s. Best-effort: a failed email never stops the
 * change it describes. Same for every academy. See sendCoachNotice in emails.ts.
 */
async function bits(admin: SupabaseClient, orgId: string, coachId: string, parentId?: string | null, venueId?: string | null) {
  const [{ data: org }, { data: coach }, parent, venue] = await Promise.all([
    admin.from('organisations').select('name').eq('id', orgId).single(),
    admin.from('profiles').select('full_name, email').eq('id', coachId).maybeSingle(),
    parentId ? admin.from('profiles').select('phone').eq('id', parentId).maybeSingle() : Promise.resolve({ data: null }),
    venueId ? admin.from('coaching_venues').select('name').eq('id', venueId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return { academy: (org?.name as string) || 'Your academy', to: (coach?.email as string | null) || null, coachName: (coach?.full_name as string | null) || null,
    phone: ((parent as { data: { phone?: string | null } | null }).data?.phone) || null, venue: ((venue as { data: { name?: string } | null }).data?.name) || '' }
}
async function childName(admin: SupabaseClient, playerId: string | null, guest?: string | null) {
  if (!playerId) return guest || 'A child'
  const { data } = await admin.from('players').select('first_name, last_name').eq('id', playerId).maybeSingle()
  return data ? `${data.first_name} ${data.last_name || ''}`.trim() : 'A child'
}

/** A regular went live (set-up paid or paid in cash). */
export async function coachNewRegular(admin: SupabaseClient, slot: { organisation_id: string; coach_id: string; parent_id: string; player_id: string; venue_id: string; weekday: number; start_minutes: number; starts_on: string; frequency: string; session_type: string }) {
  try {
    const b = await bits(admin, slot.organisation_id, slot.coach_id, slot.parent_id, slot.venue_id); if (!b.to) return
    const child = await childName(admin, slot.player_id)
    const every = slot.frequency === 'fortnightly' ? 'every other' : slot.frequency === 'monthly' ? 'once a month on' : 'every'
    await sendCoachNotice({ academy: b.academy, to: b.to, coachName: b.coachName, parentPhone: b.phone,
      subject: `New regular: ${child}, ${DAY[slot.weekday]} ${hhmm(slot.start_minutes)}`,
      heading: `${child} is now a regular with you`,
      lines: [`${slot.session_type === 'two_to_one' ? '2-to-1' : '1-to-1'}, ${every} ${DAY[slot.weekday]} at ${hhmm(slot.start_minutes)}${b.venue ? `, ${b.venue}` : ''}.`, `First session on or after ${fmtDate(slot.starts_on)}.`] })
  } catch (e) { console.error('[coach-notify] new regular', e) }
}

/** A session changed: booked one-off, moved, taken off, or covered. */
export async function coachSessionChange(admin: SupabaseClient, kind: 'booked' | 'moved_in' | 'moved_out' | 'off' | 'cover', s: { organisation_id: string; coach_id: string; parent_id?: string | null; player_id?: string | null; guest_child_name?: string | null; venue_id: string; session_date: string; start_minutes: number }, extra?: { toDate?: string; toMinutes?: number; why?: string }) {
  try {
    const b = await bits(admin, s.organisation_id, s.coach_id, s.parent_id, s.venue_id); if (!b.to) return
    const child = await childName(admin, s.player_id || null, s.guest_child_name)
    const when = `${fmtDate(s.session_date)} at ${hhmm(s.start_minutes)}${b.venue ? `, ${b.venue}` : ''}`
    const t = {
      booked: { subject: `New 1-2-1: ${child}, ${fmtDate(s.session_date)} ${hhmm(s.start_minutes)}`, heading: `${child} has booked a session with you`, lines: [when + '.'] },
      moved_in: { subject: `Moved to you: ${child}, ${fmtDate(s.session_date)} ${hhmm(s.start_minutes)}`, heading: `${child}'s session is now with you`, lines: [when + '.'] },
      moved_out: { subject: `Moved: ${child}, ${fmtDate(s.session_date)} ${hhmm(s.start_minutes)}`, heading: `${child}'s session has moved`, lines: [`Was ${when}.`, extra?.toDate ? `Now ${fmtDate(extra.toDate)} at ${hhmm(extra.toMinutes ?? s.start_minutes)}.` : ''].filter(Boolean) },
      off: { subject: `Off: ${child}, ${fmtDate(s.session_date)} ${hhmm(s.start_minutes)}`, heading: `${child}'s session is off`, lines: [`${when} isn't happening${extra?.why ? ` (${extra.why})` : ''}.`] },
      cover: { subject: `Cover: ${child}, ${fmtDate(s.session_date)} ${hhmm(s.start_minutes)}`, heading: `You're covering ${child}'s session`, lines: [when + '.'] },
    }[kind]
    await sendCoachNotice({ academy: b.academy, to: b.to, coachName: b.coachName, parentPhone: kind === 'off' || kind === 'moved_out' ? null : b.phone, ...t })
  } catch (e) { console.error('[coach-notify]', kind, e) }
}
