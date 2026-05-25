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
  const [showPassword, setShowPassword] = useState(false)
  const [showAcademySearch, setShowAcademySearch] = useState(false)

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const msgParam = searchParams.get('message')
    if (emailParam) setEmail(emailParam)
    if (msgParam) setMessage(msgParam)
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-8 w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-white/30 hover:text-white/50 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to homepage
        </Link>
        <img src="/logo.png" alt="Player Portal" className="h-12 w-auto object-contain mb-2" />
        <p className="text-[#888] text-sm mb-1">Sign in to your account</p>
        <p className="text-white/25 text-xs mb-6">Trusted by academies across the UK</p>
        {message && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-white/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-white/30 pr-10"
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
          <div className="text-right -mt-1">
            <Link href="/auth/forgot-password" className="text-xs text-white/50 hover:text-white/70 transition-colors">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-sm text-danger">{error === 'Invalid login credentials' ? 'Incorrect email or password. Please try again.' : error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-sm text-[#888] mt-4 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-accent hover:underline">Sign up</Link>
        </p>
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShowAcademySearch(!showAcademySearch)}
            className="text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            {showAcademySearch ? 'Hide search' : 'Find your academy'}
          </button>
          {showAcademySearch && (
            <div className="mt-3">
              <AcademySearch
                onSelect={(academy) => {
                  window.location.href = `/auth/signup?org=${academy.slug}`
                }}
                inputClassName="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-white/30 text-sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
