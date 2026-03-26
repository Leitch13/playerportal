'use client'

import { useState, useEffect } from 'react'

interface EmailStatus {
  configured: boolean
  from: string
}

interface TestResult {
  success: boolean
  message: string
  id?: string
  error?: string
}

export default function EmailSetup() {
  const [status, setStatus] = useState<EmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  useEffect(() => {
    fetch('/api/email/status')
      .then(r => r.json())
      .then(data => setStatus(data))
      .catch(() => setStatus({ configured: false, from: '' }))
      .finally(() => setLoading(false))
  }, [])

  async function sendTestEmail() {
    setSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/email/test', { method: 'POST' })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: 'Request failed. Check your network connection.' })
    }
    setSending(false)
  }

  const steps = [
    {
      title: 'Create a Resend account',
      description: 'Go to resend.com and sign up for a free account.',
    },
    {
      title: 'Add and verify your domain',
      description: 'In the Resend dashboard, add your domain and create the required DNS records (SPF, DKIM, etc.) with your DNS provider.',
    },
    {
      title: 'Create an API key',
      description: 'In Resend > API Keys, create a new key with sending permission.',
    },
    {
      title: 'Add RESEND_API_KEY to Vercel',
      description: 'Go to your Vercel project > Settings > Environment Variables. Add RESEND_API_KEY with your API key value for Production (and optionally Preview).',
    },
    {
      title: 'Add FROM_EMAIL to Vercel',
      description: 'Add another env var FROM_EMAIL with the value like: Academy Name <noreply@yourdomain.com>',
    },
    {
      title: 'Redeploy',
      description: 'Trigger a new deployment in Vercel so the environment variables take effect.',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-border p-6 space-y-6">
      <h2 className="font-bold text-lg">Email Configuration</h2>

      {/* Status */}
      <div className="flex items-start gap-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-light">
            <div className="w-4 h-4 border-2 border-text-light/30 border-t-text-light rounded-full animate-spin" />
            Checking email status...
          </div>
        ) : status?.configured ? (
          <div className="flex-1 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <p className="font-semibold text-sm text-emerald-700">Email is configured</p>
            </div>
            <p className="text-xs text-emerald-600 mt-1">
              Sending from: <span className="font-medium">{status.from}</span>
            </p>
          </div>
        ) : (
          <div className="flex-1 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <p className="font-semibold text-sm text-amber-700">Email is not configured</p>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              Set up Resend to enable booking confirmations, welcome emails, and announcements.
            </p>
          </div>
        )}
      </div>

      {/* Test Email */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Send Test Email</h3>
        <p className="text-xs text-text-light">
          Sends a welcome email to your own email address to verify the setup is working.
        </p>
        <button
          onClick={sendTestEmail}
          disabled={sending}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {sending ? 'Sending...' : 'Send Test Email'}
        </button>

        {testResult && (
          <div className={`p-3 rounded-xl text-sm ${
            testResult.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <p className="font-medium">{testResult.success ? 'Success' : 'Error'}</p>
            <p className="text-xs mt-0.5">{testResult.message}</p>
            {testResult.id && (
              <p className="text-xs mt-0.5 opacity-70">Email ID: {testResult.id}</p>
            )}
          </div>
        )}
      </div>

      {/* Setup Guide */}
      <div className="space-y-3 pt-2 border-t border-border">
        <h3 className="font-semibold text-sm">Setup Guide</h3>
        <p className="text-xs text-text-light">
          Player Portal uses Resend to send transactional emails. Follow these steps to enable email sending in production.
        </p>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-text-light mt-0.5">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
