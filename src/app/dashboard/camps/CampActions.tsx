'use client'

import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  campId: string
  campName: string
  isPublished: boolean
  orgSlug: string
}

export default function CampActions({ campId, campName, isPublished, orgSlug }: Props) {
  const [open, setOpen] = useState(false)
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

  const handleTogglePublish = async () => {
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
            <button onClick={handleTogglePublish} disabled={toggling} className={menuItem}>
              {isPublished
                ? (toggling ? 'Unpublishing...' : 'Unpublish')
                : (toggling ? 'Publishing...' : 'Publish')}
            </button>
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
    </>
  )
}
