import { NextRequest, NextResponse } from 'next/server'
import { sendAuthLink } from '@/lib/auth-email-links'

/**
 * POST { email, kind: 'reset' | 'signin', returnTo? } — email a sign-in or reset link that works
 * on any device. Always answers the same way, so it never reveals who has an account.
 * See src/lib/auth-email-links.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, kind, returnTo } = await request.json()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const r = await sendAuthLink(String(email || ''), kind === 'signin' ? 'signin' : 'reset', appUrl, typeof returnTo === 'string' ? returnTo : null)
    if (r.reason === 'bad_email') return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    if (r.reason === 'too_many') return NextResponse.json({ error: 'We’ve sent a few already. Check your inbox (and junk), or try again in 15 minutes.' }, { status: 429 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
