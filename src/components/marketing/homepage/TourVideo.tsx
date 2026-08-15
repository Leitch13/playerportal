'use client'

import { useEffect, useState } from 'react'

// drop a YouTube/Loom embed URL or hosted mp4 here to go live
const TOUR_VIDEO_URL = ''

// Ghost "Watch the 2-minute tour" button for the cyan hero. Renders nothing
// until TOUR_VIDEO_URL is set, so the hero ships unchanged in the meantime.
// When set, opens a fullscreen modal with an <iframe> (YouTube / Loom / Vimeo)
// or a native <video> player for hosted mp4s.
export default function TourVideoButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!TOUR_VIDEO_URL) return null

  const isEmbed = /youtube|youtu\.be|loom|vimeo/i.test(TOUR_VIDEO_URL)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-white/40 text-white px-6 py-3.5 text-[15px] font-semibold hover:bg-white/10 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5-11-6.5z" />
        </svg>
        Watch the 2-minute tour
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Player Portal tour video"
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close video"
              className="absolute -top-12 right-0 w-10 h-10 rounded-full border border-white/30 text-white flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
              {isEmbed ? (
                <iframe
                  src={TOUR_VIDEO_URL}
                  title="Player Portal tour"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video
                  src={TOUR_VIDEO_URL}
                  controls
                  autoPlay
                  className="absolute inset-0 w-full h-full"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
