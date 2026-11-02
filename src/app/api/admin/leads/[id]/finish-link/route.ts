import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

// POST /api/admin/leads/[id]/finish-link — a parent who started paying (trial or membership) and walked
// away: the academy emails them the booking page to finish (John, 2 Nov 2026). Admins only, own academy.
// Charges nothing; they pick and pay on the normal booking page.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can send this.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: lead } = await db.from('leads').select('id, organisation_id, first_name, email, child_name, notes').eq('id', id).maybeSingle()
  if (!lead || lead.organisation_id !== orgId) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  if (!lead.email) return NextResponse.json({ error: 'There is no email for this family.' }, { status: 400 })
  const { data: org } = await db.from('organisations').select('name, slug, contact_email, contact_phone').eq('id', orgId).single()
  const url = `${(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '')}/book/${org!.slug}`
  const academy = (org?.name as string) || 'Your academy'
  const child = (lead.child_name as string | null)?.trim()
  const mail = await sendEmail({
    to: lead.email as string, fromName: academy, replyTo: (org?.contact_email as string | null) || undefined,
    subject: `Finish booking${child ? ` ${child}'s place` : ''} at ${academy}`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
  <p>Hi ${esc(String(lead.first_name || '').trim() === 'Prospect' ? 'there' : String(lead.first_name || 'there'))},</p>
  <p>You started booking${child ? ` for ${esc(child)}` : ''} but the payment wasn't finished, so nothing has been taken and the place isn't booked yet.</p>
  <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Finish booking</a></p>
  <p style="color:#555;font-size:14px">Any questions? Reply to this email${org?.contact_phone ? ` or call ${esc(org.contact_phone as string)}` : ''}.</p>
  <p>${esc(academy)}</p>
</div>`,
  })
  if (!mail.success) return NextResponse.json({ error: `The email to ${lead.email} didn't send.` }, { status: 502 })
  const stamp = `[${new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}] Finish-booking link emailed.`
  await db.from('leads').update({ status: 'contacted', notes: lead.notes ? `${lead.notes}\n${stamp}` : stamp, updated_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true })
}
