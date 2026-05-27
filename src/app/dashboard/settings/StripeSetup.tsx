'use client'

import { useState, useEffect } from 'react'

interface ConnectStatus {
  connected: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
  details_submitted?: boolean
  business_name?: string
}

export default function StripeSetup() {
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

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

  async function startConnect() {
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      // 409 = stale account, auto-cleared by API → tell user to click again
      if (res.status === 409) {
        setConnectError(data.error || 'Stripe account was stale — cleared. Please click Connect with Stripe again.')
        // Auto-refresh status so they see the cleared state
        await fetchConnectStatus()
      } else if (res.status === 403) {
        setConnectError('Only admins can connect Stripe. Make sure you are signed in as an admin.')
      } else {
        setConnectError(data.error || `Unexpected response (status ${res.status}). Try refreshing the page.`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      setConnectError(`Couldn't reach the server: ${message}. Check your internet and try again.`)
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
            {connectError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <p className="font-medium">⚠️ Connection failed</p>
                <p className="mt-1 text-xs">{connectError}</p>
              </div>
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
            {connectError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <p className="font-medium">⚠️ Connection failed</p>
                <p className="mt-1 text-xs">{connectError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connected account — manage on Stripe */}
      {connectStatus?.connected && (
        <div className="bg-white rounded-2xl border border-border p-6 space-y-3">
          <h3 className="font-bold text-lg">Your Stripe Account</h3>
          <p className="text-sm text-text-light">
            Manage your business details, bank account, and payouts directly in your Stripe dashboard.
          </p>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/stripe/connect/dashboard', { method: 'POST' })
                const data = await res.json()
                if (data.url) window.open(data.url, '_blank')
              } catch {
                window.open('https://dashboard.stripe.com', '_blank')
              }
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#635BFF] text-white hover:opacity-90 transition-all inline-flex items-center gap-2"
          >
            Open my Stripe Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}
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
