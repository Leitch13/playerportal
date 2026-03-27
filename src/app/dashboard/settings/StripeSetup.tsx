'use client'

import { useState, useEffect, useCallback } from 'react'

interface ConnectStatus {
  connected: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
  details_submitted?: boolean
  business_name?: string
}

interface WebhookTestResult {
  stripe_secret_key: boolean
  stripe_webhook_secret: boolean
  webhook_url: string
  webhooks: Array<{
    id: string
    url: string
    status: string
    enabled_events: string[]
  }>
  recent_events: Array<{
    id: string
    type: string
    created: string
  }>
  error?: string
}

const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
]

export default function StripeSetup() {
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [webhookTest, setWebhookTest] = useState<WebhookTestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    fetchConnectStatus()
  }, [])

  async function fetchConnectStatus() {
    try {
      const res = await fetch('/api/stripe/connect/status')
      const data = await res.json()
      setConnectStatus(data)
    } catch {
      setConnectStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  const testConnection = useCallback(async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/stripe/webhook-test')
      const data = await res.json()
      setWebhookTest(data)
    } catch {
      setWebhookTest(null)
    } finally {
      setTesting(false)
    }
  }, [])

  async function startConnect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // ignore
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-surface rounded w-48" />
        <div className="h-32 bg-surface rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stripe Connect Status */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h3 className="font-bold text-lg">Stripe Connect</h3>

        {connectStatus?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-700">Connected</span>
              {connectStatus.business_name && (
                <span className="text-sm text-text-light">
                  — {connectStatus.business_name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatusBadge
                label="Charges"
                ok={connectStatus.charges_enabled}
              />
              <StatusBadge
                label="Payouts"
                ok={connectStatus.payouts_enabled}
              />
              <StatusBadge
                label="Details submitted"
                ok={connectStatus.details_submitted}
              />
            </div>
            {!connectStatus.details_submitted && (
              <button
                onClick={startConnect}
                disabled={connecting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {connecting ? 'Redirecting...' : 'Complete Onboarding'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              <span className="text-sm font-medium text-text-light">Not connected</span>
            </div>
            <p className="text-sm text-text-light">
              Connect your Stripe account to start accepting payments from parents.
            </p>
            <button
              onClick={startConnect}
              disabled={connecting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#635BFF] text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {connecting ? 'Setting up...' : 'Connect with Stripe'}
            </button>
          </div>
        )}
      </div>

      {/* Webhook Configuration */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Webhook Configuration</h3>
          <button
            onClick={testConnection}
            disabled={testing}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {webhookTest && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatusBadge
                label="STRIPE_SECRET_KEY"
                ok={webhookTest.stripe_secret_key}
              />
              <StatusBadge
                label="STRIPE_WEBHOOK_SECRET"
                ok={webhookTest.stripe_webhook_secret}
              />
            </div>

            {webhookTest.webhooks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-text-light uppercase tracking-wider">
                  Registered Endpoints
                </p>
                {webhookTest.webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className="p-3 rounded-xl border border-border/50 bg-surface/30 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          wh.status === 'enabled'
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-sm font-medium truncate">
                        {wh.url}
                      </span>
                    </div>
                    <p className="text-xs text-text-light">
                      Events: {wh.enabled_events.length === 1 && wh.enabled_events[0] === '*'
                        ? 'All events'
                        : wh.enabled_events.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {webhookTest.recent_events.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-text-light uppercase tracking-wider">
                  Recent Events
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {webhookTest.recent_events.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface/30"
                    >
                      <code className="font-mono text-primary">{ev.type}</code>
                      <span className="text-text-light">
                        {new Date(ev.created).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {webhookTest.error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {webhookTest.error}
              </div>
            )}
          </div>
        )}

        {/* Setup Instructions */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs font-semibold text-text-light uppercase tracking-wider">
            Setup Instructions
          </p>
          <ol className="space-y-2.5 text-sm text-text-light list-decimal list-inside">
            <li>
              Go to{' '}
              <a
                href="https://dashboard.stripe.com/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:opacity-80"
              >
                Stripe Dashboard &rarr; Developers &rarr; Webhooks
              </a>
            </li>
            <li>Click <strong className="text-foreground">&quot;Add endpoint&quot;</strong></li>
            <li>
              Set the endpoint URL to:
              <code className="block mt-1 p-2 rounded-lg bg-surface text-xs font-mono text-foreground select-all break-all">
                https://theplayerportal.net/api/stripe/webhooks
              </code>
            </li>
            <li>
              Select these events:
              <ul className="mt-1 space-y-0.5 ml-4 list-disc">
                {REQUIRED_EVENTS.map((ev) => (
                  <li key={ev}>
                    <code className="text-xs font-mono">{ev}</code>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              Copy the <strong className="text-foreground">Signing secret</strong> (starts with{' '}
              <code className="text-xs font-mono">whsec_</code>)
            </li>
            <li>
              Add it as{' '}
              <code className="text-xs font-mono text-foreground">STRIPE_WEBHOOK_SECRET</code>{' '}
              in your{' '}
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:opacity-80"
              >
                Vercel environment variables
              </a>
            </li>
            <li>
              <strong className="text-foreground">Redeploy</strong> your application for the
              changes to take effect
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
        ok
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-red-50 text-red-600 border border-red-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-400'}`} />
      <span className="font-medium">{label}</span>
    </div>
  )
}
