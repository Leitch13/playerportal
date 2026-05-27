'use client'

import { useEffect, useState } from 'react'

interface ConfettiPiece {
  id: number
  x: number
  delay: number
  duration: number
  size: number
  color: string
  rotateStart: number
  rotateEnd: number
}

/**
 * CSS-only confetti for the subscription success page.
 * No external libraries — pure DOM + CSS keyframes for max compatibility.
 * Pieces drop in waves over ~4 seconds then fade.
 */
export default function SubscriptionSuccessConfetti({ color = '#4ecde6' }: { color?: string }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    const palette = [color, '#ffffff', '#10b981', '#fbbf24', '#a78bfa']
    const items: ConfettiPiece[] = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2.5 + Math.random() * 2,
      size: 6 + Math.random() * 8,
      color: palette[Math.floor(Math.random() * palette.length)],
      rotateStart: Math.random() * 360,
      rotateEnd: Math.random() * 720 - 360,
    }))
    setPieces(items)
    const timeout = setTimeout(() => setPieces([]), 6000)
    return () => clearTimeout(timeout)
  }, [color])

  if (pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-20px',
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '2px' : '50%',
            opacity: 0.9,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotateStart}deg)`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--rotate-end' as any]: `${p.rotateEnd}deg`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(var(--rotate-end, 360deg)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
