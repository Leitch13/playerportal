/**
 * Sprint 8a — class roster row.
 *
 * One row per active enrolment in this class. Kebab menu hosts the three
 * approved actions:
 *
 *   1. View player profile  — existing /dashboard/players/[id]
 *   2. Message parent       — deep-link to /dashboard/messages?recipients=<parent_profile_id>
 *                             (the existing validated deep-link contract;
 *                             messages page already pre-populates the
 *                             BulkMessageForm from this param)
 *   3. Remove from class    — UPDATE enrolments.status = 'cancelled' on
 *                             ONE enrolment row. Player record, subscription,
 *                             history, photo, FK chains all untouched.
 *
 * Out of scope (per approval): Move Class, Archive Player, anything that
 * touches subscriptions / Stripe / capacity RPCs.
 *
 * Race + waitlist semantics: when an active → cancelled transition opens
 * a seat, we fire-and-forget /api/waitlist/promote — the same call the
 * existing EnrolmentStatusToggle makes. This keeps Sprint 8a behaviour
 * identical to the existing enrolment-cancel path; we are NOT changing
 * how cancellations propagate, only WHERE the admin can perform one.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
// Sprint 8b v1 — Move Player modal. Shared with the player-profile
// Actions menu; takes care of capacity / future-date / parent notify
// against the new /api/enrolments/move endpoint.
import MovePlayerModal from '@/components/MovePlayerModal'

export interface ClassRosterRowProps {
  enrolmentId: string
  playerId: string
  playerFirstName: string
  playerLastName: string
  playerPhotoUrl: string | null
  parentId: string | null
  parentName: string | null
  className: string
  /** Total active enrolments for this player across all classes — gives the
   *  admin context in the confirmation dialog. */
  otherActiveClasses: number
  // Sprint 8b v1 — surfaces the source class id + org id to the Move modal.
  groupId: string
  organisationId: string
}

