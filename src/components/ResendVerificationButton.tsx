'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResendVerificationButton({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0 || status === 'sending') return

    setStatus('sending')
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })

    setStatus('sent')
    setCooldown(60)

    setTimeout(() => {
      setStatus('idle')
    }, 3000)
  }

  return (
    <button
      onClick={handleResend}
      disabled={cooldown > 0 || status === 'sending'}
      className="text-sm font-medium text-amber-300 hover:text-amber-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
    >
      {status === 'sending'
        ? 'Sending...'
        : status === 'sent'
          ? 'Sent!'
          : cooldown > 0
            ? `Resend (${cooldown}s)`
            : 'Resend Email'}
    </button>
  )
}
