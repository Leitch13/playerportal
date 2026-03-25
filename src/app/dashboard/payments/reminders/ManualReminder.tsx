'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface OverdueParent {
  paymentId: string
  profileId: string
  name: string
  email: string
  amount: number
}

export default function ManualReminder({ orgId, overdueParents }: { orgId: string; overdueParents: OverdueParent[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const selected = overdueParents.find(p => p.paymentId === selectedId)

  async function handleSend() {
    if (!selected) return
    setLoading(true)
    const supabase = createClient()

    // Record reminder
    await supabase.from('payment_reminders').insert({
      payment_id: selected.paymentId,
      profile_id: selected.profileId,
      organisation_id: orgId,
      reminder_type: 'custom',
      email_sent: false,
    })

    // Create notification
    await supabase.from('notifications').insert({
      profile_id: selected.profileId,
      organisation_id: orgId,
      type: 'payment_reminder',
      title: 'Payment reminder',
      body: message || `£${selected.amount.toFixed(2)} payment is overdue. Please update your payment.`,
      link: '/dashboard/payments',
    })

    setOpen(false)
    setSelectedId('')
    setMessage('')
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={overdueParents.length === 0}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-all"
      >
        Send Manual Reminder
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl border border-border p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Send Manual Reminder</h2>
              <button onClick={() => setOpen(false)} className="text-text-light hover:text-primary text-xl">×</button>
            </div>

            <div>
              <label className="text-xs font-medium text-text-light block mb-1.5">Select Parent</label>
              <select
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
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
              <div className="bg-surface rounded-xl p-3 text-sm">
                <p><strong>{selected.name}</strong></p>
                <p className="text-text-light">{selected.email}</p>
                <p className="text-red-500 font-semibold mt-1">£{selected.amount.toFixed(2)} overdue</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-text-light block mb-1.5">Custom Message (optional)</label>
              <textarea
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                rows={3}
                placeholder="Leave blank for default reminder message"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSend}
                disabled={!selected || loading}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {loading ? 'Sending...' : 'Send Reminder'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-surface transition-colors"
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
