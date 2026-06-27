'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sanitiseNext } from '@/lib/social-login'

/**
 * Google OAuth callback handler.
 *
 * Supabase redirects parents here after Google consent. We:
 *   1. Check for explicit provider errors (?error=, ?error_description=)
 *   2. Exchange the auth code for a session (creates auth.users + fires
 *      handle_new_user trigger on first signup)
 *   3. Redirect to a sanitised `next` path or /dashboard fallback
 *
 * Failure modes — every one shows a friendly screen with a "back to
 * sign in" CTA. Never auto-redirect on failure (parent should see what
 * went wrong).
 */

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function handle() {
      // 1. Provider-side error (parent declined consent / Google API failure)
      const errCode = searchParams.get('error')
      const errDesc = searchParams.get('error_description')
      if (errCode) {
        // Common case: 'access_denied' when parent taps Cancel in Google
        if (cancelled) return
        setError(
          errCode === 'access_denied'
            ? "Sign-in was cancelled. You can try again or use email instead."
            : "Couldn't sign in with Google. Please try again or use email sign in.",
        )
        // Log for ops visibility — non-sensitive (no tokens)
        console.error('[auth/callback] provider error:', errCode, errDesc)
        return
      }

      // 2. Code exchange
      const code = searchParams.get('code')
      if (!code) {
        if (cancelled) return
        setError("Couldn't sign in with Google. Please try again or use email sign in.")
        return
      }

      const safeNext = sanitiseNext(searchParams.get('next'))
      const supabase = createClient()
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return

      if (sessionError) {
        // The 094 trigger raising due to a missing/unresolved org_slug surfaces
        // here as a session-exchange failure. Friendly message either way.
        console.error('[auth/callback] exchangeCodeForSession failed:', sessionError.message)
        setError(
          "Couldn't sign in with Google. Please try again or use email sign in.",
        )
        return
      }

      router.replace(safeNext)
    }

    handle()
    return () => {
      cancelled = true
    }
  }, [searchParams, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Sign-in didn&apos;t work</h1>
          <p className="text-sm text-white/60 mb-6">{error}</p>
          <div className="flex flex-col gap-2">
            <Link
              href="/auth/signin"
              className="inline-block w-full px-4 py-2.5 rounded-lg bg-[#4ecde6] text-black font-semibold text-sm hover:bg-[#3bb8d0] transition-colors"
            >
              Back to sign in
            </Link>
            <Link
              href="/"
              className="inline-block text-xs text-white/40 hover:text-white/60 mt-2"
            >
              Return to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white px-4">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-4">
          <svg className="animate-spin w-10 h-10 text-[#4ecde6]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-white/60">Signing you in…</p>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#060606] text-white">
          <p className="text-sm text-white/60">Loading…</p>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  )
}
