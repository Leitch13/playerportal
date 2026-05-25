'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SendMessageForm({
  parents,
  autoOpen,
  orgId,
}: {
  parents: { id: string; full_name: string }[]
  autoOpen: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])
  const [recipientId, setRecipientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { error } = await supabase.from('messages').insert({
      organisation_id: orgId,
      sender_id: user.id,
      recipient_id: recipientId,
      subject: subject || null,
      body,
    })

    if (error) {
      alert(error.message)
    } else {
      setOpen(false)
      setRecipientId('')
      setSubject('')
      setBody('')
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Send Message
      </button>
    )
  }

  return (
    <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] p-6">
      <h2 className="text-lg font-semibold mb-4">New Message</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">To *</label>
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select parent...</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {[
              'Thanks for your message, I\'ll get back to you shortly',
              'Your child did great today!',
              'Reminder: please bring shin pads to the next session',
              'Payment is now overdue, please settle at your earliest convenience',
            ].map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setBody(tpl)}
                className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors truncate max-w-[260px]"
                title={tpl}
              >
                {tpl}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-[#1e1e1e] rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
