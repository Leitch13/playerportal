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
        <img src="/logo.png" alt="Player Portal" className="h-12 w-auto object-contain mb-2" />
        <p className="text-[#888] text-sm mb-6">Sign in to your account</p>
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-white/30"
            />
          </div>
          <div className="text-right -mt-1">
            <Link href="/auth/forgot-password" className="text-xs text-white/30 hover:text-white/50 transition-colors">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
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
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
