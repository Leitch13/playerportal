/**
 * Forgot-password and email-login links that work on ANY device.
 *
 * The login system's own emails only worked in the browser that asked for them
 * (a security code is kept in that browser). Ask on the laptop, tap on the phone,
 * or open inside the Gmail/Mail app, and the link failed. WLFA parent Steven
 * Docherty, 19 Oct 2026, couldn't get in. Those emails also never showed in our
 * email log, so we couldn't see if they arrived.
 *
 * Now Player Portal makes the link on the server (one-time token, 1 hour) and sends
 * it through Resend like every other email. The link goes /auth/confirm →
 * /auth/reset-password (or /dashboard), the same route canary 13 tests every morning.
 *
 * Never says whether an account exists (same answer either way), never creates an
 * account, and limits each address to 3 emails per 15 minutes.
 * Guarded by scripts/check-auth-invariants.mjs (the pages may not go back to the
 * browser-only emails) and src/lib/auth-email-links.test.ts.
 */
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { sendEmail } from './email'
import { authLinkEmail } from './email-templates'

export type AuthLinkKind = 'reset' | 'signin'
export const AUTH_LINK_SENT = 'auth.email_link_sent'
export const MAX_PER_15_MIN = 3

/** Where the emailed link goes: /auth/confirm signs them in, then on to the next page. */
export function authLinkUrl(appUrl: string, hashedToken: string, kind: AuthLinkKind): string {
  const type = kind === 'reset' ? 'recovery' : 'magiclink'
  const next = kind === 'reset' ? '/auth/reset-password' : '/dashboard'
  return `${appUrl.replace(/\/$/, '')}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${type}&next=${encodeURIComponent(next)}`
}

/** A uuid-shaped key for the address (audit_log.entity_id is a uuid); the address itself is never stored. */
export const emailKey = (email: string) => { const h = createHash('sha256').update(email.trim().toLowerCase()).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}` }

export async function sendAuthLink(rawEmail: string, kind: AuthLinkKind, appUrl: string): Promise<{ sent: boolean; reason?: string }> {
  const email = String(rawEmail || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { sent: false, reason: 'bad_email' }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const key = emailKey(email)
  const since = new Date(Date.now() - 15 * 60000).toISOString()
  const { count } = await admin.from('audit_log').select('id', { count: 'exact', head: true }).eq('action', AUTH_LINK_SENT).eq('entity_id', key).gte('created_at', since)
  if ((count ?? 0) >= MAX_PER_15_MIN) return { sent: false, reason: 'too_many' }

  const { data, error } = await admin.auth.admin.generateLink({ type: kind === 'reset' ? 'recovery' : 'magiclink', email })
  const hashed = data?.properties?.hashed_token
  // No account with that email (or it can't sign in): say nothing, send nothing.
  if (error || !hashed || !data.user) return { sent: false, reason: 'no_account' }

  const { data: prof } = await admin.from('profiles').select('full_name, organisation_id').eq('id', data.user.id).maybeSingle()
  const { data: org } = prof?.organisation_id ? await admin.from('organisations').select('name').eq('id', prof.organisation_id).maybeSingle() : { data: null }
  const academy = (org?.name as string | undefined) || null
  const firstName = ((prof?.full_name as string | null) || '').trim().split(/\s+/)[0] || null
  const mail = authLinkEmail({ kind, link: authLinkUrl(appUrl, hashed, kind), academyName: academy, firstName })
  const r = await sendEmail({ to: email, ...mail, fromName: academy || 'Player Portal' })
  await admin.from('audit_log').insert({ organisation_id: prof?.organisation_id ?? null, user_id: data.user.id, action: AUTH_LINK_SENT, entity_type: 'auth_email', entity_id: key, details: { kind, ok: !!r.success } }).then(() => {}, () => {})
  return { sent: !!r.success }
}
