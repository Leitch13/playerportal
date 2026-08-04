import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// Email-link → session bridge.
//
// This route is what turns an emailed link into an authenticated session.
// Without it, every link-based flow (staff/coach "set your password", admin-
// invited parents, "forgot password", and magic-link sign-in) lands on a page
// that immediately calls an authenticated method with NO session, and the user
// sees "Auth session missing". Owners never hit it because they sign in with a
// password they set at onboarding; staff/coach have no password and depend
// entirely on this bridge.
//
// Two link shapes are handled, deliberately:
//   • token_hash + type  → verifyOtp
//       Admin-GENERATED links (auth.admin.generateLink → staff invites,
//       admin-added parents). These carry NO PKCE code_verifier in the
//       recipient's browser, so exchangeCodeForSession CANNOT work for them.
//       verifyOtp(token_hash) is the only correct path and needs no verifier.
//   • code               → exchangeCodeForSession
//       User-INITIATED PKCE flows (the user's own "forgot password" /
//       magic-link request). The verifier IS in their browser cookie, so the
//       code exchanges cleanly.
//
// Fail closed: an invalid/expired/replayed link never throws and never leaks a
// raw auth error — the user is redirected to sign-in with a plain-English note.
// ─────────────────────────────────────────────────────────────────────────

// Only ever redirect to a same-origin absolute path. Anything else (external
// URL, protocol-relative //evil.com, missing) collapses to the dashboard —
// this is an open-redirect guard on a pre-auth endpoint.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

  const supabase = await createClient()

  let established = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    established = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    established = !error
  }

  if (established) {
    return NextResponse.redirect(new URL(next, url.origin))
  }

  const signin = new URL('/auth/signin', url.origin)
  signin.searchParams.set(
    'message',
    'That link has expired or was already used. Enter your email below and use “Forgot password” to get a fresh one.'
  )
  return NextResponse.redirect(signin)
}
