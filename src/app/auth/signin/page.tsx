'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AcademySearch from '@/components/AcademySearch'

function SignInForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [showAcademySearch, setShowAcademySearch] = useState(false)

  // Per-academy branding when user lands from an academy-specific link
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgLogo, setOrgLogo] = useState<string | null>(null)
  const [orgColor, setOrgColor] = useState('#4ecde6')

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const msgParam = searchParams.get('message')
    if (emailParam) setEmail(emailParam)
    if (msgParam) setMessage(msgParam)

    const orgSlug = searchParams.get('org')
    if (orgSlug) {
      const supabase = createClient()
      supabase
        .from('organisations')
        .select('name, logo_url, primary_color')
        .ilike('slug', orgSlug)
        .single()
        .then(({ data }) => {
          if (data) {
            setOrgName((data.name as string) || null)
            setOrgLogo((data.logo_url as string) || null)
            if (data.primary_color) setOrgColor(data.primary_color as string)
          }
        })
    }
  }, [searchParams])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? "Hmm, that email and password don't match. Try again, or use the email link option."
          : authError.message
      )
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Enter your email so we know where to send the link.')
      return
    }
    setMagicLoading(true)
    setError('')
    const supabase = createClient()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/dashboard` },
    })
    if (otpError) {
      setError(otpError.message)
      setMagicLoading(false)
    } else {
      setMagicSent(true)
      setMagicLoading(false)
    }
  }

  const inputCls = 'w-full px-3.5 py-3 sm:px-4 sm:py-3.5 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 placeholder:text-white/25 transition-all'

  return (
    <div className="min-h-screen bg-[#060606] flex items-center justify-center px-4 py-6 sm:py-12 relative overflow-hidden">
      {/* Ambient brand-colour gradient blobs — animate gently for depth */}
      <div
        className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[200px] opacity-20 pointer-events-none animate-blob-1"
        style={{ background: orgColor }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 pointer-events-none animate-blob-2"
        style={{ background: orgColor }}
      />
      {/* Subtle grain overlay for premium feel */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}
      />
      <style>{`
        @keyframes blob-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.08); }
        }
        @keyframes blob-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 40px) scale(0.95); }
        }
        .animate-blob-1 { animation: blob-1 20s ease-in-out infinite; }
        .animate-blob-2 { animation: blob-2 25s ease-in-out infinite; }
      `}</style>

      <div className="relative w-full max-w-md">
        <Link
          href={orgName ? `/book/${searchParams.get('org')}` : '/'}
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-4 sm:mb-5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {orgName ? `Back to ${orgName}` : 'Back to homepage'}
        </Link>

        {/* Header — per-academy branding when available */}
        <div className="text-center mb-5 sm:mb-6">
          {orgLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgLogo} alt={orgName || ''} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover mx-auto mb-2.5 sm:mb-3 bg-[#1a1a1a] border border-white/[0.08]" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo.png" alt="Player Portal" className="h-9 sm:h-10 w-auto object-contain mx-auto mb-2.5 sm:mb-3" />
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 tracking-tight">
            {orgName ? `Welcome back to ${orgName}` : 'Welcome back'}
          </h1>
          <p className="text-xs sm:text-sm text-white/40">
            {orgName ? 'Sign in to manage your bookings' : 'Sign in to your Player Portal account'}
          </p>
        </div>

        {message && (
          <div
            className="mb-4 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border text-xs sm:text-sm font-medium text-center"
            style={{ borderColor: `${orgColor}30`, background: `${orgColor}10`, color: orgColor }}
          >
            {message}
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4 sm:p-8 shadow-2xl">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 mb-5 sm:mb-6 p-1 bg-white/[0.04] rounded-full">
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); setMagicSent(false) }}
              className={`py-2 rounded-full text-xs font-semibold transition-all ${mode === 'password' ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'}`}
            >
              Use password
            </button>
            <button
              type="button"
              onClick={() => { setMode('magic'); setError('') }}
              className={`py-2 rounded-full text-xs font-semibold transition-all ${mode === 'magic' ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'}`}
            >
              Email link
            </button>
          </div>

          {magicSent ? (
            <div className="text-center py-6 sm:py-8">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mx-auto mb-3 sm:mb-4 flex items-center justify-center" style={{ background: `${orgColor}15` }}>
                <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke={orgColor} strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Check your inbox</h2>
              <p className="text-xs sm:text-sm text-white/50 mb-3 sm:mb-4">
                We&apos;ve sent a sign-in link to <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-[11px] sm:text-xs text-white/30">
                The link expires in 1 hour. Check spam if you don&apos;t see it.
              </p>
              <button
                type="button"
                onClick={() => { setMagicSent(false); setMode('password') }}
                className="mt-5 sm:mt-6 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Use a password instead
              </button>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-1 sm:mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className={inputCls}
                  autoComplete="email"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                  <label className="block text-xs sm:text-sm font-medium text-white/70">Password</label>
                  <Link href="/auth/forgot-password" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={inputCls + ' pr-10'}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 104.243 4.243" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              {error && (
                <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                style={{
                  background: 'white',
                  color: '#0a0a0a',
                  boxShadow: !loading ? `0 0 28px ${orgColor}40` : 'none',
                }}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-1 sm:mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className={inputCls}
                  autoComplete="email"
                />
                <p className="text-[11px] sm:text-xs text-white/40 mt-1.5 sm:mt-2">
                  We&apos;ll email you a sign-in link. No password needed.
                </p>
              </div>
              {error && (
                <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={magicLoading}
                className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                style={{
                  background: 'white',
                  color: '#0a0a0a',
                  boxShadow: !magicLoading ? `0 0 28px ${orgColor}40` : 'none',
                }}
              >
                {magicLoading ? 'Sending link…' : 'Email me a sign-in link'}
              </button>
            </form>
          )}

          <p className="text-xs sm:text-sm text-white/40 mt-5 sm:mt-6 text-center">
            New here?{' '}
            <Link href={`/auth/signup${searchParams.get('org') ? `?org=${searchParams.get('org')}` : ''}`} className="font-semibold hover:underline" style={{ color: orgColor }}>
              Create an account
            </Link>
          </p>
        </div>

        {!orgName && (
          <div className="mt-4 sm:mt-5 text-center">
            <button
              type="button"
              onClick={() => setShowAcademySearch(!showAcademySearch)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              {showAcademySearch ? 'Hide search' : 'Looking for your academy?'}
            </button>
            {showAcademySearch && (
              <div className="mt-3 max-w-sm mx-auto">
                <AcademySearch
                  onSelect={(academy) => {
                    window.location.href = `/auth/signup?org=${academy.slug}`
                  }}
                  inputClassName={inputCls + ' text-sm'}
                />
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11px] sm:text-xs text-white/20 mt-5 sm:mt-6">
          Powered by Player Portal {orgName && '· Trusted by academies across the UK'}
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#060606]">
        <div className="text-white/40 text-sm">Loading…</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
