'use client'

import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'

function generateToken(groupId: string): string {
  const today = new Date().toISOString().split('T')[0]
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let random = ''
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${groupId}-${today}-${random}`
}

export default function QRDisplay({
  groupId,
  groupName,
  coachName,
  timeSlot,
  dayOfWeek,
}: {
  groupId: string
  groupName: string
  coachName: string | null
  timeSlot: string | null
  dayOfWeek: string | null
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [token, setToken] = useState(() => generateToken(groupId))
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)

  const regenerate = useCallback(() => {
    const newToken = generateToken(groupId)
    setToken(newToken)
    setSecondsLeft(60)
  }, [groupId])

  // Generate QR code whenever token changes
  useEffect(() => {
    async function generate() {
      const url = `${window.location.origin}/dashboard/attendance/checkin?token=${token}&group=${groupId}`
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: '#0a0a0a', light: '#ffffff' },
        })
        setQrDataUrl(dataUrl)
      } catch (err) {
        console.error('QR generation error:', err)
      }
    }
    generate()
  }, [token, groupId])

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh token every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          regenerate()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [regenerate])

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const timeStr = currentTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[80vh] ${
        isFullscreen ? 'bg-white p-8' : ''
      }`}
    >
      {/* Header info */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-text">{groupName}</h1>
        <p className="text-lg text-text-light mt-1">{today}</p>
        {dayOfWeek && timeSlot && (
          <p className="text-sm text-text-light mt-0.5">
            {dayOfWeek} at {timeSlot}
          </p>
        )}
        {coachName && (
          <p className="text-sm text-text-light">Coach: {coachName}</p>
        )}
        <p className="text-4xl font-mono font-bold text-primary mt-2">{timeStr}</p>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-2xl border-2 border-border p-6 shadow-lg">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Check-in QR Code"
            className="w-[300px] h-[300px] md:w-[400px] md:h-[400px]"
          />
        ) : (
          <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Scan instruction */}
      <p className="text-lg font-medium text-text mt-4">
        Scan to check in your child
      </p>

      {/* Timer and controls */}
      <div className="flex items-center gap-4 mt-4">
        <div className="text-sm text-text-light">
          Refreshes in{' '}
          <span className="font-mono font-bold text-primary">{secondsLeft}s</span>
        </div>
        <button
          onClick={regenerate}
          className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          New QR Code
        </button>
        <button
          onClick={toggleFullscreen}
          className="px-4 py-2 bg-gray-100 text-text rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {/* Session token (small, for debugging) */}
      <p className="text-[10px] text-text-light/50 mt-6 font-mono">{token}</p>
    </div>
  )
}
