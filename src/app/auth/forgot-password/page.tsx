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
  const accent = '#4ecde6'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: rpError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (rpError) {
      setError(rpError.message)
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
    <div className="min-h-screen bg-[#060606] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[200px] opacity-20 pointer-events-none" style={{ background: accent }} />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 pointer-events-none" style={{ background: accent }} />

      <div className="relative w-full max-w-md">
        <Link href="/auth/signin" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to sign in
        </Link>

        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Player Portal" className="h-10 w-auto object-contain mx-auto mb-3" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 tracking-tight">
            {sent ? 'Check your inbox' : 'Forgot password?'}
          </h1>
          <p className="text-sm text-white/40">
            {sent ? "We've sent a reset link your way" : "Pop in your email — we'll send a reset link"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 sm:p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse-once" style={{ background: `${accent}15` }}>
                <svg className="w-8 h-8" fill="none" stroke={accent} strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-white/70 mb-1">
                Sent to <span className="text-white font-semibold">{email}</span>
              </p>
              <p className="text-xs text-white/40 mb-6">
                The link expires in 1 hour. Check spam if you don&apos;t see it.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06] disabled:opacity-50 transition-all"
              >
                {resending ? 'Resending…' : 'Resend link'}
              </button>
              <Link
                href="/auth/signin"
                className="inline-block mt-3 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Back to sign in
              </Link>
              <style>{`
                @keyframes pulse-once {
                  0% { transform: scale(0.8); opacity: 0; }
                  60% { transform: scale(1.1); opacity: 1; }
                  100% { transform: scale(1); opacity: 1; }
                }
                .animate-pulse-once { animation: pulse-once 0.5s ease-out; }
              `}</style>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 placeholder:text-white/25 transition-all"
                />
              </div>
              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-base transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                style={{
                  background: 'white',
                  color: '#0a0a0a',
                  boxShadow: !loading ? `0 0 28px ${accent}40` : 'none',
                }}
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <p className="text-sm text-white/40 text-center pt-2">
                Remembered it?{' '}
                <Link href="/auth/signin" className="font-semibold hover:underline" style={{ color: accent }}>
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/20 mt-6">Powered by Player Portal</p>
      </div>
    </div>
  )
}
