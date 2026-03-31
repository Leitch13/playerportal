'use client'

import { useRef, useCallback } from 'react'
import Link from 'next/link'

interface CertificateViewProps {
  awardId: string
  playerName: string
  awardLabel: string
  awardIcon: string
  notes: string | null
  termName: string | null
  date: string
  orgName: string
  orgLogoUrl: string | null
  orgColor: string
  awarderName: string | null
}

export default function CertificateView({
  awardId,
  playerName,
  awardLabel,
  awardIcon,
  notes,
  termName,
  date,
  orgName,
  orgLogoUrl,
  orgColor,
  awarderName,
}: CertificateViewProps) {
  const certRef = useRef<HTMLDivElement>(null)
  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/dashboard/awards/certificate/${awardId}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${awardLabel} - ${orgName}`,
          text: `${playerName} has been awarded "${awardLabel}" by ${orgName}!`,
          url,
        })
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }, [awardId, awardLabel, orgName, playerName])

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
      {/* Action buttons — hidden on print */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link
          href="/dashboard/awards"
          className="text-sm text-white/50 hover:text-white transition"
        >
          &larr; Back to Awards
        </Link>
        <div className="flex-1" />
        <button
          onClick={handleShare}
          className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white/70 hover:text-white transition"
        >
          Share
        </button>
        <button
          onClick={handlePrint}
          className="text-sm bg-white text-black font-semibold rounded-lg px-4 py-2 hover:bg-white/90 transition"
        >
          Print Certificate
        </button>
      </div>

      {/* Certificate — screen version (dark, premium) */}
      <div
        ref={certRef}
        className="certificate-container max-w-3xl mx-auto print:max-w-none"
      >
        {/* Screen version */}
        <div className="print:hidden relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a1a] via-[#141414] to-[#0f0f0f]">
          {/* Decorative gold border effect */}
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent" style={{ borderImage: `linear-gradient(135deg, ${orgColor}40, transparent, ${orgColor}20) 1` }} />

          {/* Corner ornaments */}
          <div className="absolute top-0 left-0 w-24 h-24 opacity-20" style={{ background: `radial-gradient(circle at 0 0, ${orgColor}, transparent 70%)` }} />
          <div className="absolute top-0 right-0 w-24 h-24 opacity-20" style={{ background: `radial-gradient(circle at 100% 0, ${orgColor}, transparent 70%)` }} />
          <div className="absolute bottom-0 left-0 w-24 h-24 opacity-20" style={{ background: `radial-gradient(circle at 0 100%, ${orgColor}, transparent 70%)` }} />
          <div className="absolute bottom-0 right-0 w-24 h-24 opacity-20" style={{ background: `radial-gradient(circle at 100% 100%, ${orgColor}, transparent 70%)` }} />

          <div className="relative p-8 sm:p-12 text-center">
            {/* Academy logo/name */}
            <div className="mb-6">
              {orgLogoUrl ? (
                <img src={orgLogoUrl} alt={orgName} className="h-16 mx-auto mb-3 object-contain" />
              ) : (
                <div className="text-xs tracking-[0.3em] uppercase font-semibold mb-2" style={{ color: orgColor }}>
                  {orgName}
                </div>
              )}
              <div className="flex items-center justify-center gap-4 mb-2">
                <div className="h-px flex-1 max-w-16" style={{ background: `linear-gradient(to right, transparent, ${orgColor}40)` }} />
                <span className="text-xs tracking-[0.2em] uppercase text-white/30">Certificate of Achievement</span>
                <div className="h-px flex-1 max-w-16" style={{ background: `linear-gradient(to left, transparent, ${orgColor}40)` }} />
              </div>
            </div>

            {/* Trophy icon */}
            <div className="text-7xl sm:text-8xl mb-6 drop-shadow-2xl" style={{ filter: `drop-shadow(0 0 20px ${orgColor}30)` }}>
              {awardIcon}
            </div>

            {/* Award name */}
            <h2 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: orgColor }}>
              {awardLabel}
            </h2>

            {/* Presented to */}
            <p className="text-sm text-white/40 mb-2 tracking-wide uppercase">Presented to</p>

            {/* Player name */}
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-6" style={{ fontFamily: 'Georgia, serif' }}>
              {playerName}
            </h1>

            {/* Notes */}
            {notes && (
              <div className="mb-6">
                <p className="text-sm text-white/40 mb-1 uppercase tracking-wide">For</p>
                <p className="text-base text-white/70 italic max-w-md mx-auto">
                  &ldquo;{notes}&rdquo;
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center justify-center gap-3 my-6">
              <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${orgColor}30)` }} />
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `${orgColor}40` }} />
              <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${orgColor}30)` }} />
            </div>

            {/* Date and term */}
            <div className="flex items-center justify-center gap-6 text-sm text-white/40 mb-8">
              {termName && <span>{termName}</span>}
              <span>{formattedDate}</span>
            </div>

            {/* Signature area */}
            <div className="flex items-end justify-center gap-12 mb-6">
              <div className="text-center">
                <div className="w-32 border-b border-white/20 mb-1" />
                <p className="text-xs text-white/30">{awarderName || 'Coach'}</p>
              </div>
              <div className="text-center">
                <div className="w-32 border-b border-white/20 mb-1" />
                <p className="text-xs text-white/30">{orgName}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-white/5">
              <p className="text-[10px] text-white/20 tracking-wide">Powered by Player Portal</p>
            </div>
          </div>
        </div>

        {/* Print version — white/formal */}
        <div className="hidden print:block">
          <style>{`
            @media print {
              @page { size: landscape; margin: 1.5cm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .has-bottom-nav { padding-bottom: 0 !important; }
              nav, header { display: none !important; }
              main { margin-left: 0 !important; }
            }
          `}</style>
          <div className="border-4 border-double border-amber-700 p-12 text-center bg-white text-black min-h-[60vh]">
            {/* Academy name */}
            <div className="mb-4">
              <h3 className="text-lg tracking-[0.3em] uppercase font-semibold text-amber-800">
                {orgName}
              </h3>
              <p className="text-xs tracking-[0.15em] uppercase text-gray-500 mt-1">Certificate of Achievement</p>
            </div>

            <div className="my-6 text-6xl">{awardIcon}</div>

            <h2 className="text-2xl font-bold text-amber-800 mb-4">{awardLabel}</h2>

            <p className="text-sm text-gray-500 mb-1 tracking-wide uppercase">Presented to</p>

            <h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
              {playerName}
            </h1>

            {notes && (
              <p className="text-sm text-gray-600 italic max-w-md mx-auto mb-4">
                &ldquo;{notes}&rdquo;
              </p>
            )}

            <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-8">
              {termName && <span>{termName}</span>}
              <span>{formattedDate}</span>
            </div>

            <div className="flex items-end justify-center gap-16 mb-6">
              <div className="text-center">
                <div className="w-40 border-b-2 border-gray-300 mb-1" />
                <p className="text-xs text-gray-500">{awarderName || 'Coach'}</p>
              </div>
              <div className="text-center">
                <div className="w-40 border-b-2 border-gray-300 mb-1" />
                <p className="text-xs text-gray-500">{orgName}</p>
              </div>
            </div>

            <div className="mt-8 pt-3 border-t border-gray-200">
              <p className="text-[9px] text-gray-400 tracking-wide">Powered by Player Portal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