export default function ClassRosterRow({
  enrolmentId,
  playerId,
  playerFirstName,
  playerLastName,
  playerPhotoUrl,
  parentId,
  parentName,
  className,
  otherActiveClasses,
  groupId,
  organisationId,
}: ClassRosterRowProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    const supabase = createClient()

    // Mirror the existing EnrolmentStatusToggle pattern exactly: read the
    // group_id first so we know which class to promote a waitlist seat in
    // after cancellation.
    const { data: enrolment, error: readErr } = await supabase
      .from('enrolments')
      .select('group_id, status')
      .eq('id', enrolmentId)
      .single()

    if (readErr) {
      setError(readErr.message)
      setRemoving(false)
      return
    }

    const { error: updErr } = await supabase
      .from('enrolments')
      .update({ status: 'cancelled' })
      .eq('id', enrolmentId)

    if (updErr) {
      setError(updErr.message)
      setRemoving(false)
      return
    }

    // Waitlist auto-promote — same fire-and-forget as EnrolmentStatusToggle.
    // Failure here must NOT block the cancel UX; the cron also catches it.
    const seatVacated = enrolment?.status === 'active' && enrolment?.group_id
    if (seatVacated) {
      try {
        await fetch('/api/waitlist/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: enrolment.group_id }),
        })
      } catch {
        // intentionally swallowed
      }
    }

    setConfirmOpen(false)
    setMenuOpen(false)
    setRemoving(false)
    router.refresh()
  }

  const initials = `${playerFirstName?.[0] || ''}${playerLastName?.[0] || ''}`.toUpperCase()
  const messageHref = parentId
    ? `/dashboard/messages?recipients=${encodeURIComponent(parentId)}`
    : null

  return (
    <>
      <div
        data-testid="class-roster-row"
        data-enrolment-id={enrolmentId}
        className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-3 hover:bg-[#1a1a1a] hover:border-[#4ecde6]/30 transition-all group"
      >
        {/* Photo or initials. Stays as a link to the profile so the existing
            click-through behaviour is preserved as the default action. */}
        <Link href={`/dashboard/players/${playerId}`} className="shrink-0">
          {playerPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={playerPhotoUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover border border-[#1e1e1e]"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-xs font-bold text-[#4ecde6]">
              {initials || '?'}
            </div>
          )}
        </Link>

        {/* Name + parent line. Name stays clickable to the profile. */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/players/${playerId}`}
            className="block text-sm font-semibold truncate group-hover:text-[#4ecde6] transition-colors"
          >
            {playerFirstName} {playerLastName}
          </Link>
          {parentName && (
            <div className="text-[11px] text-white/40 truncate">Parent: {parentName}</div>
          )}
        </div>

        {/* Kebab menu — same visual language as the GroupCard kebab. */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            data-testid="roster-row-kebab"
            aria-label={`Actions for ${playerFirstName} ${playerLastName}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {menuOpen && (
            <div
              data-testid="roster-row-menu"
              className="absolute right-0 top-9 z-20 w-52 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl py-1 text-sm"
            >
              <Link
                href={`/dashboard/players/${playerId}`}
                onClick={() => setMenuOpen(false)}
                data-testid="roster-action-view-player"
                className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/80 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View player profile
              </Link>

              {messageHref ? (
                <Link
                  href={messageHref}
                  onClick={() => setMenuOpen(false)}
                  data-testid="roster-action-message-parent"
                  className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/80 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.36-3.18A8.94 8.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Message parent
                </Link>
              ) : (
                <div
                  data-testid="roster-action-message-parent-disabled"
                  className="w-full text-left px-3 py-2 text-white/30 flex items-center gap-2 cursor-not-allowed"
                  title="No parent on file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.36-3.18A8.94 8.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Message parent
                </div>
              )}

              <div className="h-px bg-white/5 my-1" />

              {/* Sprint 8b v1 — Move Class action. Opens the shared
                  MovePlayerModal anchored to this enrolment. */}
              <button
                type="button"
                onClick={() => { setMoveOpen(true); setMenuOpen(false) }}
                data-testid="roster-action-move-class"
                className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/80 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                Move to another class
              </button>

              <button
                type="button"
                onClick={() => { setConfirmOpen(true); setMenuOpen(false) }}
                data-testid="roster-action-remove-from-class"
                className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19l-7-7m0 0l7-7m-7 7h14" />
                </svg>
                Remove from this class
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal — focused, scoped, explicitly says what is and
          isn't affected so the admin doesn't conflate this with Delete Player. */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="roster-remove-confirm"
          onClick={() => !removing && setConfirmOpen(false)}
        >
          <div
            className="bg-[#141414] border border-[#1e1e1e] rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-white">
                Remove {playerFirstName} {playerLastName} from {className}?
              </h3>
              <p className="text-sm text-white/65 mt-2">
                {playerFirstName} will be removed from this class register and schedule.
                Their player profile, attendance history, awards and progress
                reviews are all preserved.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-xs text-white/60 space-y-1">
              <p>
                <span className="text-white/80 font-semibold">Subscription:</span>{' '}
                Not affected — the parent will continue to be billed as before.
                Manage their subscription separately if needed.
              </p>
              {otherActiveClasses > 0 && (
                <p>
                  <span className="text-white/80 font-semibold">Other classes:</span>{' '}
                  {playerFirstName} is in {otherActiveClasses} other active class{otherActiveClasses === 1 ? '' : 'es'} — those stay unchanged.
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                data-testid="roster-remove-confirm-button"
                className="flex-1 px-4 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
              >
                {removing ? 'Removing…' : 'Remove from class'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={removing}
                className="px-4 py-2.5 text-sm font-bold rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint 8b v1 — Move Player modal. Stays mounted only while open. */}
      <MovePlayerModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        sourceEnrolmentId={enrolmentId}
        sourceGroupId={groupId}
        sourceGroupName={className}
        playerId={playerId}
        playerFirstName={playerFirstName}
        playerLastName={playerLastName}
        organisationId={organisationId}
      />
    </>
  )
}
