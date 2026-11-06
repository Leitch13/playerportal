import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * John approves every new academy by hand (6 Nov 2026: "people can't sign up and try
 * and sabotage it from the inside and get a sneak peek").
 *
 * After a new owner confirms their email (src/lib/academy-email-check.ts), the
 * dashboard shows "we're checking your academy" and the booking page stays private.
 * John gets an email at his Gmail with the academy's details and a link to a page with
 * Approve / Don't approve buttons. Approve opens the dashboard, puts the booking page
 * live and sends the owner their welcome email. Don't approve keeps it closed.
 *
 * Flag: app_metadata.academy_approval (only the server can set it). Academies made
 * before this have no flag and are not affected.
 */

export const APPROVAL_PENDING = 'pending'
export const APPROVED = 'approved'
export const NOT_APPROVED = 'rejected'
export const APPROVER_EMAIL = 'johnleitch970@gmail.com'

export type Decision = 'approve' | 'reject'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const sign = (userId: string) => createHmac('sha256', secret()).update(`academy-approval:${userId}`).digest('base64url').slice(0, 32)
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export function approvalToken(userId: string): string {
  return `${Buffer.from(userId, 'utf8').toString('base64url')}.${sign(userId)}`
}

/** The owner an approval link belongs to, or null if it was made up or tampered with. */
export function userFromApprovalToken(token: string): string | null {
  const dot = token.indexOf('.')
  if (dot <= 0 || !secret()) return null
  let userId: string
  try { userId = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8') } catch { return null }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null
  const sig = token.slice(dot + 1), expect = sign(userId)
  if (sig.length !== expect.length) return null
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? userId : null
}

export function approvalPending(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.academy_approval === APPROVAL_PENDING
}

export function notApproved(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.academy_approval === NOT_APPROVED
}

export function approvalPageUrl(userId: string): string {
  return `${appUrl()}/onboard/approve?t=${encodeURIComponent(approvalToken(userId))}`
}

type OrgInfo = { id: string; name: string; slug: string; contact_phone?: string | null; location?: string | null }

/** Email John: a new academy confirmed its email and is waiting for him. */
export async function askJohnToApprove(userId: string, owner: { name: string; email: string }, org: OrgInfo) {
  const { sendEmail } = await import('@/lib/email')
  const url = approvalPageUrl(userId)
  return sendEmail({
    to: APPROVER_EMAIL,
    subject: `Approve new academy? ${org.name}`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
  <h2 style="margin:0 0 8px">New academy waiting for you</h2>
  <p><strong>${esc(org.name)}</strong> signed up and confirmed their email. Their dashboard and booking page stay closed until you approve them.</p>
  <ul>
    <li>Owner: ${esc(owner.name)} (${esc(owner.email)})</li>
    ${org.contact_phone ? `<li>Phone: ${esc(org.contact_phone)}</li>` : ''}
    ${org.location ? `<li>Location: ${esc(org.location)}</li>` : ''}
  </ul>
  <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#4ecde6;color:#04141a;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Approve or decline</a></p>
  <p style="color:#555;font-size:14px">Opening the link changes nothing. You choose on the page.</p>
</div>`,
  })
}

/** John pressed Approve or Don't approve. Pressing again does nothing more. */
export async function decideAcademy(db: SupabaseClient, userId: string, decision: Decision): Promise<{ ok: true; state: string; academy: string } | { ok: false; error: string }> {
  const { data: got, error } = await db.auth.admin.getUserById(userId)
  if (error || !got?.user) return { ok: false, error: 'That academy owner no longer exists.' }
  const user = got.user
  const { data: profile } = await db.from('profiles').select('full_name, organisation_id').eq('id', userId).maybeSingle()
  const { data: org } = profile?.organisation_id
    ? await db.from('organisations').select('id, name, slug').eq('id', profile.organisation_id).maybeSingle()
    : { data: null }
  const academy = (org?.name as string) || 'this academy'
  if (!approvalPending(user)) {
    return { ok: true, state: user.app_metadata?.academy_approval === APPROVED ? 'already_approved' : 'already_declined', academy }
  }

  const next = decision === 'approve' ? APPROVED : NOT_APPROVED
  await db.auth.admin.updateUserById(userId, { app_metadata: { ...user.app_metadata, academy_approval: next, academy_approval_at: new Date().toISOString() } })
  try {
    await db.from('audit_log').insert({
      organisation_id: org?.id ?? null,
      action: decision === 'approve' ? 'academy.approved' : 'academy.declined',
      entity_type: 'organisation',
      entity_id: org?.id ?? null,
      details: { owner_id: userId, owner_email: user.email },
    })
  } catch { /* the decision stands */ }

  if (decision === 'approve' && org) {
    await db.from('organisations').update({ is_published: true }).eq('id', org.id)
    try {
      const { sendEmail } = await import('@/lib/email')
      const { adminWelcomeEmail } = await import('@/lib/email-templates')
      if (user.email) {
        await sendEmail({ to: user.email, ...adminWelcomeEmail({
          adminName: String(profile?.full_name || '').split(' ')[0],
          academyName: org.name as string,
          academySlug: org.slug as string,
          dashboardUrl: `${appUrl()}/dashboard`,
        }) })
      }
    } catch { /* never block the approval on the email */ }
  }
  return { ok: true, state: decision === 'approve' ? 'approved' : 'declined', academy }
}
