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

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { buildWhatsappUrl, WA_TEMPLATES } from '@/lib/whatsapp'

export interface CampRosterBooking {
  id: string
  child_name: string | null
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  parent_profile_id: string | null   // resolved server-side; null when anon
  medical_info: string | null
  amount_paid: number | null
  payment_status: string
  booking_source: string | null
  created_at: string
}

export default function RosterClient({
  campId,
  campName,
  academyName,
  bookings,
}: {
  campId: string
  campName: string
  academyName: string
  bookings: CampRosterBooking[]
}) {
  const [search, setSearch] = useState('')
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resentMap, setResentMap] = useState<Record<string, 'ok' | 'fail'>>({})

  // ─── Filtered view ───
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bookings
    return bookings.filter((b) => {
      const hay = [
        b.child_name || '',
        b.parent_name || '',
        b.parent_email || '',
        b.parent_phone || '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [search, bookings])

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
  function downloadCsv() {
    const headers = ['Child', 'Age', 'Parent', 'Email', 'Phone', 'Medical info', 'Booked at', 'Amount paid (£)', 'Payment status', 'Source']
    const rows = filtered.map((b) => [
      b.child_name || '',
      b.child_age != null ? String(b.child_age) : '',
      b.parent_name || '',
      b.parent_email || '',
      b.parent_phone || '',
      b.medical_info || '',
      b.created_at,
      (b.amount_paid != null ? Number(b.amount_paid).toFixed(2) : '0.00'),
      b.payment_status,
      b.booking_source === 'admin_created' ? 'Added by admin' : 'Online booking',
    ])
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
      setResentMap((m) => ({ ...m, [bookingId]: ok ? 'ok' : 'fail' }))
    } catch {
      setResentMap((m) => ({ ...m, [bookingId]: 'fail' }))
    }
    setResendingId(null)
  }

  return (
    <div className="space-y-3">
      {/* ─── TOOLBAR ─── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#141414] p-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" data-testid="camp-roster-toolbar">
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
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] text-white placeholder-white/30 focus:border-[#4ecde6] focus:outline-none"
            />
          </div>
        </div>

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
      <div className="rounded-xl border border-white/[0.08] bg-[#141414] overflow-hidden" data-testid="camp-roster">
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
            <div className="text-3xl mb-2">🏕️</div>
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
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Booked</th>
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
                      <td className="px-6 py-3 text-white font-medium">{b.child_name || '—'}</td>
                      <td className="px-3 py-3 text-white/70 text-xs">{b.child_age != null ? `${b.child_age}` : '—'}</td>
                      <td className="px-6 py-3 text-white/70">{b.parent_name || '—'}</td>
                      <td className="px-6 py-3 text-white/55 text-xs">
                        {b.parent_email && !b.parent_email.endsWith('@theplayerportal.net') && (
                          <div className="truncate max-w-[200px]">
                            <a href={`mailto:${b.parent_email}`} className="text-[#4ecde6] hover:underline">{b.parent_email}</a>
                          </div>
                        )}
                        {b.parent_phone && <div>{b.parent_phone}</div>}
                      </td>
                      <td className="px-3 py-3" data-testid="camp-roster-medical-cell">
                        {hasMedical ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 cursor-help"
                            data-testid="camp-roster-medical-badge"
                            title={b.medical_info as string}
                          >
                            ⚠ Medical
                          </span>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-white/55 text-xs">{fmtBookedAt(b.created_at)}</td>
                      <td className="px-6 py-3 text-right">
                        {Number(b.amount_paid || 0) > 0 ? (
                          <span className="text-emerald-400 font-semibold">£{Number(b.amount_paid).toFixed(2)}</span>
                        ) : (
                          <span className="text-white/30">£0.00</span>
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
                            disabled={resendingId === b.id || !b.parent_email || b.parent_email.endsWith('@theplayerportal.net')}
                            onClick={() => resendConfirmation(b.id)}
                            data-testid="camp-roster-row-resend"
                            title={resent === 'ok' ? 'Sent ✓' : resent === 'fail' ? 'Failed — retry' : 'Resend confirmation email'}
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
    pending:   { label: 'Pending',   cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
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
