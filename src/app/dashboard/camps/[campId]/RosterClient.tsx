/**
 * Sprint 10 — Roster Workspace.
 *
 * Client-side interactive roster:
 *   • Search (child / parent / email)
 *   • Per-row actions: WhatsApp, Email, Resend confirmation
 *   • Toolbar: Send-to-all (deep-links into /dashboard/messages), Print, Export CSV
 *   • Medical badge per row (red pill when medical_info non-empty)
 *   • Age column
 *
 * Communication deep-links re-use existing surfaces:
 *   • Send-to-all       → /dashboard/messages?recipients=<csv-of-parent-profile-ids>
 *                         (the Sprint 6 / messages-page deep-link contract)
 *   • WhatsApp per row  → buildWhatsappUrl + WA_TEMPLATES.parentToAcademyHi
 *   • Resend per row    → POST /api/admin/camps/[campId]/bookings/[id]/resend-confirmation
 *
 * No protected system touched.
 * No camp_bookings mutations (read + bulk-action deep-links only).
 */
'use client'

import { hasMedicalNote } from '@/lib/camp-booking-details'
import { backupContactPath } from '@/lib/camp-backup-contact'
import { isDateDay } from '@/lib/camp-checkin'
import { outstanding, paidAmount } from '@/lib/camp-payment-display'
import { sortRoster, agesPresent, onlyAge, type RosterSort } from '@/lib/roster-sort'
import SortBar from '@/components/SortBar'
import { useState, useMemo } from 'react'
import { PALETTE_ICON_PATHS } from '@/components/ui/PaletteIcon'
import Link from 'next/link'
import { buildWhatsappUrl, WA_TEMPLATES } from '@/lib/whatsapp'

export interface CampRosterBooking {
  id: string
  child_name: string | null
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  // A second adult to ring (src/lib/camp-backup-contact.ts). null = none given yet.
  backup_name?: string | null
  backup_phone?: string | null
  parent_profile_id: string | null   // resolved server-side; null when anon
  medical_info: string | null
  amount_paid: number | null
  payment_status: string
  booking_source: string | null
  // Photo & video consent (migration 111). null = never asked.
  photo_consent: boolean | null
  created_at: string
  // Flexible Camps (Phase 3E). Ordered list of formatted date labels
  // for flexible bookings ("Mon 8 Jul", ...). Null/undefined for
  // whole-camp bookings. Server-side ordered by camp_days sort order.
  selected_day_labels?: string[] | null
}

// Flexible Camps (Phase 3E). Per-day roster grouping — one entry per
// camp_days row. Passed only when isFlexibleCamp; empty otherwise.
export interface CampPerDayGroup {
  dayId: string
  date: string     // ISO YYYY-MM-DD
  label: string    // pre-formatted "Mon 8 Jul"
  isAvailable: boolean
  children: { bookingId: string; childName: string | null; in?: boolean }[]
}

export interface EligibleTargetCamp {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  location: string | null
  capacity: number
  booked: number
  effective_price: number
}

