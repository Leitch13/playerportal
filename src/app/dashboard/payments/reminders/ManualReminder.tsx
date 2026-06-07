'use client'

/**
 * Sprint — Manual Payment Reminder.
 *
 * Previously this component wrote `payment_reminders` and `notifications`
 * directly from the browser with `email_sent: false`, which left the admin
 * thinking an email was sent when none was. Now it calls the server route
 * `/api/payments/reminders/manual` which actually sends the email through
 * the existing Resend pipeline (same one the daily cron uses), then logs
 * the reminder with an HONEST `email_sent` flag.
 *
 * The `orgId` prop is now unused (the server resolves the admin's org from
 * the session) but the prop remains for API stability with the parent page.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface OverdueParent {
  paymentId: string
  profileId: string
  name: string
  email: string
  amount: number
}

export default function ManualReminder({
  orgId,
  overdueParents,
}: {
  orgId: string  // kept for API stability — server resolves org from admin session
  overdueParents: OverdueParent[]
}) {
  void orgId  // intentionally unused — see file header
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okBanner, setOkBanner] = useState<string | null>(null)

  const selected = overdueParents.find(p => p.paymentId === selectedId)

  async function handleSend() {
    if (!selected) return
    setLoading(true)
    setError(null)
    setOkBanner(null)
    try {
      const res = await fetch('/api/payments/reminders/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paymentId: selected.paymentId,
          customMessage: message.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({} as {
        ok?: boolean
        emailSent?: boolean
        error?: string
        warning?: string
        parentEmail?: string
      }))

      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`)
        setLoading(false)
        return
      }

      // Surface email success/failure clearly to the admin so they know
      // whether the parent actually received the email.
      if (json.emailSent) {
        setOkBanner(`Email sent to ${json.parentEmail || selected.email}`)
      } else {
        setError(json.warning || 'Reminder logged but email delivery failed. The parent did NOT receive an email.')
      }

      // Close + reset after a short pause so the admin sees the result
      setTimeout(() => {
        setOpen(false)
        setSelectedId('')
        setMessage('')
        setLoading(false)
        setOkBanner(null)
        setError(null)
        router.refresh()
      }, 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={overdueParents.length === 0}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#6dd8ee] disabled:opacity-40 transition-all"
      >
        Send Manual Reminder
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-white">Send Manual Reminder</h2>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-xl">×</button>
            </div>

            <div>
              <label className="text-xs font-medium text-white/40 block mb-1.5">Select Parent</label>
              <select
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">Choose...</option>
                {overdueParents.map(p => (
                  <option key={p.paymentId} value={p.paymentId}>
                    {p.name} — £{p.amount.toFixed(2)} overdue
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-sm">
                <p className="text-white font-medium">{selected.name}</p>
                <p className="text-white/40">{selected.email}</p>
                <p className="text-red-400 font-semibold mt-1">£{selected.amount.toFixed(2)} overdue</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-white/40 block mb-1.5">Custom Message (optional)</label>
              <textarea
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50"
                rows={3}
                placeholder="Leave blank for default reminder message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={1000}
              />
            </div>

            {okBanner && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs sm:text-sm text-emerald-300">
                {okBanner}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs sm:text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSend}
                disabled={!selected || loading}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#6dd8ee] disabled:opacity-40 transition-all"
              >
                {loading ? 'Sending email…' : 'Send Reminder Email'}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] text-white hover:bg-white/[0.1] disabled:opacity-40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
