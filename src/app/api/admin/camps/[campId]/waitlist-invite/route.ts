import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { sellsSingleDays, wholeCampSeatsLeft } from '@/lib/flexible-camps'
import { loadCampSeats } from '@/lib/camp-seats'
import { CAMP_WAITLIST_SOURCE, campMarker, isUuid } from '@/lib/camp-waitlist'

export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Academy admin: email one person on a camp's waiting list the booking link.
 * POST { leadId }
 *
 * Sends the ordinary public booking link. It does not hold a place or let
 * anyone past a full camp, so the reply says whether the camp is still full:
 * the academy needs a free place (a cancellation, or a higher capacity) first.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ campId: string }> }) {
  const { campId } = await ctx.params
  const body = (await request.json().catch(() => ({}))) as { leadId?: string }
  if (!isUuid(campId) || !isUuid(body.leadId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Only academy admins can invite from the waiting list' }, { status: 403 })

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: camp } = await db.from('camps').select('*').eq('id', campId).maybeSingle()
  if (!camp || camp.organisation_id !== me.organisation_id) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
  const { data: lead } = await db.from('leads').select('*').eq('id', body.leadId).maybeSingle()
  if (!lead || lead.organisation_id !== me.organisation_id || lead.source !== CAMP_WAITLIST_SOURCE || !(lead.notes || '').includes(campMarker(campId))) {
    return NextResponse.json({ error: 'That person isn’t on this camp’s waiting list' }, { status: 404 })
  }
  if (!lead.email) return NextResponse.json({ error: 'There is no email address for this person. Phone them instead.' }, { status: 400 })

  const { data: org } = await db.from('organisations').select('name, slug, contact_email').eq('id', camp.organisation_id).single()
  const academy = (org?.name as string) || 'Your academy'
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net').replace(/\/$/, '')
  const link = `${base}/book/${org?.slug}/camps/${campId}`

  const cap = camp.max_capacity != null ? Number(camp.max_capacity) : null
  let left: number | null = null
  if (cap) {
    const { count } = await db.from('camp_bookings').select('*', { count: 'exact', head: true }).eq('camp_id', campId).in('payment_status', ['pending', 'paid'])
    left = cap - (count || 0)
    if (sellsSingleDays(camp)) left = wholeCampSeatsLeft(await loadCampSeats(db, campId, cap))
  }
  const stillFull = left !== null && left <= 0

  const child = (lead.child_name as string) || 'your child'
  // Only invite a reply when a reply will reach the academy.
  const replyTo = (org?.contact_email as string) || undefined
  const questions = replyTo ? 'Any questions, just reply to this email.' : `Any questions, please contact ${esc(academy)} directly.`
  const result = await sendEmail({
    to: lead.email as string, fromName: academy, replyTo,
    subject: `A place has opened on ${camp.name}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;color:#1a1a1a;line-height:1.6;font-size:15px">
<p>Hi ${esc((lead.first_name as string) || 'there')},</p>
<p>A place has opened for ${esc(child)} on <b>${esc(String(camp.name))}</b>.</p>
<p><a href="${link}" style="display:inline-block;background:#0b6f86;color:#ffffff;font-weight:700;border-radius:8px;padding:10px 16px;text-decoration:none">Book ${esc(child)}&rsquo;s place</a></p>
<p>Places are first come, first served, so please book as soon as you can. ${questions}</p>
<p style="color:#667;font-size:13px">If the button doesn&rsquo;t work, copy this link: ${link}</p></div>`,
  })
  if (!result?.success || (result as { skipped?: boolean }).skipped) {
    return NextResponse.json({ error: 'The email didn’t send. Nothing has changed; please try again.' }, { status: 502 })
  }

  const when = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })
  await db.from('leads').update({ status: 'contacted', notes: `${lead.notes || ''} Invited to book ${when}.`.trim(), updated_at: new Date().toISOString() }).eq('id', lead.id)
  return NextResponse.json({ ok: true, stillFull })
}
