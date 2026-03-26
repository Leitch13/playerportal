'use client'

import { createContext, useContext, useEffect } from 'react'

export type BrandData = {
  primaryColor: string
  primaryColorRgb: string
  logoUrl: string | null
  orgName: string
}

const BrandContext = createContext<BrandData>({
  primaryColor: '#4ecde6',
  primaryColorRgb: '78, 205, 230',
  logoUrl: null,
  orgName: 'Player Portal',
})

export function useBrand() {
  return useContext(BrandContext)
}

/** Convert a hex colour like "#4ecde6" to an "r, g, b" string. */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
}

/** Lighten a hex colour by mixing with white. t = 0..1 where 1 = white */
function lighten(hex: string, t: number): string {
  const h = hex.replace('#', '')
  const num = parseInt(h, 16)
  const r = Math.round(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * t)
  const g = Math.round(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * t)
  const b = Math.round((num & 255) + (255 - (num & 255)) * t)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/** Darken a hex colour by mixing with black. t = 0..1 where 1 = black */
function darken(hex: string, t: number): string {
  const h = hex.replace('#', '')
  const num = parseInt(h, 16)
  const r = Math.round(((num >> 16) & 255) * (1 - t))
  const g = Math.round(((num >> 8) & 255) * (1 - t))
  const b = Math.round((num & 255) * (1 - t))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

export default function BrandProvider({
  primaryColor,
  logoUrl,
  orgName,
  children,
}: {
  primaryColor?: string | null
  logoUrl?: string | null
  orgName?: string | null
  children: React.ReactNode
}) {
  const color = primaryColor || '#4ecde6'
  const rgb = hexToRgb(color)

  useEffect(() => {
    const el = document.documentElement
    el.style.setProperty('--brand-primary', color)
    el.style.setProperty('--brand-primary-rgb', rgb)
    // Override Tailwind's accent colour so all accent-* utilities use the brand colour
    el.style.setProperty('--color-accent', color)
    el.style.setProperty('--color-accent-light', lighten(color, 0.4))
    el.style.setProperty('--color-accent-dark', darken(color, 0.2))
    return () => {
      el.style.removeProperty('--brand-primary')
      el.style.removeProperty('--brand-primary-rgb')
      el.style.removeProperty('--color-accent')
      el.style.removeProperty('--color-accent-light')
      el.style.removeProperty('--color-accent-dark')
    }
  }, [color, rgb])

  return (
    <BrandContext.Provider
      value={{
        primaryColor: color,
        primaryColorRgb: rgb,
        logoUrl: logoUrl || null,
        orgName: orgName || 'Player Portal',
      }}
    >
      {children}
    </BrandContext.Provider>
  )
}
