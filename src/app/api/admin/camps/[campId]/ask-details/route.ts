/**
 * POST /api/admin/camps/[campId]/ask-details — "Ask N families for missing details" on the
 * camp register (Cammy, No.1, 18 Oct 2026: half the bookings had no backup number or age —
 * they were made before 12–13 Oct, when those became required).
 *
 * Emails each family on this camp missing a backup contact or a date of birth one link to
 * fill them in. Only when an admin presses it. Never parents of cancelled or refunded bookings.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { backupContactPath } from '@/lib/camp-backup-contact'
import { missingDetails } from '@/lib/camp-missing-details'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export async function POST(_req: NextRequest, ctx: { params: Promise<{ campId: string }> }) {
  const { campId } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: camp } = await svc.from('camps').select('id, name, organisation_id').eq('id', campId).maybeSingle()
  if (!camp || camp.organisation_id !== profile.organisation_id) return NextResponse.json({ error: 'Camp not found' }, { status: 404 })
  const { data: org } = await svc.from('organisations').select('name, slug, contact_email').eq('id', camp.organisation_id).single()
  const missing = await missingDetails(svc, campId)
  let sent = 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
  for (const b of missing) {
    const link = `${appUrl}${backupContactPath(org!.slug as string, b.id)}`
    const first = String(b.parent_name || '').trim().split(/\s+/)[0] || 'there'
    const child = String(b.child_name || 'your child').trim().split(/\s+/)[0]
    const asks = [b.needBackup ? 'a backup contact (someone else we can ring during the camp)' : '', b.needDob ? `${child}'s date of birth` : ''].filter(Boolean).join(' and ')
    const r = await sendEmail({
      to: b.parent_email as string, fromName: org!.name as string, replyTo: (org!.contact_email as string | null) || undefined,
      subject: `A quick detail for ${child}'s place on ${camp.name}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
        <p>Hi ${esc(first)},</p>
        <p>Before ${esc(child)} comes to <strong>${esc(camp.name as string)}</strong>, we need ${esc(asks)}. It takes ten seconds.</p>
        <p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Add the details</a></p>
        <p>${esc(org!.name as string)}</p></div>`,
    }).catch(() => ({ success: false }))
    if ((r as { success?: boolean }).success !== false) sent++
  }
  await svc.from('audit_log').insert({ organisation_id: camp.organisation_id, user_id: user.id, action: 'camp.details_requested', entity_type: 'camp', entity_id: campId, details: { sent, asked: missing.length } })
  return NextResponse.json({ ok: true, sent, asked: missing.length })
}

