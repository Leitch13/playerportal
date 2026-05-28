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
      user_id: selected.profileId,
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
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSend}
                disabled={!selected || loading}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#6dd8ee] disabled:opacity-40 transition-all"
              >
                {loading ? 'Sending...' : 'Send Reminder'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors"
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
