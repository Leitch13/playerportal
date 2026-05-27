'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Academy policies form — per-club configuration of:
 *  - Cancellation notice period (days)
 *  - Refund policy (text)
 *  - Late-payment grace period (days)
 *  - Custom T&Cs text (academy's own terms)
 *
 * Used on the admin settings page. Saved to organisations table.
 */
export default function PoliciesForm({
  orgId,
  initial,
}: {
  orgId: string
  initial: {
    cancellation_notice_days: number
    refund_policy: string
    late_payment_grace_days: number
    terms_text: string
  }
}) {
  const [noticeDays, setNoticeDays] = useState(initial.cancellation_notice_days.toString())
  const [refundPolicy, setRefundPolicy] = useState(initial.refund_policy)
  const [graceDays, setGraceDays] = useState(initial.late_payment_grace_days.toString())
  const [terms, setTerms] = useState(initial.terms_text)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('organisations')
        .update({
          cancellation_notice_days: parseInt(noticeDays || '0', 10) || 0,
          refund_policy: refundPolicy.trim() || null,
          late_payment_grace_days: parseInt(graceDays || '0', 10) || 0,
          terms_text: terms.trim() || null,
        })
        .eq('id', orgId)
      if (updateError) {
        setError(updateError.message)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-white/30'

  return (
    <form onSubmit={handleSave} className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Academy Policies</h2>
        <p className="text-sm text-white/50 mt-1">
          Set your notice period, refund policy, and T&amp;Cs. Shown to parents at signup and on your booking page.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Cancellation notice period
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="365"
              value={noticeDays}
              onChange={(e) => setNoticeDays(e.target.value)}
              placeholder="0"
              className={inputCls + ' pr-14'}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">days</span>
          </div>
          <p className="text-xs text-white/40 mt-1.5">
            How much notice parents must give to cancel. 0 = immediate. 30 is standard for UK academies.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Late-payment grace period
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="90"
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
              placeholder="0"
              className={inputCls + ' pr-14'}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">days</span>
          </div>
          <p className="text-xs text-white/40 mt-1.5">
            Days after a failed payment before access is suspended. 7 is reasonable.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          Refund policy
        </label>
        <textarea
          value={refundPolicy}
          onChange={(e) => setRefundPolicy(e.target.value)}
          rows={3}
          placeholder="e.g. Refunds available within 7 days of payment for sessions not yet attended."
          className={inputCls + ' resize-none'}
        />
        <p className="text-xs text-white/40 mt-1.5">
          Shown to parents on the booking page and at signup. Keep it short and clear.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          Terms &amp; Conditions
        </label>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={10}
          placeholder="Your academy's full T&Cs. Parents will tick a box agreeing to these at signup. Plain text or Markdown."
          className={inputCls + ' resize-y font-mono text-sm'}
        />
        <p className="text-xs text-white/40 mt-1.5">
          Public at <code className="text-white/60">/book/{'{'}your-slug{'}'}/terms</code>. Parents accept these at signup.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-white/40">
          {saved ? <span className="text-emerald-400">✓ Saved</span> : 'Changes apply immediately to new signups'}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save Policies'}
        </button>
      </div>
    </form>
  )
}
