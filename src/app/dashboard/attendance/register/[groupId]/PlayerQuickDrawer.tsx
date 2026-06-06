/**
 * Sprint 11b — Player Quick Drawer.
 *
 * Pitch-side quick-view for the Live Register. Opens when a coach taps
 * a player row; closes on ESC, backdrop tap, X button, or after Mark
 * Present / Mark Absent so the coach immediately sees the row flip on
 * the register.
 *
 * Renders five stacked blocks in fixed safety-first order:
 *   1. Identity      (photo · name · age · class · enrolment pill)
 *   2. Medical/Safety  ← red top block, always rendered even when empty
 *   3. Attendance    (state · streak · last-attended · 8-dot history)
 *   4. Parent Contact (name · phone · email · WA/Call/Email/Message)
 *   5. Membership    (read-only status pill — never billing actions)
 *
 * Reuses:
 *   • deriveSubscriptionDisplay() from src/lib/subscription-derive.ts
 *   • buildWhatsappUrl()           from src/lib/whatsapp.ts
 *
 * Lazily fetches the extra data (parent profile, latest subscription,
 * source enrolment, last 8 attendance rows) on first open per player,
 * then caches in component state. No N+1 chatter on registers with
 * many players.
 *
 * Out of scope (per spec): Move Player, Archive, billing actions,
 * plan changes, subscription controls.
 */
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { buildWhatsappUrl } from '@/lib/whatsapp'
import { deriveSubscriptionDisplay, type SubscriptionInput, type Tone } from '@/lib/subscription-derive'
import type { LiveRegisterPlayer } from './LiveRegisterClient'

export type DrawerAttendanceState = 'present' | 'absent' | 'unmarked'

export interface PlayerQuickDrawerProps {
  player: LiveRegisterPlayer | null     // null = closed
  groupId: string
  groupName: string
  organisationId: string
  /** Current attendance state for this player on this session date. */
  attendance: DrawerAttendanceState
  /** Flip the register state. Called from inside the drawer. */
  onMark: (state: 'present' | 'absent') => void
  onClose: () => void
}

interface DrawerExtras {
  loaded: boolean
  parent: { full_name: string | null; email: string | null; phone: string | null } | null
  enrolment: { status: string | null; is_trial: boolean | null; trial_expires_at: string | null; activates_on: string | null } | null
  subscription: SubscriptionInput | null
  recentAttendance: Array<{ session_date: string; present: boolean }>
}

const EMPTY_EXTRAS: DrawerExtras = {
  loaded: false,
  parent: null,
  enrolment: null,
  subscription: null,
  recentAttendance: [],
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

function fmtNiceDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const TONE_TO_CLASSES: Record<Tone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  amber:   'bg-amber-500/15 text-amber-300 border-amber-500/35',
  red:     'bg-red-500/15 text-red-300 border-red-500/35',
  violet:  'bg-violet-500/15 text-violet-300 border-violet-500/35',
  muted:   'bg-white/[0.06] text-white/55 border-white/[0.10]',
}