export default function RosterClient({
  campId,
  campName,
  academyName,
  academySlug = '',
  bookings,
  eligibleTargetCamps = [],
  sourceCampPrice = 0,
  callerIsAdmin = false,
  missingDetailsCount = 0,
  // Flexible Camps (Phase 3E). Both default to whole-camp-shaped so
  // existing call sites remain byte-identical.
  isFlexibleCamp = false,
  perDayGroups = [],
}: {
  campId: string
  campName: string
  academyName: string
  academySlug?: string
  bookings: CampRosterBooking[]
  eligibleTargetCamps?: EligibleTargetCamp[]
  sourceCampPrice?: number
  callerIsAdmin?: boolean
  /** Families missing a backup contact or a date of birth. */
  missingDetailsCount?: number
  isFlexibleCamp?: boolean
  perDayGroups?: CampPerDayGroup[]
}) {
  const [search, setSearch] = useState('')
  // Order and age filter for the bookings table. 'booked' is the order they came in.
  const [sort, setSort] = useState<RosterSort>('booked')
  const [ageOnly, setAgeOnly] = useState<number | 'all'>('all')
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendError, setResendError] = useState<Record<string, string>>({})
  const [resentMap, setResentMap] = useState<Record<string, 'ok' | 'fail'>>({})

  // Move Camp Booking Phase 1 — modal state
  const [moveOpen, setMoveOpen] = useState<CampRosterBooking | null>(null)
  const [moveTargetId, setMoveTargetId] = useState<string>('')
  const [moveReason, setMoveReason] = useState<string>('')
  const [moveNotifyParent, setMoveNotifyParent] = useState(true)
  const [moveBusy, setMoveBusy] = useState(false)
  const [moveError, setMoveError] = useState<string>('')
  const [moveSuccess, setMoveSuccess] = useState<string>('')

  function openMove(b: CampRosterBooking) {
    setMoveOpen(b)
    setMoveTargetId('')
    setMoveReason('')
    setMoveNotifyParent(true)
    setMoveError('')
    setMoveSuccess('')
  }
  function closeMove() {
    if (moveBusy) return
    setMoveOpen(null)
  }
  async function submitMove() {
    if (!moveOpen || !moveTargetId) return
    setMoveBusy(true)
    setMoveError('')
    try {
      const res = await fetch(`/api/admin/camps/${campId}/bookings/${moveOpen.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_camp_id: moveTargetId,
          reason: moveReason.trim() || undefined,
          notifyParent: moveNotifyParent,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Move failed (HTTP ${res.status})`)
      setMoveSuccess(`Moved to ${data.to_camp_name || 'the target camp'}.`)
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.reload()
      }, 900)
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Move failed')
    } finally {
      setMoveBusy(false)
    }
  }

  const selectedTarget = moveTargetId
    ? eligibleTargetCamps.find((c) => c.id === moveTargetId) ?? null
    : null
  const targetFull = selectedTarget
    ? selectedTarget.capacity > 0 && selectedTarget.booked >= selectedTarget.capacity
    : false

  // ─── Filtered view ───
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const found = !q ? bookings : bookings.filter((b) => {
      const hay = [
        b.child_name || '',
        b.parent_name || '',
        b.parent_email || '',
        b.parent_phone || '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
    return sortRoster(onlyAge(found, ageOnly, (b) => b.child_age), sort, (b) => b.child_name, (b) => b.child_age)
  }, [search, bookings, sort, ageOnly])
  const tableAges = useMemo(() => agesPresent(bookings, (b) => b.child_age), [bookings])

  // ─── Send-to-all deep-link ───
  // Re-uses the Messages page's existing `?recipients=<csv>` contract
  // (validateRecipientsParam). Only parents WITH a resolved profile id
  // are includable — that's the Messages page invariant. Anonymous
  // campers can't be in-app messaged; we surface them via the
  // mailto-all fallback button alongside.
  const parentProfileIds = useMemo(
    () => Array.from(new Set(filtered.map((b) => b.parent_profile_id).filter((v): v is string => !!v))),
    [filtered],
  )
  const sendToAllHref = parentProfileIds.length > 0
    ? `/dashboard/messages?recipients=${encodeURIComponent(parentProfileIds.join(','))}`
    : null

  // ─── Mailto-all fallback (anon-friendly) ───
  // BCC-bundles every parent_email — works for anon camp bookers who
  // never created a profile.
  const parentEmails = useMemo(
    () => Array.from(new Set(filtered.map((b) => b.parent_email).filter((v): v is string => !!v && !v.endsWith('@theplayerportal.net')))),
    [filtered],
  )
  const mailtoAllHref = parentEmails.length > 0
    ? `mailto:?bcc=${encodeURIComponent(parentEmails.join(','))}&subject=${encodeURIComponent(`${campName} — quick update from ${academyName}`)}`
    : null

  // ─── CSV export ───
  // Flexible Camps (Phase 3E) — adds a "Booked days" column ONLY when
  // the current camp is flexible. Whole-camp exports are byte-identical
  // to today's CSV format.
  function downloadCsv() {
    const headers = isFlexibleCamp
      ? ['Child', 'Age', 'Parent', 'Email', 'Phone', 'Backup contact', 'Backup phone', 'Medical info', 'Photo consent', 'Booked at', 'Booked days', 'Amount paid (£)', 'Payment status', 'Source']
      : ['Child', 'Age', 'Parent', 'Email', 'Phone', 'Backup contact', 'Backup phone', 'Medical info', 'Photo consent', 'Booked at', 'Amount paid (£)', 'Payment status', 'Source']
    const rows = filtered.map((b) => {
      const base = [
        b.child_name || '',
        b.child_age != null ? String(b.child_age) : '',
        b.parent_name || '',
        b.parent_email || '',
        b.parent_phone || '',
        b.backup_name || '',
        b.backup_phone || '',
        b.medical_info || '',
        b.photo_consent === true ? 'Yes' : b.photo_consent === false ? 'No' : 'Not asked',
        b.created_at,
      ]
      const daysCol = isFlexibleCamp
        ? [(b.selected_day_labels || []).join('; ')]
        : []
      const tail = [
        // Paid column is money received only; an unpaid booking's price is what is owed.
        paidAmount(b.payment_status, b.amount_paid).toFixed(2),
        b.payment_status === 'pending' ? `not paid (${outstanding(b.payment_status, b.amount_paid)})` : b.payment_status,
        b.booking_source === 'admin_created' ? 'Added by admin' : 'Online booking',
      ]
      return [...base, ...daysCol, ...tail]
    })
    const escape = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-roster-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ─── Unpaid-booking actions: send a payment link, or remove the row ───
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [linkResult, setLinkResult] = useState<Record<string, 'ok' | 'fail'>>({})
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function sendPaymentLink(bookingId: string) {
    setLinkingId(bookingId)
    try {
      const res = await fetch(`/api/admin/camps/${campId}/bookings/${bookingId}/payment-link`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      const ok = res.ok && (json as { ok?: boolean }).ok
      setLinkResult((m) => ({ ...m, [bookingId]: ok ? 'ok' : 'fail' }))
      if (!ok && (json as { error?: string }).error) alert((json as { error?: string }).error)
    } catch {
      setLinkResult((m) => ({ ...m, [bookingId]: 'fail' }))
    }
    setLinkingId(null)
  }

  // ─── Ask families for missing details (No.1, 18 Oct 2026) ───
  const [asking, setAsking] = useState<'idle' | 'confirm' | 'sending' | string>('idle')
  async function askDetails() {
    setAsking('sending')
    try {
      const res = await fetch(`/api/admin/camps/${campId}/ask-details`, { method: 'POST' })
      const j = await res.json().catch(() => ({})) as { ok?: boolean; sent?: number; error?: string }
      setAsking(j.ok ? `Sent to ${j.sent} famil${j.sent === 1 ? 'y' : 'ies'}.` : (j.error || 'Could not send.'))
    } catch { setAsking('Could not send.') }
  }

  // ─── Change amount on an unpaid booking (WLFA, 17 Oct 2026) ───
  const [amountFor, setAmountFor] = useState<string | null>(null)
  const [amountVal, setAmountVal] = useState('')
  const [amountWhy, setAmountWhy] = useState('')
  const [amountErr, setAmountErr] = useState('')
  const [amountSaving, setAmountSaving] = useState(false)
  async function saveAmount(bookingId: string) {
    setAmountSaving(true); setAmountErr('')
    try {
      const res = await fetch(`/api/admin/camps/${campId}/bookings/${bookingId}/amount`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(amountVal), reason: amountWhy }) })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) { setAmountErr(json.error || 'Could not change it.'); setAmountSaving(false); return }
      setAmountFor(null); setAmountVal(''); setAmountWhy('')
      window.location.reload()
    } catch { setAmountErr('Could not change it.') }
    setAmountSaving(false)
  }

  async function removeBooking(b: CampRosterBooking) {
    if (!confirm(`Remove ${b.child_name}'s unpaid booking? The seat is freed and any payment link they were sent stops working. This can't be undone.`)) return
    setRemovingId(b.id)
    try {
      const res = await fetch(`/api/admin/camps/${campId}/bookings/${b.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert((json as { error?: string }).error || 'Could not remove booking'); setRemovingId(null); return }
      window.location.reload()
    } catch {
      alert('Could not remove booking')
      setRemovingId(null)
    }
  }

  // ─── Resend per-row ───
  async function resendConfirmation(bookingId: string) {
    setResendingId(bookingId)
    try {
      const res = await fetch(`/api/admin/camps/${campId}/bookings/${bookingId}/resend-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json().catch(() => ({}))
      const ok = res.ok && (json as { ok?: boolean }).ok
      if (!ok) setResendError((m) => ({ ...m, [bookingId]: (json as { error?: string }).error || 'please retry' }))
      setResentMap((m) => ({ ...m, [bookingId]: ok ? 'ok' : 'fail' }))
    } catch {
      setResentMap((m) => ({ ...m, [bookingId]: 'fail' }))
    }
    setResendingId(null)
  }

  return (
    <div className="space-y-3">
      {callerIsAdmin && missingDetailsCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3" data-testid="camp-ask-details">
          <span className="text-sm text-amber-200">{missingDetailsCount} {missingDetailsCount === 1 ? 'family is' : 'families are'} missing a backup contact or a date of birth.</span>
          {asking === 'idle' && <button type="button" onClick={() => setAsking('confirm')} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-black">Ask them for it</button>}
          {asking === 'confirm' && <span className="flex items-center gap-2 text-xs text-amber-100">Email {missingDetailsCount} {missingDetailsCount === 1 ? 'family' : 'families'} a link? <button type="button" onClick={askDetails} className="rounded-md bg-amber-400 px-2.5 py-1 font-bold text-black">Yes, send</button><button type="button" onClick={() => setAsking('idle')} className="text-white/60">No</button></span>}
          {asking === 'sending' && <span className="text-xs text-amber-100">Sending…</span>}
          {!['idle', 'confirm', 'sending'].includes(asking) && <span className="text-xs font-semibold text-amber-100">{asking}</span>}
        </div>
      )}

      {/* ─── TOOLBAR ─── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] p-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" data-testid="camp-roster-toolbar">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10 4a6 6 0 100 12 6 6 0 000-12z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by child, parent, or email…"
              data-testid="camp-roster-search"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[#080e18] border border-[#1d2c42] text-white placeholder-white/30 focus:border-[#4ecde6] focus:outline-none"
            />
          </div>
        </div>
        <SortBar sort={sort} onSort={setSort} ages={tableAges} age={ageOnly} onAge={setAgeOnly} options={['booked', 'name', 'youngest', 'oldest']} testid="camp-roster-sort" />

        <div className="flex items-center gap-2 flex-wrap">
          {sendToAllHref ? (
            <Link
              href={sendToAllHref}
              data-testid="camp-roster-send-to-all"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-[#4ecde6]/10 text-[#4ecde6] border border-[#4ecde6]/30 hover:bg-[#4ecde6]/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.36-3.18A8.94 8.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Send to all
              <span className="text-[10px] opacity-70">({parentProfileIds.length})</span>
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white/30 border border-white/10 cursor-not-allowed"
              title="No parents with in-app profiles in this filter"
            >
              Send to all
              <span className="text-[10px]">(0)</span>
            </span>
          )}

          {mailtoAllHref && (
            <a
              href={mailtoAllHref}
              data-testid="camp-roster-email-all"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white/[0.04] text-white/80 border border-white/10 hover:bg-white/[0.08] transition-colors"
              title="Open your email client with every parent's email BCC'd"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email all
            </a>
          )}

          <Link
            href={`/dashboard/camps/${campId}/print`}
            target="_blank"
            data-testid="camp-roster-print"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white/[0.04] text-white/80 border border-white/10 hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print register
          </Link>

          <button
            type="button"
            onClick={downloadCsv}
            data-testid="camp-roster-csv"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white/[0.04] text-white/80 border border-white/10 hover:bg-white/[0.08] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ─── TABLE ─── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0f1a2b] overflow-hidden" data-testid="camp-roster">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Booked players</h2>
          <span className="text-[11px] text-white/40" data-testid="camp-roster-count">
            {filtered.length === bookings.length
              ? `${bookings.length} entr${bookings.length === 1 ? 'y' : 'ies'}`
              : `${filtered.length} of ${bookings.length} matching`}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]"><svg className="h-6 w-6 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>{PALETTE_ICON_PATHS['tent']}</svg></span>
            <p className="text-sm text-white/55">
              {bookings.length === 0
                ? 'No bookings yet for this camp.'
                : 'No bookings match that search.'}
            </p>
            {bookings.length === 0 && (
              <p className="text-xs text-white/40 mt-1">
                Share the booking link or use <span className="text-white">Add player</span> to enter one manually.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Child</th>
                  <th className="text-left px-3 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Age</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Parent</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Contact</th>
                  <th className="text-left px-3 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Medical</th>
                  <th className="text-left px-3 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Photos</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Booked</th>
                  {/* Flexible Camps (Phase 3E) — extra Days column when
                      the camp is flexible; whole-camp roster is byte-
                      identical (column absent). */}
                  {isFlexibleCamp && (
                    <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Days</th>
                  )}
                  <th className="text-right px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Amount</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Status</th>
                  <th className="text-right px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const whatsappHref = buildWhatsappUrl(
                    b.parent_phone,
                    WA_TEMPLATES.parentToAcademyHi({ academyName, childName: b.child_name || undefined }),
                  )
                  const hasMedical = !!(b.medical_info && b.medical_info.trim())
                  const resent = resentMap[b.id]
                  return (
                    <tr
                      key={b.id}
                      data-testid="camp-roster-row"
                      data-booking-id={b.id}
                      className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-3 text-white font-medium">
                        {b.child_name || '—'}
                        {/* Unpaid: red box with what's outstanding — src/lib/camp-payment-display.ts */}
                        {b.child_age == null && <span data-testid="camp-roster-age-missing" className="ml-2 inline-block rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 whitespace-nowrap">Age missing</span>}
                        {outstanding(b.payment_status, b.amount_paid) && <span data-testid="camp-roster-outstanding" className="ml-2 inline-block rounded-md border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300 whitespace-nowrap">{outstanding(b.payment_status, b.amount_paid)}</span>}
                      </td>
                      <td className="px-3 py-3 text-white/70 text-xs">{b.child_age != null ? `${b.child_age}` : '—'}</td>
                      <td className="px-6 py-3 text-white/70">{b.parent_name || '—'}</td>
                      <td className="px-6 py-3 text-white/55 text-xs">
                        {b.parent_email && !b.parent_email.endsWith('@theplayerportal.net') && (
                          <div className="truncate max-w-[200px]">
                            <a href={`mailto:${b.parent_email}`} className="text-[#4ecde6] hover:underline">{b.parent_email}</a>
                          </div>
                        )}
                        {b.parent_phone && <div>{b.parent_phone}</div>}
                        {b.backup_phone && <div className="text-white/50" data-testid="camp-roster-backup">Backup: {b.backup_name} · {b.backup_phone}</div>}
                      </td>
                      <td className="px-3 py-3" data-testid="camp-roster-medical-cell">
                        {hasMedical ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 cursor-help"
                            data-testid="camp-roster-medical-badge"
                            title={b.medical_info as string}
                          >
                             Medical
                          </span>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      {/* Photo & video consent (migration 111). A refusal is loud;
                          never-asked is quiet but present and is NOT consent. */}
                      <td className="px-3 py-3 whitespace-nowrap" data-testid="camp-roster-photo-cell">
                        {b.photo_consent === false ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white"
                            title="This family has asked that their child is not photographed or filmed"
                          >
                            No photos
                          </span>
                        ) : b.photo_consent === true ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/15 text-green-400">
                            OK
                          </span>
                        ) : (
                          <span className="text-white/35 text-[11px]" title="Nobody has asked this family about photos yet — this is not consent">
                            not asked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-white/55 text-xs">{fmtBookedAt(b.created_at)}</td>
                      {isFlexibleCamp && (
                        <td className="px-6 py-3 text-white/70 text-xs align-top">
                          {b.selected_day_labels && b.selected_day_labels.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                                {b.selected_day_labels.length} day{b.selected_day_labels.length === 1 ? '' : 's'}
                              </span>
                              <span className="text-white/70">
                                {b.selected_day_labels.join(', ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-white/25">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-3 text-right">
                        {paidAmount(b.payment_status, b.amount_paid) > 0 ? (
                          <span data-testid="camp-roster-amount" className="text-emerald-400 font-semibold">£{paidAmount(b.payment_status, b.amount_paid).toFixed(2)}</span>
                        ) : (
                          <span data-testid="camp-roster-amount" className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <PaymentStatusPill status={b.payment_status} />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* WhatsApp */}
                          {whatsappHref ? (
                            <a
                              href={whatsappHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid="camp-roster-row-whatsapp"
                              title="Message on WhatsApp"
                              className="p-1.5 rounded-md text-emerald-300 hover:bg-emerald-500/15 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.599 5.391l-.99 3.617 3.879-.99zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="p-1.5 rounded-md text-white/15 cursor-not-allowed" title="No phone on file">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24z" />
                              </svg>
                            </span>
                          )}

                          {/* Email */}
                          {b.parent_email && !b.parent_email.endsWith('@theplayerportal.net') ? (
                            <a
                              href={`mailto:${b.parent_email}`}
                              data-testid="camp-roster-row-email"
                              title={`Email ${b.parent_email}`}
                              className="p-1.5 rounded-md text-[#4ecde6] hover:bg-[#4ecde6]/15 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="p-1.5 rounded-md text-white/15 cursor-not-allowed" title="No email on file">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </span>
                          )}

                          {/* Resend confirmation */}
                          <button
                            type="button"
                            // Only a paid booking has a confirmation to resend. Unpaid ones get
                            // "Send payment link" instead; the server refuses them, and the icon
                            // used to just turn red with no reason (WLFA, 15 Oct 2026).
                            disabled={resendingId === b.id || b.payment_status !== 'paid' || !b.parent_email || b.parent_email.endsWith('@theplayerportal.net')}
                            onClick={() => resendConfirmation(b.id)}
                            data-testid="camp-roster-row-resend"
                            title={b.payment_status !== 'paid' ? 'Not paid yet, so there is no confirmation to resend. Use Send payment link.' : resent === 'ok'? 'Sent ' : resent === 'fail' ? `Failed: ${resendError[b.id] || 'please retry'}` : 'Resend confirmation email'}
                            className={`p-1.5 rounded-md transition-colors ${
                              resent === 'ok'
                                ? 'text-emerald-300 bg-emerald-500/15'
                                : resent === 'fail'
                                ? 'text-red-300 bg-red-500/15 hover:bg-red-500/25'
                                : 'text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
                            }`}
                          >
                            {resendingId === b.id ? (
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                                <path strokeLinecap="round" d="M21 12a9 9 0 11-9-9" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            )}
                          </button>

                          {/* Move Camp Booking Phase 1 — admin-only, only for
                              moveable bookings (pending/paid), only when there
                              is at least one eligible target camp. */}
                          {callerIsAdmin && (b.payment_status === 'pending' || b.payment_status === 'paid') && eligibleTargetCamps.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openMove(b)}
                              title="Move to another camp"
                              data-testid="camp-roster-row-move"
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                            >
                              Move
                            </button>
                          )}

                          {/* Unpaid bookings: chase it, or clear it. Neither exists for
                              paid rows — those go through Refund. */}
                          {b.payment_status === 'pending' && b.parent_email && !b.parent_email.endsWith('@theplayerportal.net') && (
                            <button
                              type="button"
                              disabled={linkingId === b.id}
                              onClick={() => sendPaymentLink(b.id)}
                              title={linkResult[b.id] === 'ok' ? 'Payment link emailed' : linkResult[b.id] === 'fail' ? 'Failed — retry' : 'Email the parent a payment link for this booking'}
                              data-testid="camp-roster-row-paylink"
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                linkResult[b.id] === 'ok' ? 'bg-emerald-500/15 text-emerald-300'
                                : linkResult[b.id] === 'fail' ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
                                : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                              } disabled:opacity-50`}
                            >
                              {linkingId === b.id ? 'Sending…' : linkResult[b.id] === 'ok' ? 'Link sent ✓' : 'Send payment link'}
                            </button>
                          )}
                          {callerIsAdmin && b.payment_status === 'pending' && (
                            amountFor === b.id ? (
                              <span className="flex flex-wrap items-center gap-1.5" data-testid="camp-roster-amount-form">
                                <span className="relative"><span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-white/40">£</span>
                                  <input inputMode="decimal" value={amountVal} onChange={(e) => setAmountVal(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={Number(b.amount_paid || 0).toFixed(2)} aria-label="New amount" className="w-20 rounded-md border border-white/15 bg-black/30 py-1 pl-5 pr-2 text-[12px] text-white" /></span>
                                <input value={amountWhy} onChange={(e) => setAmountWhy(e.target.value)} placeholder="Why? e.g. sibling discount" aria-label="Reason" className="w-44 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-[12px] text-white" />
                                <button type="button" disabled={amountSaving} onClick={() => saveAmount(b.id)} className="rounded-md bg-[#4ecde6] px-2 py-1 text-[11px] font-bold text-black disabled:opacity-50">{amountSaving ? 'Saving…' : 'Save'}</button>
                                <button type="button" onClick={() => { setAmountFor(null); setAmountErr('') }} className="px-1 text-[11px] text-white/50">Cancel</button>
                                {amountErr && <span className="basis-full text-[11px] text-red-300">{amountErr}</span>}
                              </span>
                            ) : (
                              <button type="button" onClick={() => { setAmountFor(b.id); setAmountVal(Number(b.amount_paid || 0).toFixed(2)); setAmountWhy('') }} data-testid="camp-roster-change-amount" className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white/[0.06] text-white/80 hover:bg-white/[0.1]">Change amount</button>
                            )
                          )}
                          {callerIsAdmin && b.payment_status === 'pending' && (
                            <button
                              type="button"
                              disabled={removingId === b.id}
                              onClick={() => removeBooking(b)}
                              title="Remove this unpaid booking and free the seat"
                              data-testid="camp-roster-row-remove"
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white/5 text-white/50 hover:bg-red-500/15 hover:text-red-300 transition-colors disabled:opacity-50"
                            >
                              {removingId === b.id ? 'Removing…' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flexible Camps (Phase 3E) — per-day breakdown.
          Coaches use this as the day's register: only children who
          BOOKED a specific day appear on that day's list. When the
          camp is whole-camp, this section is not rendered — the flat
          roster above IS the register. */}
      {perDayGroups.length > 0 && <PerDayRegister groups={perDayGroups} bookings={bookings} campId={campId} flexible={isFlexibleCamp} academySlug={academySlug} />}

      {/* Move Camp Booking Phase 1 — modal */}
      {moveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeMove}
        >
          <div
            className="bg-[#080e18] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Move camp booking</h2>
              <button
                onClick={closeMove}
                disabled={moveBusy}
                className="text-white/50 hover:text-white disabled:opacity-30 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-white/50">Child</span>
                <span className="text-white">{moveOpen.child_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Parent</span>
                <span className="text-white text-right">{moveOpen.parent_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Email</span>
                <span className="text-white text-right text-xs">{moveOpen.parent_email || '—'}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                <span className="text-white/50">From</span>
                <span className="text-white text-right">{campName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Amount paid</span>
                {outstanding(moveOpen.payment_status, moveOpen.amount_paid) ? <span className="font-bold text-red-300">{outstanding(moveOpen.payment_status, moveOpen.amount_paid)}</span> : <span className="text-emerald-400 font-semibold">£{Number(moveOpen.amount_paid ?? 0).toFixed(2)}</span>}
              </div>
            </div>

            <label className="block text-xs text-white/50 mb-1.5">Target camp</label>
            <select
              value={moveTargetId}
              onChange={(e) => setMoveTargetId(e.target.value)}
              disabled={moveBusy}
              className="w-full px-3 py-2 mb-3 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
            >
              <option value="" className="bg-[#0f1a2b]">— Select a camp —</option>
              {eligibleTargetCamps.map((c) => {
                const full = c.capacity > 0 && c.booked >= c.capacity
                const dates = c.start_date
                  ? new Date(c.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  : 'TBD'
                const cap = c.capacity > 0 ? `${c.booked}/${c.capacity}` : `${c.booked}`
                return (
                  <option key={c.id} value={c.id} disabled={full} className="bg-[#0f1a2b]">
                    {c.name} · {dates} · £{c.effective_price.toFixed(2)} · {cap}{full ? ' · FULL' : ''}
                  </option>
                )
              })}
            </select>

            {selectedTarget && (
              <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3 mb-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Dates</span>
                  <span className="text-white">
                    {selectedTarget.start_date
                      ? new Date(selectedTarget.start_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                      : 'TBD'}
                    {selectedTarget.end_date && selectedTarget.end_date !== selectedTarget.start_date
                      ? ` → ${new Date(selectedTarget.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : ''}
                  </span>
                </div>
                {selectedTarget.location && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Location</span>
                    <span className="text-white">{selectedTarget.location}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/50">Capacity</span>
                  <span className={targetFull ? 'text-red-300' : 'text-white'}>
                    {selectedTarget.capacity > 0
                      ? `${selectedTarget.booked} / ${selectedTarget.capacity}`
                      : `${selectedTarget.booked}`}
                    {targetFull ? ' · FULL' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Price</span>
                  <span className="text-white">
                    £{selectedTarget.effective_price.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {selectedTarget && targetFull && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-200">
                Target camp is full.
              </div>
            )}

            <label className="block text-xs text-white/50 mb-1.5">Reason (optional)</label>
            <textarea
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              disabled={moveBusy}
              maxLength={500}
              rows={2}
              placeholder="e.g. parent requested earlier dates"
              className="w-full px-3 py-2 mb-3 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs focus:outline-none focus:border-white/20 resize-none"
            />

            <label className="flex items-center gap-2 mb-4 text-xs text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={moveNotifyParent}
                onChange={(e) => setMoveNotifyParent(e.target.checked)}
                disabled={moveBusy}
                className="w-3.5 h-3.5 rounded border border-white/20 bg-white/[0.04] accent-[#4ecde6] cursor-pointer disabled:cursor-not-allowed"
              />
              Notify parent by email
            </label>

            {moveError && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-200">
                {moveError}
              </div>
            )}
            {moveSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-200">
                 {moveSuccess}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeMove}
                disabled={moveBusy}
                className="px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-30"
              >
                Cancel
              </button>
              <button
                onClick={submitMove}
                disabled={moveBusy || !moveTargetId || targetFull || !!moveSuccess}
                className="px-5 py-2 bg-[#4ecde6] text-black font-semibold rounded-lg text-sm hover:bg-[#3bb8d0] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {moveBusy ? 'Moving…' : 'Move booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtBookedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function PaymentStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid:      { label: 'Paid',      cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    pending:   { label: 'Not paid',  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    failed:    { label: 'Failed',    cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
    refunded:  { label: 'Refunded',  cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    cancelled: { label: 'Cancelled', cls: 'bg-white/10 text-white/60 border-white/15' },
  }
  const m = map[status] || { label: status, cls: 'bg-white/10 text-white/60 border-white/15' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${m.cls}`}>
      {m.label}
    </span>
  )
}

/** "tyler smith" → "Tyler Smith". Only lifts a word typed all in lower case; "JohnGabriel" and "McKay" are left as typed. */
function tidyName(name: string | null): string {
  const clean = (name || '').trim().replace(/\s+/g, ' ')
  if (!clean) return '—'
  return clean.split(' ').map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

/**
 * The day register for a flexible camp: pick a day, tick children in, tap a name for their details.
 *
 * It used to show every day at once, each as a cloud of name tags wrapping at
 * random widths. On a phone with fifteen children a day that was a wall of
 * boxes (No.1 Goalkeeping, Oct 2026), and a name was only a name: the parent's
 * number and the medical notes were in a wide table further up the page.
 *
 * A coach standing at a pitch wants one day, in alphabetical order, one name
 * per line, a tick for who has arrived, and the phone number one tap away.
 */
function PerDayRegister({ groups, bookings, campId, flexible, academySlug }: { groups: CampPerDayGroup[]; bookings: CampRosterBooking[]; campId: string; flexible: boolean; academySlug: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // The link a family uses to add a backup contact to a booking they have already made.
  const copyBackupLink = async (bookingId: string) => {
    const url = `${window.location.origin}${backupContactPath(academySlug, bookingId)}`
    try { await navigator.clipboard.writeText(url); setCopiedId(bookingId); setTimeout(() => setCopiedId(null), 2000) } catch { window.prompt('Copy this link and send it to the parent:', url) }
  }
  const noBackup = bookings.filter((b) => b.payment_status === 'paid' && !b.backup_phone).length
  const today = new Date().toISOString().slice(0, 10)
  const running = groups.filter((g) => g.isAvailable)
  // Open on today if the camp is on today, else the next day it runs, else the first day.
  const first = running.find((g) => g.date === today) || running.find((g) => g.date > today) || running[0] || groups[0]
  const [dayId, setDayId] = useState<string>(first.dayId)
  const [openId, setOpenId] = useState<string | null>(null)
  const [sort, setSort] = useState<RosterSort>('name')
  const [ageOnly, setAgeOnly] = useState<number | 'all'>('all')
  // Ticks start from what the server saved and change the moment they are pressed.
  const [ticks, setTicks] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.flatMap((g) => g.children.map((c) => [`${c.bookingId}:${g.dayId}`, !!c.in]))))
  const [saving, setSaving] = useState<string | null>(null)
  const [tickError, setTickError] = useState('')
  const day = groups.find((g) => g.dayId === dayId) || first
  const byId = new Map(bookings.map((b) => [b.id, b]))
  const everyone = day.children.map((c) => ({ id: c.bookingId, name: tidyName(c.childName), age: byId.get(c.bookingId)?.child_age ?? null }))
  const dayAges = agesPresent(everyone, (c) => c.age)
  // An age that isn't on this day falls back to everyone, so switching day never shows an empty list by surprise.
  const ageShown = ageOnly !== 'all' && dayAges.some((a) => a.age === ageOnly) ? ageOnly : 'all'
  const names = sortRoster(onlyAge(everyone, ageShown, (c) => c.age), sort, (c) => c.name, (c) => c.age)
  const inCount = (g: CampPerDayGroup) => g.children.filter((c) => ticks[`${c.bookingId}:${g.dayId}`]).length

  async function toggle(bookingId: string) {
    const key = `${bookingId}:${day.dayId}`, next = !ticks[key]
    setTickError(''); setSaving(key); setTicks((t) => ({ ...t, [key]: next }))
    try {
      const res = await fetch(`/api/admin/camps/${campId}/check-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isDateDay(day.dayId) ? { bookingId, date: day.date, in: next } : { bookingId, dayId: day.dayId, in: next }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'That didn’t save. Please try again.')
    } catch (e) {
      setTicks((t) => ({ ...t, [key]: !next }))
      setTickError(e instanceof Error ? e.message : 'That didn’t save. Please try again.')
    }
    setSaving(null)
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f1a2b]" data-testid="camp-perday-register">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <h3 className="text-sm font-bold text-white">{flexible ? 'Who’s attending each day' : 'Register'}</h3>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#4ecde6]">{flexible ? 'Flexible days' : 'Day by day'}</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-y border-white/[0.05] px-4 py-2.5 sm:px-6" role="tablist" aria-label="Camp days">
        {groups.map((g) => {
          const on = g.dayId === day.dayId
          const [dow, ...rest] = g.label.split(' ')
          const arrived = inCount(g)
          return (
            <button
              key={g.dayId}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => { setDayId(g.dayId); setOpenId(null); setTickError('') }}
              data-testid="camp-perday-tab"
              className={`min-w-[64px] shrink-0 rounded-lg border px-2.5 py-1.5 text-center transition-colors ${
                on ? 'border-[#4ecde6]/50 bg-[#4ecde6]/[0.12]' : 'border-white/[0.08] hover:bg-white/[0.04]'
              } ${g.isAvailable ? '' : 'opacity-50'}`}
            >
              <span className={`block text-[10px] font-semibold uppercase tracking-wide ${on ? 'text-[#4ecde6]' : 'text-white/45'}`}>{dow}</span>
              <span className="block text-sm font-bold text-white">{rest.join(' ')}</span>
              <span className="block text-[10px] tabular-nums text-white/50">{!g.isAvailable ? 'off' : arrived > 0 ? `${arrived}/${g.children.length} in` : g.children.length}</span>
            </button>
          )
        })}
      </div>
      <div className="px-4 py-3 sm:px-6" data-testid="camp-perday-group">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-white">{day.label}</span>
          <span className="text-xs text-white/50" data-testid="camp-perday-count">
            {!day.isAvailable ? 'Camp not running this day' : `${inCount(day)} of ${everyone.length} in`}
          </span>
        </div>
        {everyone.length > 0 && <div className="mb-2"><SortBar sort={sort} onSort={setSort} ages={dayAges} age={ageShown} onAge={setAgeOnly} options={['name', 'youngest', 'oldest']} testid="camp-perday-sort" /></div>}
        {everyone.length > 0 && <p className="mb-1 text-[11px] text-white/35">Tap the circle to tick a child in. Tap a name for their details.</p>}
        {noBackup > 0 && <p className="mb-2 text-[11px] text-amber-200/80" data-testid="camp-no-backup-count">{noBackup} of {bookings.filter((b) => b.payment_status === 'paid').length} booked children have no backup contact. Tap a name to copy a link asking for one.</p>}
        {tickError && <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="camp-perday-error">{tickError}</p>}
        {names.length === 0 ? (
          <p className="py-2 text-xs text-white/40">{day.isAvailable ? 'No bookings yet for this day.' : 'Nobody can book this day.'}</p>
        ) : (
          <ul data-testid="camp-perday-list">
            {names.map((c) => {
              const key = `${c.id}:${day.dayId}`, isIn = !!ticks[key], open = openId === c.id, b = byId.get(c.id)
              const row = (label: string, value: React.ReactNode) => value ? <div className="flex gap-3 py-1"><dt className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-white/35">{label}</dt><dd className="min-w-0 flex-1 break-words text-[13px] text-white/85">{value}</dd></div> : null
              return (
                <li key={c.id} className="border-t border-white/[0.05] first:border-t-0">
                  <div className="flex items-center gap-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      disabled={saving === key || !day.isAvailable}
                      aria-pressed={isIn}
                      aria-label={isIn ? `${c.name} is ticked in. Tap to untick.` : `Tick ${c.name} in`}
                      data-testid="camp-perday-tick"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors disabled:opacity-50 ${
                        isIn ? 'border-emerald-400 bg-emerald-400 text-[#04141a]' : 'border-white/25 text-transparent hover:border-white/50'
                      }`}
                    >
                      ✓
                    </button>
                    <button type="button" onClick={() => setOpenId(open ? null : c.id)} aria-expanded={open} data-testid="camp-perday-name" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                      <span className="min-w-0">
                        <span className={`block truncate text-sm ${isIn ? 'text-white' : 'text-white/85'}`}>{c.name}</span>
                        {hasMedicalNote(b?.medical_info) && <span className="block truncate text-[11px] text-amber-300/90">Medical note</span>}
                        {b && outstanding(b.payment_status, b.amount_paid) && <span className="mt-0.5 inline-block rounded-md border border-red-500/50 bg-red-500/15 px-1.5 py-0.5 text-[11px] font-bold text-red-300" data-testid="camp-perday-outstanding">{outstanding(b.payment_status, b.amount_paid)}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {c.age != null && <span className="text-xs tabular-nums text-white/45" data-testid="camp-perday-age">{c.age}</span>}
                        <span className={`text-xs text-white/35 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                      </span>
                    </button>
                  </div>
                  {open && (
                    <dl className="mb-2.5 ml-10 rounded-lg border border-white/[0.07] bg-[#080e18] px-3 py-2" data-testid="camp-perday-details">
                      {!b ? <p className="py-1 text-xs text-white/50">No details found for this booking.</p> : <>
                        {row('Age', b.child_age != null ? String(b.child_age) : null)}
                        {row('Parent', b.parent_name)}
                        {row('Phone', b.parent_phone ? <a href={`tel:${b.parent_phone.replace(/\s+/g, '')}`} className="font-semibold text-[#4ecde6] underline-offset-2 hover:underline">{b.parent_phone}</a> : <span className="text-white/45">None given</span>)}
                        {row('Backup', b.backup_phone
                          ? <span data-testid="camp-perday-backup">{b.backup_name} · <a href={`tel:${b.backup_phone.replace(/\s+/g, '')}`} className="font-semibold text-[#4ecde6] underline-offset-2 hover:underline">{b.backup_phone}</a></span>
                          : <span data-testid="camp-perday-no-backup"><span className="text-amber-200/80">None given</span>{academySlug && <> · <button type="button" onClick={() => copyBackupLink(b.id)} className="font-semibold text-[#4ecde6] underline-offset-2 hover:underline" data-testid="camp-backup-copy-link">{copiedId === b.id ? 'Link copied' : 'Copy link to ask'}</button></>}</span>)}
                        {row('Email', b.parent_email ? <a href={`mailto:${b.parent_email}`} className="text-[#4ecde6] underline-offset-2 hover:underline">{b.parent_email}</a> : null)}
                        {row('Medical', hasMedicalNote(b.medical_info) ? <span className="text-amber-200">{b.medical_info}</span> : b.medical_info ? b.medical_info : <span className="text-amber-200/80">Not answered</span>)}
                        {row('Photos', b.photo_consent === true ? 'Yes, photos are fine' : b.photo_consent === false ? <span className="text-amber-200">No photos</span> : <span className="text-white/45">Not asked</span>)}
                        {row('Days', b.selected_day_labels?.length ? b.selected_day_labels.join(', ') : 'Every day')}
                        {row('Payment', b.payment_status === 'paid' ? `Paid${b.amount_paid ? ` £${Number(b.amount_paid).toFixed(2)}` : ''}` : <span className="text-amber-200">Not paid yet</span>)}
                      </>}
                    </dl>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
