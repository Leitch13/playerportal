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

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] as string))

/**
 * Opening an emailed link must NOT use it up. Hotmail/Outlook (and work email) open every link to
 * scan it before the parent sees it, and the link only works once, so the parent's own tap said
 * "expired" (No.1 GK parents, 29 Oct 2026). Opening shows one button; only pressing it (a POST,
 * which scanners never do) signs them in. No script on this page, so nothing presses it for them.
 */
function continuePage(tokenHash: string, type: string, next: string): NextResponse {
  const reset = type === 'recovery' || type === 'invite'
  const label = reset ? 'Set my password' : 'Log me in'
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${label} · Player Portal</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#060606;font-family:-apple-system,system-ui,Segoe UI,sans-serif;color:#fff;padding:16px;box-sizing:border-box}
.c{width:100%;max-width:400px;background:#121212;border:1px solid #222;border-radius:20px;padding:32px 24px;text-align:center}
h1{font-size:22px;margin:0 0 8px}p{color:#9aa3ad;font-size:14px;line-height:1.5;margin:0 0 24px}
button{width:100%;padding:16px;border:0;border-radius:999px;background:#4ecde6;color:#06222b;font-size:17px;font-weight:800;cursor:pointer}button:focus-visible{outline:3px solid #fff;outline-offset:2px}</style></head>
<body><form class="c" method="post" action="/auth/confirm"><h1>${reset ? 'Set your password' : 'Log in to Player Portal'}</h1><p>Tap the button to carry on.</p>
<input type="hidden" name="token_hash" value="${esc(tokenHash)}"><input type="hidden" name="type" value="${esc(type)}"><input type="hidden" name="next" value="${esc(next)}">
<button type="submit">${label}</button></form></body></html>`
  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })
}

const EXPIRED = 'That link was already used, or a newer email replaced it. Use the newest email, or enter your email below and we’ll send a fresh link.'

function finish(url: URL, established: boolean, next: string): NextResponse {
  if (established) return NextResponse.redirect(new URL(next, url.origin), 303)
  const signin = new URL('/auth/signin', url.origin)
  signin.searchParams.set('message', EXPIRED)
  signin.searchParams.set('mode', 'link') // opens on "Email link", so a fresh one is one tap away
  return NextResponse.redirect(signin, 303)
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

  // Emailed one-time link: show the button, don't use the link yet.
  if (tokenHash && type) return continuePage(tokenHash, type, next)

  let established = false
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    established = !error
  }
  return finish(url, established, next)
}

/** The parent pressed the button: now the one-time link is used and they are signed in. */
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const form = await request.formData().catch(() => null)
  const tokenHash = String(form?.get('token_hash') || '')
  const type = String(form?.get('type') || '') as EmailOtpType
  const next = safeNext(String(form?.get('next') || '') || null)
  let established = false
  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    established = !error
  }
  return finish(url, established, next)
}