export default function PlayerQuickDrawer({
  player,
  groupId,
  groupName,
  organisationId,
  attendance,
  onMark,
  onClose,
}: PlayerQuickDrawerProps) {
  const open = !!player
  const playerId = player?.id ?? null

  // Per-player cache so re-opening the same drawer is instant.
  const [cache, setCache] = useState<Map<string, DrawerExtras>>(new Map())
  const extras = playerId ? cache.get(playerId) ?? EMPTY_EXTRAS : EMPTY_EXTRAS

  // ─── ESC key closes ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // ─── Body scroll lock while open ─────────────────────────────────
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // ─── Lazy fetch on first open per player ─────────────────────────
  useEffect(() => {
    if (!playerId || !player) return
    if (cache.has(playerId)) return
    let cancelled = false
    // Capture into a const so the async closure has a guaranteed-string
    // value rather than the outer (string | null) narrowed variable.
    const pid: string = playerId
    const parentId = player.parent_id
    const supabase = createClient()

    async function loadAll() {
      // Parent profile
      const parentReq = parentId
        ? supabase
            .from('profiles')
            .select('full_name, email, phone')
            .eq('id', parentId)
            .single()
        : Promise.resolve({ data: null } as { data: null })

      // Source enrolment (for this register's group)
      const enrolmentReq = supabase
        .from('enrolments')
        .select('status, is_trial, trial_expires_at, activates_on')
        .eq('player_id', pid)
        .eq('group_id', groupId)
        .maybeSingle()

      // Most recent subscription for this player (any status — we just
      // want to surface the most signal-rich pill). Tie-break by created_at
      // desc; deriveSubscriptionDisplay handles every status sensibly.
      const subscriptionReq = supabase
        .from('subscriptions')
        .select('status, cancel_at_period_end, cancelled_at, current_period_end, start_date, created_at')
        .eq('player_id', pid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Last 8 attendance rows across ALL groups for this player —
      // matches the player-profile streak widget (Sprint M5).
      const attendanceReq = supabase
        .from('attendance')
        .select('session_date, present')
        .eq('player_id', pid)
        .order('session_date', { ascending: false })
        .limit(8)

      const [parentR, enrolR, subR, attR] = await Promise.all([parentReq, enrolmentReq, subscriptionReq, attendanceReq])
      if (cancelled) return

      const next: DrawerExtras = {
        loaded: true,
        parent: parentR.data ? {
          full_name: (parentR.data.full_name as string | null) ?? null,
          email: (parentR.data.email as string | null) ?? null,
          phone: (parentR.data.phone as string | null) ?? null,
        } : null,
        enrolment: enrolR.data ? {
          status: (enrolR.data.status as string | null) ?? null,
          is_trial: (enrolR.data.is_trial as boolean | null) ?? null,
          trial_expires_at: (enrolR.data.trial_expires_at as string | null) ?? null,
          activates_on: (enrolR.data.activates_on as string | null) ?? null,
        } : null,
        subscription: subR.data ? {
          status: (subR.data.status as string | null) ?? null,
          cancel_at_period_end: (subR.data.cancel_at_period_end as boolean | null) ?? null,
          cancelled_at: (subR.data.cancelled_at as string | null) ?? null,
          current_period_end: (subR.data.current_period_end as string | null) ?? null,
          start_date: (subR.data.start_date as string | null) ?? null,
        } : null,
        recentAttendance: (attR.data || []).map((r) => ({
          session_date: r.session_date as string,
          present: !!r.present,
        })),
      }
      setCache((m) => {
        const copy = new Map(m)
        copy.set(pid, next)
        return copy
      })
    }

    void loadAll()
    return () => { cancelled = true }
  }, [playerId, player, cache, groupId])

  // ─── Derived display values ──────────────────────────────────────
  const age = useMemo(() => player ? ageFromDob(player.date_of_birth) : null, [player])
  const initials = useMemo(() => player ? `${player.first_name?.[0] || ''}${player.last_name?.[0] || ''}`.toUpperCase() : '', [player])
  const hasMedical = !!(player?.medical_info && player.medical_info.trim())

  // Streak = consecutive 'present' from the most recent backward.
  // last_attended = first present row in chronological-newest order.
  const streak = useMemo(() => {
    let s = 0
    for (const row of extras.recentAttendance) {
      if (row.present) s++
      else break
    }
    return s
  }, [extras.recentAttendance])
  const lastAttended = useMemo(() => {
    const row = extras.recentAttendance.find((r) => r.present)
    return row?.session_date ?? null
  }, [extras.recentAttendance])

  // Enrolment pill (Sprint 12 derive layer would normally do this; the
  // shape we have is enough to build a one-line label here without
  // duplicating logic.)
  const enrolmentPill: { label: string; tone: Tone } = useMemo(() => {
    const e = extras.enrolment
    if (!e || !e.status) return { label: 'Active', tone: 'emerald' }
    const s = e.status.toLowerCase()
    if (s === 'cancelled') return { label: 'Cancelled', tone: 'muted' }
    if (s === 'pending') return { label: e.activates_on ? `Starts ${fmtNiceDate(e.activates_on)}` : 'Pending', tone: 'amber' }
    if (e.is_trial) {
      return {
        label: e.trial_expires_at ? `Trial · ends ${fmtNiceDate(e.trial_expires_at)}` : 'Trial',
        tone: 'amber',
      }
    }
    return { label: 'Active', tone: 'emerald' }
  }, [extras.enrolment])

  const membership = extras.subscription
    ? deriveSubscriptionDisplay(extras.subscription)
    : { label: 'No subscription on file', tone: 'muted' as Tone, detail: '' }

  // ─── Parent action targets ───────────────────────────────────────
  const parentPhone = extras.parent?.phone || null
  const parentEmail = extras.parent?.email || null
  const waUrl = useMemo(() => buildWhatsappUrl(parentPhone), [parentPhone])

  // ─── Swipe-to-close (mobile only — we still get tap-outside / ESC) ─
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragDelta = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null
    dragDelta.current = 0
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return
    const dy = (e.touches[0]?.clientY ?? 0) - dragStartY.current
    if (dy > 0 && sheetRef.current) {
      dragDelta.current = dy
      sheetRef.current.style.transform = `translateY(${dy}px)`
    }
  }
  const onTouchEnd = () => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = ''
      if (dragDelta.current > 110) onClose()
    }
    dragStartY.current = null
    dragDelta.current = 0
  }

  // ─── Mark + close shortcut ───────────────────────────────────────
  const markAndClose = useCallback((s: 'present' | 'absent') => {
    onMark(s)
    onClose()
  }, [onMark, onClose])

  if (!open || !player) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-drawer-title"
      data-testid="player-quick-drawer"
      data-player-id={player.id}
      className="fixed inset-0 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Sheet wrapper — bottom sheet on mobile, right slide-in on tablet+ */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="absolute inset-x-0 bottom-0 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-[440px] sm:max-w-[90vw] flex flex-col overflow-hidden bg-[#0f0f0f] border-t border-white/[0.06] sm:border-t-0 sm:border-l shadow-2xl rounded-t-2xl sm:rounded-none max-h-[88vh] sm:max-h-none"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-2 flex justify-center" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header — close button */}
        <div className="px-5 pt-3 pb-2 flex items-start justify-between gap-3">
          <p id="player-drawer-title" className="sr-only">{player.first_name} {player.last_name} — quick view</p>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Quick view</div>
          <button
            type="button"
            onClick={onClose}
            data-testid="player-quick-drawer-close"
            aria-label="Close player quick view"
            className="text-white/40 hover:text-white text-2xl leading-none px-2 -mt-1"
          >
            ×
          </button>
        </div>

        {/* Scroll area */}
        <div className="overflow-y-auto flex-1 px-5 pb-6 pt-1 space-y-4">
          {/* ─── 1 · Identity ─── */}
          <section data-testid="player-drawer-identity" className="flex items-start gap-3">
            {player.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/[0.08] shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#4ecde6]/12 border border-[#4ecde6]/25 text-[#4ecde6] flex items-center justify-center text-lg font-extrabold shrink-0">
                {initials || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-white tracking-tight leading-tight truncate">
                {player.first_name} {player.last_name}
              </h2>
              <div className="text-[12px] text-white/55 mt-0.5 flex flex-wrap gap-1.5">
                {age != null && <span>age {age}</span>}
                {age != null && <span aria-hidden>·</span>}
                <span className="truncate">{groupName}</span>
              </div>
              <span
                data-testid="player-drawer-enrolment-pill"
                className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${TONE_TO_CLASSES[enrolmentPill.tone]}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
                {enrolmentPill.label}
              </span>
            </div>
          </section>

          {/* ─── 2 · Medical & Safety (always rendered, even when empty) ─── */}
          <section
            data-testid="player-drawer-medical"
            data-has-medical={hasMedical ? 'true' : 'false'}
            className={hasMedical
              ? 'rounded-xl border border-red-500/35 bg-red-500/[0.06] p-4 space-y-2.5'
              : 'rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2.5'
            }
          >
            <div className={`text-[10px] font-extrabold uppercase tracking-[0.2em] ${hasMedical ? 'text-red-300' : 'text-white/45'}`}>
              {hasMedical ? '⚠ Medical & Safety' : 'Medical & Safety'}
            </div>
            {hasMedical ? (
              <p className="text-sm text-white whitespace-pre-line leading-snug">{player.medical_info}</p>
            ) : (
              <p className="text-sm text-white/55">No medical notes on file</p>
            )}
            {(player.emergency_contact_name || player.emergency_contact_phone) && (
              <div className="pt-2 border-t border-white/[0.06] space-y-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-bold">🚨 Emergency contact</div>
                <div className="text-sm">
                  {player.emergency_contact_name && <span className="text-white">{player.emergency_contact_name}</span>}
                  {player.emergency_contact_name && player.emergency_contact_phone && <span className="text-white/40"> · </span>}
                  {player.emergency_contact_phone && (
                    <a
                      href={`tel:${player.emergency_contact_phone}`}
                      data-testid="player-drawer-emergency-tel"
                      className="text-[#4ecde6] hover:underline font-semibold"
                    >
                      {player.emergency_contact_phone}
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ─── 3 · Attendance ─── */}
          <section
            data-testid="player-drawer-attendance"
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">Today</div>
              <span
                data-testid="player-drawer-state"
                className={`text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                  attendance === 'present' ? TONE_TO_CLASSES.emerald
                  : attendance === 'absent' ? TONE_TO_CLASSES.red
                  : TONE_TO_CLASSES.muted
                }`}
              >
                {attendance === 'present' ? '✓ Present' : attendance === 'absent' ? '✗ Absent' : '◯ Unmarked'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => markAndClose('present')}
                data-testid="player-drawer-mark-present"
                className={`py-3 rounded-lg font-extrabold text-sm transition-colors border ${
                  attendance === 'present'
                    ? 'bg-emerald-500 text-[#0a0a0a] border-emerald-500'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/20'
                }`}
              >
                Mark present
              </button>
              <button
                type="button"
                onClick={() => markAndClose('absent')}
                data-testid="player-drawer-mark-absent"
                className={`py-3 rounded-lg font-extrabold text-sm transition-colors border ${
                  attendance === 'absent'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-red-500/10 text-red-300 border-red-500/35 hover:bg-red-500/20'
                }`}
              >
                Mark absent
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-white/60">
              <span data-testid="player-drawer-streak">
                <span className="text-white/40">Streak:</span>{' '}
                <span className="text-white font-semibold">{streak}</span> session{streak === 1 ? '' : 's'}
              </span>
              <span data-testid="player-drawer-last-attended">
                <span className="text-white/40">Last attended:</span>{' '}
                <span className="text-white/85">{lastAttended ? fmtNiceDate(lastAttended) : '—'}</span>
              </span>
            </div>
            {extras.loaded && (
              <div className="flex items-center gap-1.5" data-testid="player-drawer-recent">
                {extras.recentAttendance.length === 0 ? (
                  <span className="text-[11px] text-white/40">No recent sessions</span>
                ) : (
                  // Render oldest-left → newest-right for natural reading.
                  [...extras.recentAttendance].reverse().map((r, i) => (
                    <span
                      key={`${r.session_date}-${i}`}
                      title={`${r.present ? 'Present' : 'Absent'} · ${fmtNiceDate(r.session_date)}`}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        r.present ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {r.present ? '✓' : '✗'}
                    </span>
                  ))
                )}
              </div>
            )}
          </section>

          {/* ─── 4 · Parent Contact ─── */}
          <section
            data-testid="player-drawer-parent"
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">Parent</div>
            {!extras.loaded ? (
              <p className="text-sm text-white/40">Loading…</p>
            ) : extras.parent ? (
              <div className="space-y-1.5">
                {extras.parent.full_name && (
                  <p className="text-sm font-semibold text-white">{extras.parent.full_name}</p>
                )}
                {parentEmail && (
                  <p className="text-[13px] text-white/65 break-all">{parentEmail}</p>
                )}
                {parentPhone && (
                  <p className="text-[13px] text-white/65">{parentPhone}</p>
                )}
                {!parentEmail && !parentPhone && (
                  <p className="text-sm text-white/50">No contact details on file.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/55">No parent on file.</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {/* WhatsApp */}
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="player-drawer-whatsapp"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] text-sm font-bold transition-colors"
                >
                  💬 WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  data-testid="player-drawer-whatsapp-disabled"
                  title="No phone on file"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/30 text-sm font-bold cursor-not-allowed"
                >
                  💬 WhatsApp
                </button>
              )}
              {/* Call */}
              {parentPhone ? (
                <a
                  href={`tel:${parentPhone}`}
                  data-testid="player-drawer-call"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#4ecde6]/10 hover:bg-[#4ecde6]/20 border border-[#4ecde6]/30 text-[#4ecde6] text-sm font-bold transition-colors"
                >
                  📞 Call
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  data-testid="player-drawer-call-disabled"
                  title="No phone on file"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/30 text-sm font-bold cursor-not-allowed"
                >
                  📞 Call
                </button>
              )}
              {/* Email */}
              {parentEmail ? (
                <a
                  href={`mailto:${parentEmail}?subject=${encodeURIComponent(`About ${player.first_name} ${player.last_name}`)}`}
                  data-testid="player-drawer-email"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.10] text-white/85 text-sm font-bold transition-colors"
                >
                  ✉ Email
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  data-testid="player-drawer-email-disabled"
                  title="No email on file"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/30 text-sm font-bold cursor-not-allowed"
                >
                  ✉ Email
                </button>
              )}
              {/* Message — existing messaging deep-link */}
              {player.parent_id ? (
                <Link
                  href={`/dashboard/messages?recipients=${encodeURIComponent(player.parent_id)}`}
                  data-testid="player-drawer-message"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.10] text-white/85 text-sm font-bold transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 Message
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  data-testid="player-drawer-message-disabled"
                  title="No parent on file"
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/30 text-sm font-bold cursor-not-allowed"
                >
                  💬 Message
                </button>
              )}
            </div>
          </section>

          {/* ─── 5 · Membership (read-only) ─── */}
          <section
            data-testid="player-drawer-membership"
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-center justify-between gap-3"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">Membership</div>
            <div className="text-right">
              <span
                data-testid="player-drawer-membership-pill"
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${TONE_TO_CLASSES[membership.tone]}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
                {membership.label}
              </span>
              {membership.detail && (
                <div className="text-[10px] text-white/45 mt-1">{membership.detail}</div>
              )}
            </div>
          </section>

          {/* ─── Open full profile ─── */}
          <div className="pt-1">
            <Link
              href={`/dashboard/players/${player.id}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="player-drawer-open-profile"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4ecde6] hover:text-[#6dd8ee]"
            >
              Open full player profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
