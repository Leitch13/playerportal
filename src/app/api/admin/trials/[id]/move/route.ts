import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { trialPlaceFree, CLASS_FULL_TRIAL_MESSAGE } from '@/lib/class-places'
import { moveProblem, statusAfterMove, TRIAL_MOVED } from '@/lib/trial-move'

/**
 * Admin: move a trial to another date (and, if wanted, another class) — src/lib/trial-move.ts.
 * Money is untouched: a paid trial keeps its payment. Reminders start again for the new date,
 * the family is emailed the new date, and it is written to the audit log.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] as string))

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { date?: string; groupId?: string }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!me || me.role !== 'admin') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  const orgId = me.organisation_id as string

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: t } = await db.from('trial_bookings').select('id, organisation_id, status, converted, training_group_id, preferred_date, child_name, parent_name, parent_email').eq('id', id).maybeSingle()
  if (!t || t.organisation_id !== orgId) return NextResponse.json({ ok: false, error: 'Trial not found' }, { status: 404 })

  const groupId = String(body.groupId || t.training_group_id || '')
  const { data: g } = await db.from('training_groups').select('id, organisation_id, name, day_of_week, time_slot, location, class_type').eq('id', groupId).maybeSingle()
  if (!g || g.organisation_id !== orgId || g.class_type === '1-2-1') return NextResponse.json({ ok: false, error: 'Pick one of your classes.' }, { status: 400 })

  const date = String(body.date || '')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const problem = moveProblem(t, g.day_of_week as string | null, date, today)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
  const sameSpot = t.training_group_id === groupId && t.preferred_date === date && ['pending', 'confirmed'].includes(t.status as string)
  if (sameSpot) return NextResponse.json({ ok: true, unchanged: true })

  // A trial takes a place on its day: never move one onto a full day.
  if (!(await trialPlaceFree(db, groupId, date)).ok) return NextResponse.json({ ok: false, error: CLASS_FULL_TRIAL_MESSAGE.replace('Please pick another date, or join the class waiting list.', 'Pick another date.') }, { status: 409 })

  const now = new Date().toISOString()
  const { error } = await db.from('trial_bookings').update({
    training_group_id: groupId, preferred_date: date, status: statusAfterMove(t.status as string), updated_at: now,
    reminder_48h_sent: false, reminder_24h_sent: false, reminder_2h_sent: false,
  }).eq('id', id).eq('organisation_id', orgId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  await db.from('audit_log').insert({ organisation_id: orgId, user_id: user.id, action: TRIAL_MOVED, entity_type: 'trial_booking', entity_id: id,
    details: { from_date: t.preferred_date, to_date: date, from_group: t.training_group_id, to_group: groupId, from_status: t.status } }).then(() => {}, () => {})

  const { data: org } = await db.from('organisations').select('name').eq('id', orgId).single()
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const child = String(t.child_name || 'your child').replace(/\s+/g, ' ').trim()
  let emailed = false
  if (t.parent_email) {
    const r = await sendEmail({
      to: t.parent_email as string, fromName: (org?.name as string) || undefined,
      subject: `${child.split(' ')[0]}'s trial: ${day}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1b2430;font-size:15px;line-height:1.5">
        <p>Hi ${esc(String(t.parent_name || '').trim() || 'there')},</p>
        <p>${esc(child)}'s trial with ${esc((org?.name as string) || 'the academy')} is now on:</p>
        <p style="font-size:17px"><b>${esc(day)}</b>${g.time_slot ? `, ${esc(g.time_slot as string)}` : ''}<br>${esc(String(g.name).trim())}${g.location ? ` · ${esc(g.location as string)}` : ''}</p>
        <p>There's nothing to pay: anything you paid for the trial still covers it. We'll send a reminder before the day.</p>
        <p style="color:#5b6674;font-size:13px">Can't make it? Just reply to this email.</p></div>`,
    }).catch(() => null)
    emailed = !!(r as { success?: boolean } | null)?.success
  }
  return NextResponse.json({ ok: true, date, groupName: String(g.name).trim(), emailed })
}
