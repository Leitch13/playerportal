// Shared stroked icon set for in-app row icons (search palettes, quick
// actions, empty states). Replaces ad-hoc emoji: one visual system, no
// platform-dependent glyphs.
import React from 'react'

// Consistent stroked icon set for palette rows — replaces the emoji strings
// (mixed-style emoji read as unfinished; these match the app's line icons).
export const PALETTE_ICON_PATHS: Record<string, React.ReactNode> = {
  home: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5" />,
  players: <><circle cx="12" cy="12" r="9" /><path d="M12 3a18 18 0 010 18M3.5 9h17M3.5 15h17" strokeLinecap="round" /></>,
  parents: <><circle cx="9" cy="8" r="3.2" /><path strokeLinecap="round" d="M2.8 20a6.2 6.2 0 0112.4 0" /><path strokeLinecap="round" d="M16.6 8.4a2.8 2.8 0 010 5.2M18.4 20a5.8 5.8 0 00-2.2-4.1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" /></>,
  events: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5l-2.1 2.1M8.6 15.4l-2.1 2.1m0-11l2.1 2.1m6.8 6.8l2.1 2.1" />,
  pencil: <path strokeLinecap="round" strokeLinejoin="round" d="M16.6 4.5l2.9 2.9L8 19H5v-3L16.6 4.5zM14.5 6.6l2.9 2.9" />,
  trophy: <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-6-17h12v4a6 6 0 01-12 0V4zM6 5H3.5a0 0 0 000 0A4.5 4.5 0 008 9.5M18 5h2.5A4.5 4.5 0 0116 9.5" />,
  camera: <><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13.5" r="3.4" /></>,
  list: <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  check: <path strokeLinecap="round" strokeLinejoin="round" d="M4 12.5l5 5L20 6.5" />,
  doc: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  card: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path strokeLinecap="round" d="M3 10.5h18M7 15h4" /></>,
  tag: <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 12.5l8-8H20v8.5l-8 8a1.5 1.5 0 01-2.1 0l-6.4-6.4a1.5 1.5 0 010-2.1zM16 8h.01" />,
  gift: <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8m8-5v14M3 7.5h18V12H3V7.5zm9 0s-1.5-4-4.2-4a2.1 2.1 0 000 4.2M12 7.5s1.5-4 4.2-4a2.1 2.1 0 010 4.2" />,
  chart: <path strokeLinecap="round" d="M4 19V9M10 19V4M16 19v-7M21 19H3" />,
  chat: <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-8 8H4l2.3-2.9A8 8 0 1121 12z" />,
  child: <><circle cx="12" cy="7.5" r="3.5" /><path strokeLinecap="round" d="M5.5 21a6.5 6.5 0 0113 0" /></>,
  eye: <><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  phone: <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h2l2 5-2.2 1.6a13 13 0 006.6 6.6L16 14l5 2v2a2 2 0 01-2 2A15 15 0 014 5z" />,
  mail: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  move: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h13m0 0l-3-3m3 3l-3 3M16 17H3m0 0l3-3m-3 3l3 3" />,
  tent: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4L2.5 20h19L12 4zm0 0v16m-4.5 0L12 12l4.5 8" />,
  cog: <><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2.5l1 2.6 2.7-.6 1 1.8 2.4 1.4-.6 2.7 2 1.6-1 2.5-2.6 1-.1 2.8-2.5.9-1.6 2.3h-2.9l-1.6-2.3-2.5-.9-.1-2.8-2.6-1-1-2.5 2-1.6-.6-2.7L6.3 6.3l1-1.8 2.7.6 1-2.6z" /></>,
}

export function PaletteIcon({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.05] text-[#8fa2bd]">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {PALETTE_ICON_PATHS[name] || PALETTE_ICON_PATHS.doc}
      </svg>
    </span>
  )
}
