import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// Public password-reset request — token_hash flow (same mechanism as staff
// invites), replacing the old client-side resetPasswordForEmail/PKCE path.
//
// WHY: PKCE requires the reset link to be OPENED in the same browser it was
// REQUESTED from (the code_verifier lives in a cookie there). Parents routinely
// request on a laptop and click on their phone → the exchange has no verifier →
// it fails closed to sign-in with no explanation, which is indistinguishable
// from the "Auth session missing" bug. token_hash + verifyOtp needs no
// verifier, so the link works on ANY device.
//
// Mechanism: generate a recovery token server-side, build a token_hash link to
// /auth/confirm (which calls verifyOtp), and send it via our own branded email.
//
// Safety:
//   • Service-role key is used SERVER-SIDE ONLY — never returned to the client.
//   • Enumeration-safe — always responds { ok: true }, whether or not the email
//     has an account, so this can't be used to discover who's registered.
//   • Rate-limited per IP.
//
// DEPENDS ON /auth/confirm (shipped on the auth-session-callback branch). This
// must land on main AFTER that route exists, or the link 404s.
// ─────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const { success } = rateLimit(`password-reset:${ip}`, 10, 3600000)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()

  // One generic response for every outcome — no account enumeration.
  const generic = NextResponse.json({ ok: true })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${appUrl}/auth/reset-password` },
    })
    // Unknown email / any error → stay generic (no enumeration signal).
    const hashedToken = (data?.properties as { hashed_token?: string } | undefined)?.hashed_token
    if (error || !hashedToken) return generic

    const actionLink = `${appUrl}/auth/confirm?token_hash=${hashedToken}&type=recovery&next=${encodeURIComponent('/auth/reset-password')}`
    const { sendEmail } = await import('@/lib/email')
    const { passwordResetEmail } = await import('@/lib/email-templates')
    const tpl = passwordResetEmail({ actionLink, signinUrl: `${appUrl}/auth/signin` })
    await sendEmail({ to: email, ...tpl })
  } catch {
    // Never surface internal errors — respond generically.
  }
  return generic
}
