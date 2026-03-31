'use client'

import { useState } from 'react'
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
  const router = useRouter()

  const bookingLink = orgSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${orgSlug}/camps/${campId}`
    : ''

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
      await supabase
        .from('camps')
        .update({ is_published: !isPublished })
        .eq('id', campId)
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
      const { data: camp } = await supabase
        .from('camps')
        .select('*')
        .eq('id', campId)
        .single()

      if (camp) {
        const { id: _id, created_at: _ca, ...rest } = camp
        await supabase.from('camps').insert({
          ...rest,
          name: campName + ' (Copy)',
          is_published: false,
        })
        router.refresh()
      }
    } finally {
      setDuplicating(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl py-1">
            {!isPublished && (
              <button
                onClick={handleTogglePublish}
                disabled={toggling}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
              >
                {toggling ? 'Publishing...' : 'Publish'}
              </button>
            )}
            {isPublished && (
              <button
                onClick={handleTogglePublish}
                disabled={toggling}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
              >
                {toggling ? 'Unpublishing...' : 'Unpublish'}
              </button>
            )}
            {orgSlug && (
              <button
                onClick={handleCopyLink}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
              >
                Copy Booking Link
              </button>
            )}
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
            >
              {duplicating ? 'Duplicating...' : 'Duplicate'}
            </button>
            {orgSlug && isPublished && (
              <a
                href={bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
                onClick={() => setOpen(false)}
              >
                View Booking Page
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
