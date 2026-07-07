'use client'

import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
// Camps Safe Edit — Phase 1A. The Edit entry point is rendered only when the
// server passes editEnabled (gated by CAMP_EDIT_ENABLED). OFF ⇒ this component
// renders exactly as before.
import CampEditForm from './CampEditForm'
// Flexible Camps (Phase 1) — publish-blocked guard so an admin can never
// flip a flexible camp to is_published=true from the row-action menu before
// Phase 2 lands the parent booking flow.
import {
  isFlexibleModePublishBlocked,
  FLEXIBLE_CAMPS_PUBLISH_BLOCKED_MESSAGE,
} from '@/lib/flexible-camps'

type EditableCamp = {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  daily_start_time: string | null
  daily_end_time: string | null
  location: string | null
  age_group: string | null
  price: number | null
  max_capacity: number | null
  image_url: string | null
  what_to_bring: string | null
  is_published: boolean
  early_bird_price: number | null
  sibling_discount_enabled: boolean
  sibling_discount_percent: number | null
  training_group_id: string | null
  // Phase 2A — additive structural editing reads the schedule jsonb.
  schedule: { day: string; date: string; activities: string[] }[] | null
  // Flexible Camps (Phase 1) — forwarded to CampEditForm so it can lock
  // publishing for flexible drafts.
  booking_mode?: string | null
}

type Props = {
  campId: string
  campName: string
  isPublished: boolean
  orgSlug: string
  // Phase 1A safe-edit wiring (all optional ⇒ flag-OFF renders unchanged).
  editEnabled?: boolean
  camp?: EditableCamp
  bookedCount?: number
  trainingGroups?: { id: string; name: string }[]
  // Phase 2A — structural-edit sub-gate (passed through to CampEditForm).
  structuralEnabled?: boolean
  // Flexible Camps (Phase 1). When 'flexible_days', publishing is blocked
  // until the parent booking flow ships. Optional so existing whole-camp
  // rows render exactly as before (undefined ⇒ treated as whole-camp).
  bookingMode?: string | null
}

export default function CampActions({ campId, campName, isPublished, orgSlug, editEnabled, camp, bookedCount, trainingGroups, structuralEnabled, bookingMode }: Props) {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const canEdit = !!editEnabled && !!camp
  const [toggling, setToggling] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  const bookingLink = orgSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${orgSlug}/camps/${campId}`
    : ''

  // Position the portal menu just under the button, anchored to its right edge.
  // Rendering in a portal escapes the table's overflow-x-auto (which was
  // clipping the menu and making it impossible to click).
  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
  }, [open])

  const handleCopyLink = async () => {
    if (bookingLink) {
      await navigator.clipboard.writeText(bookingLink)
      alert('Booking link copied!')
    }
    setOpen(false)
  }

  // Flexible-camp publish guard. Blocks the transition from
  // unpublished → published for flexible camps. Unpublishing is always
  // permitted (defensive: lets an admin retract a mis-flagged row).
  const publishBlocked = !isPublished && isFlexibleModePublishBlocked(bookingMode)

  const handleTogglePublish = async () => {
    if (publishBlocked) {
      alert(FLEXIBLE_CAMPS_PUBLISH_BLOCKED_MESSAGE)
      setOpen(false)
      return
    }
    setToggling(true)
    try {
      const supabase = createClient()
      await supabase.from('camps').update({ is_published: !isPublished }).eq('id', campId)
      router.refresh()
    } finally {
      setToggling(false)
      setOpen(false)
    }
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const supabase = createClient()
      const { data: camp } = await supabase.from('camps').select('*').eq('id', campId).single()
      if (camp) {
        const { id: _id, created_at: _ca, ...rest } = camp
        await supabase.from('camps').insert({ ...rest, name: campName + ' (Copy)', is_published: false })
        router.refresh()
      }
    } finally {
      setDuplicating(false)
      setOpen(false)
    }
  }

  const menuItem = 'w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors'

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Camp actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[101] w-48 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-2xl py-1"
            style={{ top: coords.top, right: coords.right }}
          >
            {/* Sprint 9 — View roster (admin per-camp page) */}
            <Link href={`/dashboard/camps/${campId}`} className={menuItem} onClick={() => setOpen(false)}>
              View roster
            </Link>
            {/* Camps Safe Edit — Phase 1A. Flag-gated edit entry. */}
            {canEdit && (
              <button onClick={() => { setOpen(false); setEditOpen(true) }} className={menuItem}>
                Edit details
              </button>
            )}
            <button
              onClick={handleTogglePublish}
              disabled={toggling || publishBlocked}
              className={menuItem}
              title={publishBlocked ? FLEXIBLE_CAMPS_PUBLISH_BLOCKED_MESSAGE : undefined}
            >
              {isPublished
                ? (toggling ? 'Unpublishing...' : 'Unpublish')
                : (toggling ? 'Publishing...' : publishBlocked ? 'Publish (locked)' : 'Publish')}
            </button>
            {publishBlocked && (
              <p className="px-4 pb-2 text-[10px] text-amber-300/80 leading-snug">
                Flexible Days camps can&apos;t publish until parent booking is released.
              </p>
            )}
            {orgSlug && (
              <button onClick={handleCopyLink} className={menuItem}>Copy Booking Link</button>
            )}
            <button onClick={handleDuplicate} disabled={duplicating} className={menuItem}>
              {duplicating ? 'Duplicating...' : 'Duplicate'}
            </button>
            {orgSlug && isPublished && (
              <a
                href={bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`block ${menuItem}`}
                onClick={() => setOpen(false)}
              >
                View Booking Page
              </a>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Camps Safe Edit — Phase 1A. Lean edit modal, safe fields only. */}
      {canEdit && editOpen && camp && (
        <CampEditForm
          camp={camp}
          bookedCount={bookedCount || 0}
          trainingGroups={trainingGroups || []}
          onClose={() => setEditOpen(false)}
          structuralEnabled={!!structuralEnabled}
        />
      )}
    </>
  )
}
