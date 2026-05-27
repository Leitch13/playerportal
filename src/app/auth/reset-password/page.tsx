'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const accent = '#4ecde6'

  // Light password strength indicator — purely visual feedback, not enforced
  const strength = (() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  })()
  const strengthLabels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent']
  const strengthColors = ['#ef4444', '#ef4444', '#f59e0b', '#fbbf24', '#10b981', '#10b981']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Those passwords don\'t match. Have another look.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/auth/signin?message=Password+updated.+Sign+in+with+your+new+password.'
      }, 1800)
    }
  }

  return (
    <div className="min-h-screen bg-[#060606] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[200px] opacity-20 pointer-events-none" style={{ background: accent }} />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 pointer-events-none" style={{ background: accent }} />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Player Portal" className="h-10 w-auto object-contain mx-auto mb-3" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 tracking-tight">
            {success ? 'All done!' : 'Set a new password'}
          </h1>
          <p className="text-sm text-white/40">
            {success ? 'Redirecting you to sign in…' : 'Pick something only you would know'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-6 sm:p-8 shadow-2xl">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pop-in" style={{ background: `${accent}15` }}>
                <svg className="w-10 h-10" fill="none" stroke={accent} strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-white/70">Password updated successfully.</p>
              <style>{`
                @keyframes pop-in {
                  0% { transform: scale(0); opacity: 0; }
                  60% { transform: scale(1.2); opacity: 1; }
                  100% { transform: scale(1); opacity: 1; }
                }
                .animate-pop-in { animation: pop-in 0.5s ease-out; }
              `}</style>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 placeholder:text-white/25 transition-all pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 104.243 4.243" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {/* Strength meter */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div
                          key={n}
                          className="h-1 flex-1 rounded-full transition-all"
                          style={{ background: n <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.06)' }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: strengthColors[strength] }}>
                      {strengthLabels[strength]}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  autoComplete="new-password"
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
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/20 mt-6">Powered by Player Portal</p>
      </div>
    </div>
  )
}
