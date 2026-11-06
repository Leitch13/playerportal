import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * A new academy proves its email is real before it gets a working account.
 *
 * John, 2 Nov 2026: the same person (Trooli home broadband, Berkshire) made fake
 * academies and parents named "A" with made-up addresses (a@gmail.com, aaa@gmail.com)
 * in July, September and October, to look around the product. Any string shaped
 * like an email got straight in. Now /api/onboard/signup marks the new owner
 * `academy_email_check: 'pending'` (app_metadata: only the server can set it) and
 * emails them a confirm button. Until they press it the dashboard shows "check your
 * inbox" and the booking page stays private. Academies made before this have no flag
 * and are not affected.
 */

export const PENDING = 'pending'
export const CONFIRMED = 'confirmed'

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(`academy-email:${userId}`).digest('base64url').slice(0, 32)
}

export function emailCheckToken(userId: string): string {
  return `${Buffer.from(userId, 'utf8').toString('base64url')}.${sign(userId)}`
}

/** The user a confirm link belongs to, or null if it was made up or tampered with. */
export function userFromEmailCheckToken(token: string): string | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  let userId: string
  try { userId = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8') } catch { return null }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null
  const sig = token.slice(dot + 1), expect = sign(userId)
  if (sig.length !== expect.length) return null
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expect)) ? userId : null
}

export function emailCheckPending(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.academy_email_check === PENDING
}

export function confirmEmailUrl(userId: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'}/onboard/confirm-email?t=${encodeURIComponent(emailCheckToken(userId))}`
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** The "confirm your email" email. Opening the link shows a button page; only pressing it confirms. */
export async function sendEmailCheck(to: string, firstName: string, academy: string, userId: string) {
  const { sendEmail } = await import('@/lib/email')
  const url = confirmEmailUrl(userId)
  return sendEmail({
    to,
    subject: `Confirm your email to open ${academy} on Player Portal`,
    html: `
<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5">
  <p>Hi ${esc(firstName || 'there')},</p>
  <p>Thanks for setting up <strong>${esc(academy)}</strong> on Player Portal. Press the button to confirm this is your email, and your dashboard and booking page open straight away.</p>
  <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#4ecde6;color:#04141a;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Confirm my email</a></p>
  <p style="color:#555;font-size:14px">Didn't sign up? You can ignore this email.</p>
  <p>Player Portal</p>
</div>`,
  })
}

/**
 * The owner pressed Confirm: mark them confirmed, put their booking page live, send the
 * welcome email, and tell John the academy is real. Pressing it twice does nothing more.
 */
export async function confirmAcademyEmail(db: SupabaseClient, userId: string): Promise<{ ok: true; already: boolean } | { ok: false; error: string }> {
  const { data: got, error } = await db.auth.admin.getUserById(userId)
  if (error || !got?.user) return { ok: false, error: 'This link is no longer valid. Sign in and press "Send it again".' }
  const user = got.user
  if (!emailCheckPending(user)) return { ok: true, already: true }
  await db.auth.admin.updateUserById(userId, { app_metadata: { ...user.app_metadata, academy_email_check: CONFIRMED, academy_email_confirmed_at: new Date().toISOString() } })
  const { data: profile } = await db.from('profiles').select('full_name, organisation_id').eq('id', userId).maybeSingle()
  const { data: org } = profile?.organisation_id
    ? await db.from('organisations').select('id, name, slug, contact_phone, location').eq('id', profile.organisation_id).maybeSingle()
    : { data: null }
  // New academies (6 Nov 2026) also wait for John's approval: nothing opens yet,
  // John is emailed Approve / Don't approve (src/lib/academy-approval.ts).
  const { approvalPending, askJohnToApprove } = await import('@/lib/academy-approval')
  if (approvalPending(user)) {
    if (org) {
      try {
        await askJohnToApprove(userId, { name: String(profile?.full_name || ''), email: user.email || '' }, {
          id: org.id as string, name: org.name as string, slug: org.slug as string,
          contact_phone: org.contact_phone as string | null, location: org.location as string | null,
        })
      } catch { /* the lock screen still shows; John also has the signup alert */ }
    }
    return { ok: true, already: false }
  }
  if (org) await db.from('organisations').update({ is_published: true }).eq('id', org.id)
  try {
    const { sendEmail } = await import('@/lib/email')
    const { adminWelcomeEmail } = await import('@/lib/email-templates')
    if (user.email && org) {
      await sendEmail({ to: user.email, ...adminWelcomeEmail({
        adminName: String(profile?.full_name || '').split(' ')[0],
        academyName: org.name as string,
        academySlug: org.slug as string,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'}/dashboard`,
      }) })
    }
    const admin = 'johnleitch970@gmail.com' // new-academy alerts go to John's own inbox (3 Nov 2026), as in api/onboard
    if (admin && org) {
      await sendEmail({
        to: admin,
        subject: `Email confirmed: ${org.name}`,
        html: `<p><strong>${esc(org.name as string)}</strong> confirmed their email, so it's a real inbox. Their booking page is now live.</p>
<ul><li>Owner: ${esc(String(profile?.full_name || ''))} (${esc(user.email || '')})</li>${org.contact_phone ? `<li>Phone: ${esc(org.contact_phone as string)}</li>` : ''}${org.location ? `<li>Location: ${esc(org.location as string)}</li>` : ''}</ul>
<p>https://www.theplayerportal.net/book/${encodeURIComponent(org.slug as string)}</p>`,
      })
    }
  } catch { /* emails never block confirming */ }
  return { ok: true, already: false }
}
