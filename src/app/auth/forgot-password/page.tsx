'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setResending(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-8 w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-white/30 hover:text-white/50 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to homepage
        </Link>
        <img src="/logo.png" alt="Player Portal" className="h-12 w-auto object-contain mb-2" />
        <p className="text-[#888] text-sm mb-6">Reset your password</p>

        {sent ? (
          <div className="space-y-4">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              Check your email for a reset link. It may take a minute to arrive.
              <p className="text-green-400/70 text-xs mt-1">Check your spam or junk folder if you don&apos;t see it.</p>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-white/60 rounded-lg text-sm font-medium hover:text-white/80 hover:border-[#3a3a3a] disabled:opacity-50 transition-colors"
            >
              {resending ? 'Resending...' : 'Resend Reset Link'}
            </button>
            <Link
              href="/auth/signin"
              className="block text-center text-sm text-accent hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-white/30"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <p className="text-sm text-[#888] text-center">
              <Link href="/auth/signin" className="text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
