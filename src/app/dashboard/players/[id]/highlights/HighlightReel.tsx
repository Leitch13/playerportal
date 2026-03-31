'use client'

import { useRef, useState, useCallback } from 'react'
import { toPng } from 'html-to-image'

type Format = 'square' | 'story'

interface HighlightData {
  playerName: string
  playerPhotoUrl: string | null
  playerInitials: string
  monthLabel: string
  sessionsAttended: number
  totalSessions: number
  attendanceRate: number
  currentStreak: number
  starSkill: { label: string; score: number } | null
  coachQuote: string | null
  coachName: string | null
  achievements: { name: string; emoji: string }[]
  academyName: string
  academyLogoUrl: string | null
  brandColor: string
  bookingUrl: string
  shareUrl: string
}

export default function HighlightReel({ data }: { data: HighlightData }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [format, setFormat] = useState<Format>('story')
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  const isStory = format === 'story'

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.download = `${data.playerName.replace(/\s+/g, '-')}-highlights-${format}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to download image:', err)
    } finally {
      setDownloading(false)
    }
  }, [data.playerName, format])

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'highlights.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${data.playerName} - ${data.monthLabel} Highlights`,
          text: `Check out ${data.playerName}'s monthly highlights!`,
          files: [file],
        })
      } else if (navigator.share) {
        await navigator.share({
          title: `${data.playerName} - ${data.monthLabel} Highlights`,
          text: `Check out ${data.playerName}'s monthly highlights!`,
          url: data.shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(data.shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err)
      }
    }
  }, [data.playerName, data.monthLabel, data.shareUrl])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }, [data.shareUrl])

  // Truncate coach quote to fit card
  const truncatedQuote = data.coachQuote
    ? data.coachQuote.length > 120
      ? data.coachQuote.substring(0, 117) + '...'
      : data.coachQuote
    : null

  return (
    <div className="space-y-6">
      {/* Format Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/60">Format:</span>
        <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
          <button
            onClick={() => setFormat('story')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              format === 'story'
                ? 'bg-white/10 text-white'
                : 'bg-white/[0.03] text-white/50 hover:text-white/80'
            }`}
          >
            Story (9:16)
          </button>
          <button
            onClick={() => setFormat('square')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              format === 'square'
                ? 'bg-white/10 text-white'
                : 'bg-white/[0.03] text-white/50 hover:text-white/80'
            }`}
          >
            Square (1:1)
          </button>
        </div>
      </div>

      {/* Card Preview — centered */}
      <div className="flex justify-center">
        <div
          ref={cardRef}
          style={{
            width: isStory ? 420 : 420,
            height: isStory ? 746 : 420,
            background: `linear-gradient(145deg, #0a0a0a 0%, #111111 40%, ${data.brandColor}15 100%)`,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 24,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Decorative gradient orb */}
          <div
            style={{
              position: 'absolute',
              top: isStory ? -80 : -60,
              right: isStory ? -60 : -40,
              width: isStory ? 280 : 200,
              height: isStory ? 280 : 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${data.brandColor}30, transparent 70%)`,
              filter: 'blur(40px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: isStory ? -40 : -30,
              left: isStory ? -40 : -30,
              width: isStory ? 200 : 150,
              height: isStory ? 200 : 150,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${data.brandColor}20, transparent 70%)`,
              filter: 'blur(30px)',
            }}
          />

          {/* Content */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              padding: isStory ? '28px 24px' : '20px',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {/* Header: Academy branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: isStory ? 20 : 12,
              }}
            >
              {data.academyLogoUrl ? (
                <img
                  src={data.academyLogoUrl}
                  alt=""
                  style={{
                    width: isStory ? 36 : 28,
                    height: isStory ? 36 : 28,
                    borderRadius: 8,
                    objectFit: 'contain',
                  }}
                  crossOrigin="anonymous"
                />
              ) : (
                <div
                  style={{
                    width: isStory ? 36 : 28,
                    height: isStory ? 36 : 28,
                    borderRadius: 8,
                    background: `${data.brandColor}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isStory ? 16 : 12,
                  }}
                >
                  {'\u26BD'}
                </div>
              )}
              <div>
                <div
                  style={{
                    color: '#ffffff',
                    fontSize: isStory ? 14 : 11,
                    fontWeight: 700,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {data.academyName}
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: isStory ? 10 : 8,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1px',
                  }}
                >
                  Player Highlights
                </div>
              </div>
            </div>

            {/* Player photo/initials + name */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: isStory ? 16 : 10,
              }}
            >
              {data.playerPhotoUrl ? (
                <img
                  src={data.playerPhotoUrl}
                  alt=""
                  style={{
                    width: isStory ? 88 : 56,
                    height: isStory ? 88 : 56,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `3px solid ${data.brandColor}`,
                    marginBottom: isStory ? 12 : 6,
                  }}
                  crossOrigin="anonymous"
                />
              ) : (
                <div
                  style={{
                    width: isStory ? 88 : 56,
                    height: isStory ? 88 : 56,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${data.brandColor}40, ${data.brandColor}10)`,
                    border: `3px solid ${data.brandColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: data.brandColor,
                    fontSize: isStory ? 28 : 18,
                    fontWeight: 800,
                    marginBottom: isStory ? 12 : 6,
                  }}
                >
                  {data.playerInitials}
                </div>
              )}
              <div
                style={{
                  color: '#ffffff',
                  fontSize: isStory ? 24 : 16,
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                  textAlign: 'center' as const,
                }}
              >
                {data.playerName}
              </div>
              <div
                style={{
                  color: data.brandColor,
                  fontSize: isStory ? 13 : 10,
                  fontWeight: 600,
                  marginTop: 4,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '2px',
                }}
              >
                {data.monthLabel} Highlights
              </div>
            </div>

            {/* Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: isStory ? 10 : 6,
                marginBottom: isStory ? 16 : 10,
              }}
            >
              {[
                { value: String(data.sessionsAttended), label: 'Sessions' },
                { value: `${data.attendanceRate}%`, label: 'Attendance' },
                { value: `${data.currentStreak}`, label: 'Streak' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 14,
                    padding: isStory ? '14px 8px' : '8px 6px',
                    textAlign: 'center' as const,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    style={{
                      color: data.brandColor,
                      fontSize: isStory ? 28 : 18,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: isStory ? 10 : 8,
                      marginTop: isStory ? 6 : 3,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.5px',
                      fontWeight: 600,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Star Skill */}
            {data.starSkill && (
              <div
                style={{
                  background: `linear-gradient(135deg, ${data.brandColor}15, ${data.brandColor}05)`,
                  borderRadius: 14,
                  padding: isStory ? '14px 16px' : '8px 12px',
                  marginBottom: isStory ? 12 : 8,
                  border: `1px solid ${data.brandColor}25`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: isStory ? 12 : 8,
                }}
              >
                <div style={{ fontSize: isStory ? 28 : 20 }}>{'\u2B50'}</div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: isStory ? 10 : 8,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '1px',
                      fontWeight: 600,
                    }}
                  >
                    Star Skill
                  </div>
                  <div
                    style={{
                      color: '#ffffff',
                      fontSize: isStory ? 16 : 12,
                      fontWeight: 700,
                    }}
                  >
                    {data.starSkill.label}
                  </div>
                </div>
                <div
                  style={{
                    color: data.brandColor,
                    fontSize: isStory ? 24 : 16,
                    fontWeight: 800,
                  }}
                >
                  {data.starSkill.score}/5
                </div>
              </div>
            )}

            {/* Coach Quote */}
            {truncatedQuote && isStory && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  marginBottom: 12,
                  borderLeft: `3px solid ${data.brandColor}`,
                }}
              >
                <div
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontStyle: 'italic' as const,
                  }}
                >
                  &ldquo;{truncatedQuote}&rdquo;
                </div>
                {data.coachName && (
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 10,
                      marginTop: 6,
                      fontWeight: 600,
                    }}
                  >
                    &mdash; {data.coachName}
                  </div>
                )}
              </div>
            )}

            {/* Achievement Badges */}
            {data.achievements.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap' as const,
                  gap: isStory ? 8 : 6,
                  marginBottom: isStory ? 12 : 8,
                }}
              >
                {data.achievements.slice(0, isStory ? 6 : 4).map((ach, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 10,
                      padding: isStory ? '6px 12px' : '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span style={{ fontSize: isStory ? 16 : 12 }}>{ach.emoji}</span>
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: isStory ? 11 : 8,
                        fontWeight: 600,
                      }}
                    >
                      {ach.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Spacer pushes footer to bottom */}
            <div style={{ flex: 1 }} />

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: isStory ? 14 : 8,
              }}
            >
              <div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: isStory ? 9 : 7,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1px',
                  }}
                >
                  Powered by
                </div>
                <div
                  style={{
                    color: data.brandColor,
                    fontSize: isStory ? 12 : 9,
                    fontWeight: 700,
                    letterSpacing: '-0.3px',
                  }}
                >
                  Player Portal
                </div>
              </div>
              {/* QR Code placeholder using a small visual indicator */}
              <div
                style={{
                  width: isStory ? 48 : 36,
                  height: isStory ? 48 : 36,
                  borderRadius: 8,
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                }}
              >
                {/* Inline SVG QR-like pattern */}
                <svg
                  viewBox="0 0 40 40"
                  style={{ width: '100%', height: '100%' }}
                >
                  {/* Top-left finder */}
                  <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="#0a0a0a" strokeWidth="2.5" />
                  <rect x="5" y="5" width="6" height="6" rx="0.5" fill="#0a0a0a" />
                  {/* Top-right finder */}
                  <rect x="26" y="2" width="12" height="12" rx="1" fill="none" stroke="#0a0a0a" strokeWidth="2.5" />
                  <rect x="29" y="5" width="6" height="6" rx="0.5" fill="#0a0a0a" />
                  {/* Bottom-left finder */}
                  <rect x="2" y="26" width="12" height="12" rx="1" fill="none" stroke="#0a0a0a" strokeWidth="2.5" />
                  <rect x="5" y="29" width="6" height="6" rx="0.5" fill="#0a0a0a" />
                  {/* Data modules */}
                  <rect x="17" y="4" width="3" height="3" fill="#0a0a0a" />
                  <rect x="22" y="4" width="3" height="3" fill="#0a0a0a" />
                  <rect x="17" y="9" width="3" height="3" fill="#0a0a0a" />
                  <rect x="4" y="17" width="3" height="3" fill="#0a0a0a" />
                  <rect x="9" y="17" width="3" height="3" fill="#0a0a0a" />
                  <rect x="17" y="17" width="3" height="3" fill={data.brandColor} />
                  <rect x="22" y="17" width="3" height="3" fill="#0a0a0a" />
                  <rect x="28" y="17" width="3" height="3" fill="#0a0a0a" />
                  <rect x="33" y="17" width="3" height="3" fill="#0a0a0a" />
                  <rect x="17" y="22" width="3" height="3" fill="#0a0a0a" />
                  <rect x="22" y="22" width="3" height="3" fill="#0a0a0a" />
                  <rect x="17" y="28" width="3" height="3" fill="#0a0a0a" />
                  <rect x="22" y="28" width="3" height="3" fill="#0a0a0a" />
                  <rect x="28" y="28" width="3" height="3" fill="#0a0a0a" />
                  <rect x="33" y="28" width="3" height="3" fill="#0a0a0a" />
                  <rect x="28" y="33" width="3" height="3" fill="#0a0a0a" />
                  <rect x="33" y="33" width="3" height="3" fill="#0a0a0a" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: data.brandColor }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white hover:bg-white/15 transition-all disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {downloading ? 'Saving...' : 'Download as Image'}
        </button>
        <button
          onClick={handleCopyLink}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white hover:bg-white/15 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  )
}
