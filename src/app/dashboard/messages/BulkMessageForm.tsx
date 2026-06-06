'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Group = { id: string; name: string }

/**
 * BulkMessageForm — multi-recipient fan-out send to the in-app messages
 * table. Phase 2.3b extends the existing component with an optional
 * `customRecipientIds` mode so a deep-link from the Parents page can
 * pre-populate an arbitrary cohort instead of the three built-in modes
 * (all / group / overdue).
 *
 * Day 1 UPDATE — the form now POSTs to /api/messages/send. The server
 * route handles BOTH the messages.insert (legacy schema, same columns)
 * AND the email delivery via Resend. Previously this component only did
 * the insert; no email ever reached the parent.
 *
 * The 'custom' mode is opt-in via props — when omitted, the component
 * behaves exactly as it did before.
 */
export default function BulkMessageForm({
  parents = [],
  groups = [],
  orgId,
  customRecipientIds,
  customRecipientLabels,
  autoOpen,
}: {
  parents?: { id: string; full_name: string }[]
  groups?: Group[]
  orgId: string
  // When provided + non-empty, a fourth 'custom' mode is exposed and the
  // component auto-mounts open (if autoOpen=true) with that mode selected.
  customRecipientIds?: string[]
  customRecipientLabels?: Record<string, string>
  autoOpen?: boolean
}) {
  const router = useRouter()
  const hasCustom = !!customRecipientIds && customRecipientIds.length > 0
  const [open, setOpen] = useState(!!autoOpen && hasCustom)
  const [mode, setMode] = useState<'all' | 'group' | 'overdue' | 'custom'>(hasCustom ? 'custom' : 'all')
  const [groupId, setGroupId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(0)
  // Sprint M1 (MF-5) — inline error + soft-fail warning replace alert()s
  // so a failed bulk send doesn't blow away the message body the academy
  // owner just typed. Retry button re-fires handleSubmit without resetting
  // state.
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSent(0)
    setError(null)
    setWarning(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let recipientIds: string[] = []

    if (mode === 'custom' && customRecipientIds) {
      // Deep-link cohort: use the pre-validated set passed in via props.
      // The server entry validated org membership + role before passing.
      recipientIds = customRecipientIds
    } else if (mode === 'all') {
      recipientIds = parents.map((p) => p.id)
    } else if (mode === 'group' && groupId) {
      // Get players in selected group, then their parent IDs
      const { data: enrolments } = await supabase
        .from('enrolments')
        .select('player:players(parent_id)')
        .eq('group_id', groupId)
        .eq('status', 'active')

      const parentIdSet = new Set<string>()
      for (const e of enrolments || []) {
        const player = e.player as unknown as { parent_id: string }
        if (player?.parent_id) parentIdSet.add(player.parent_id)
      }
      recipientIds = [...parentIdSet]
    } else if (mode === 'overdue') {
      const { data: overduePayments } = await supabase
        .from('payments')
        .select('parent_id')
        .eq('status', 'overdue')

      const parentIdSet = new Set<string>()
      for (const p of overduePayments || []) {
        if (p.parent_id) parentIdSet.add(p.parent_id)
      }
      recipientIds = [...parentIdSet]
    }

    if (recipientIds.length === 0) {
      setError('No recipients found for the selected criteria.')
      setLoading(false)
      return
    }

    // Day 1 — route through the unified send API so each row gets BOTH
    // inserted AND emailed. Server-side validation re-checks org membership
    // for every recipient (defence-in-depth) and the per-row delivery
    // status is persisted (after migration 074).
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientIds,
          subject: subject || null,
          body,
        }),
      })
      const json = await res.json().catch(() => ({} as { ok?: boolean; sent?: number; emailed?: number; failed?: number; error?: string }))
      if (!res.ok || !json.ok) {
        setError((json as { error?: string }).error || `Send failed (HTTP ${res.status}). Tap Retry to try again.`)
      } else {
        // Show the actual delivery count, not just the inserted count, so
        // the academy owner can tell if any sends silently failed.
        const sentN = json.sent ?? 0
        const emailedN = json.emailed ?? 0
        setSent(sentN)
        const summary = sentN === emailedN
          ? null
          : `${sentN - emailedN} stored but email delivery failed or skipped (no email on file). Check delivery status soon.`
        if (summary) setWarning(summary)
        setSubject('')
        setBody('')
        setTimeout(() => {
          setOpen(false)
          setSent(0)
          router.refresh()
        }, 2500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed. Tap Retry to try again.')
    }
    setLoading(false)
  }

  // MF-5 — Retry re-submits with the body the user already typed.
  function handleRetry() {
    handleSubmit({ preventDefault() {} } as React.FormEvent)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-accent text-primary rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
      >
        Bulk Message
      </button>
    )
  }

  // Modes available in the UI — `custom` only when the prop set is non-empty.
  const availableModes: Array<'all' | 'group' | 'overdue' | 'custom'> = hasCustom
    ? ['custom']
    : ['all', 'group', 'overdue']

  // Display chips for the custom cohort
  const customNames = (customRecipientIds || []).map(id => customRecipientLabels?.[id] || id)

  return (
    // Sprint M1 (MF-1) — flex column + max-height so the action row sticks
    // to the bottom of the panel above the soft keyboard on mobile.
    <div className="bg-[#141414] dark:bg-white/5 rounded-xl border border-[#1e1e1e] p-4 sm:p-6 flex flex-col max-h-[calc(100dvh-8rem)]">
      <h2 className="text-lg font-semibold mb-4 shrink-0">
        {hasCustom
          ? `Message ${customRecipientIds!.length} ${customRecipientIds!.length === 1 ? 'recipient' : 'recipients'}`
          : 'Bulk Message'}
      </h2>

      {sent > 0 && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-3 text-sm font-medium text-cyan-800 mb-4 shrink-0">
          Sent to {sent} parent{sent !== 1 ? 's' : ''}!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 flex flex-col min-h-0 flex-1">
        {/* Mode toggles — hidden when in custom-only mode for a cleaner UX */}
        {availableModes.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-2">Send to</label>
            <div className="flex flex-wrap gap-2">
              {availableModes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    mode === m
                      ? 'bg-primary text-white dark:bg-accent dark:text-primary'
                      : 'bg-white/5 text-white/60 hover:bg-border'
                  }`}
                >
                  {m === 'all' ? `All Parents (${parents.length})` :
                   m === 'group' ? 'Parents in Group' :
                   m === 'overdue' ? 'Parents with Overdue' :
                   `Custom (${customRecipientIds?.length || 0})`}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'group' && (
          <div>
            <label className="block text-sm font-medium mb-1">Select Group</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg bg-[#141414] dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Choose a group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        {mode === 'custom' && hasCustom && (
          <div>
            <label className="block text-sm font-medium mb-1">Recipients ({customRecipientIds!.length})</label>
            <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-[#1e1e1e] bg-white/[0.02] max-h-32 overflow-y-auto">
              {customNames.map((n, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#4ecde6]/15 text-[#4ecde6] border border-[#4ecde6]/30">
                  {n}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-white/40 mt-1.5">Cohort pre-selected via deep-link. Each recipient gets one message in their dashboard + a notification email to the address on their profile.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder=""
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg bg-[#141414] dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message *</label>
          {/* MF-1 — textarea grows from 5 rows on desktop to ~40dvh max
              on mobile so the field gets big when the keyboard's not up
              and scrolls inside its bounds once you start typing. */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={5}
            placeholder="Write your message here..."
            className="w-full px-3 py-2 border border-[#1e1e1e] rounded-lg bg-[#141414] dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px] sm:min-h-[150px] max-h-[40dvh] resize-y"
          />
        </div>

        {/* MF-5 — inline error + soft-fail warning. Replaces alert(). */}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs sm:text-sm text-rose-300">
            <div className="font-medium">Couldn&apos;t send your message</div>
            <div className="text-rose-300/80 mt-0.5">{error}</div>
          </div>
        )}
        {warning && !error && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs sm:text-sm text-amber-300">
            {warning}
          </div>
        )}

        {/* MF-1 — sticky action row above mobile keyboard. */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 mt-auto bg-[#141414] dark:bg-[#141414] border-t border-white/5 flex gap-2 flex-wrap shrink-0">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 sm:py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors flex-1 sm:flex-none min-h-[44px]"
          >
            {loading
              ? 'Sending...'
              : mode === 'custom'
                ? `Send to ${customRecipientIds!.length}`
                : `Send to ${mode === 'all' ? 'All' : mode === 'group' ? 'Group' : 'Overdue'}`}
          </button>
          {error && !loading && (
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2.5 sm:py-2 bg-rose-500/15 text-rose-200 border border-rose-500/30 rounded-lg text-sm font-medium hover:bg-rose-500/25 transition-colors min-h-[44px]"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 sm:py-2 border border-[#1e1e1e] rounded-lg text-sm font-medium hover:bg-white/5 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
