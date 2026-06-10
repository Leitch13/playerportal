'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'
import NotificationDropdown from '@/components/NotificationDropdown'
import CommandPalette from '@/components/CommandPalette'
import type { UserRole } from '@/lib/types'
import type { FeatureKey, PlanTier } from '@/lib/features'
import { useState, useEffect, useCallback } from 'react'

/* ── Inline SVG icons (Heroicons outline style, 24x24 viewBox) ── */
const iconClass = "w-[18px] h-[18px] flex-shrink-0"

const icons: Record<string, React.ReactNode> = {
  home: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  users: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  calendar: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  'calendar-days': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  ),
  'chart-bar': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  'chart-bar-square': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  ),
  trophy: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0116.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.896m5.25-6.624V2.721" />
    </svg>
  ),
  'check-circle': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ticket: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  ),
  photo: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  megaphone: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
    </svg>
  ),
  'document-text': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  'shopping-bag': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  'credit-card': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  gift: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  funnel: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  ),
  'chat-bubble': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  ),
  'clipboard-document': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-1.992a48.09 48.09 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  cog: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  football: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c0 0-3 4.5-3 9.75s3 9.75 3 9.75M12 2.25c0 0 3 4.5 3 9.75s-3 9.75-3 9.75M3.25 9h17.5M3.25 15h17.5" />
    </svg>
  ),
  'pencil-square': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  clipboard: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  ),
  flag: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  ),
  'user-group': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  clock: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'clipboard-list': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  tag: (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  ),
  'arrow-down-tray': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  'document-chart-bar': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm-1.5 12v-3m-3 3v-1.5m6 1.5v-4.5" />
    </svg>
  ),
  'shield-check': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  'play-circle': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
    </svg>
  ),
  'ellipsis-horizontal': (
    <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
}

type NavItem = {
  href: string
  label: string
  icon: string
  /** If set, item is only shown when the org's plan includes this feature. */
  feature?: FeatureKey
}
type NavGroup = { title: string; items: NavItem[] }

const navGroups: Record<UserRole, NavGroup[]> = {
  parent: [
    { title: '', items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'home' },
    ]},
    { title: 'My Family', items: [
      { href: '/dashboard/children', label: 'My Children', icon: 'users' },
      { href: '/dashboard/schedule', label: 'Schedule', icon: 'calendar' },
      { href: '/dashboard/feedback', label: 'Progress', icon: 'chart-bar', feature: 'progress_reviews' },
      { href: '/dashboard/awards', label: 'Awards', icon: 'trophy', feature: 'achievements' },
      { href: '/dashboard/engagement', label: 'My Score', icon: 'chart-bar-square', feature: 'engagement' },
    ]},
    { title: 'Academy', items: [
      { href: '/dashboard/calendar', label: 'Timetable', icon: 'calendar-days' },
      { href: '/dashboard/events', label: 'Events', icon: 'ticket', feature: 'camps' },
      { href: '/dashboard/gallery', label: 'Gallery', icon: 'photo', feature: 'photo_gallery' },
      { href: '/dashboard/shop', label: 'Shop', icon: 'shopping-bag', feature: 'shop' },
    ]},
    { title: 'Account', items: [
      // Parent label says "Membership" because this page is the
      // de-facto Membership Hub (Protected #8) — covers monthly
      // spend, current classes, billing, subscription management,
      // and available upgrades.  Admin nav still labels it "Payments".
      { href: '/dashboard/payments', label: 'Membership', icon: 'credit-card' },
      { href: '/dashboard/messages', label: 'Messages', icon: 'chat-bubble', feature: 'messaging' },
      { href: '/dashboard/referrals', label: 'Refer a Friend', icon: 'gift', feature: 'referrals' },
      { href: '/dashboard/account', label: 'Settings', icon: 'cog' },
    ]},
  ],
  coach: [
    { title: '', items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/dashboard/session', label: 'Session', icon: 'play-circle' },
    ]},
    { title: 'Coaching', items: [
      { href: '/dashboard/calendar', label: 'Timetable', icon: 'calendar-days' },
      { href: '/dashboard/session-plans', label: 'Session Plans', icon: 'clipboard-document', feature: 'session_plans' },
      { href: '/dashboard/drills', label: 'Drills', icon: 'football', feature: 'session_plans' },
      { href: '/dashboard/attendance', label: 'Attendance', icon: 'check-circle' },
      { href: '/dashboard/cpd', label: 'CPD & Certs', icon: 'shield-check', feature: 'cpd_compliance' },
    ]},
    { title: 'Communication', items: [
      { href: '/dashboard/messages', label: 'Messages', icon: 'chat-bubble', feature: 'messaging' },
      { href: '/dashboard/reviews', label: 'Reviews', icon: 'pencil-square', feature: 'progress_reviews' },
      { href: '/dashboard/awards', label: 'Awards', icon: 'trophy', feature: 'achievements' },
    ]},
    { title: '', items: [
      { href: '/dashboard/account', label: 'Settings', icon: 'cog' },
    ]},
  ],
  admin: [
    { title: '', items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'home' },
    ]},
    { title: 'Academy', items: [
      { href: '/dashboard/groups', label: 'Classes', icon: 'calendar-days' },
      { href: '/dashboard/calendar', label: 'Timetable', icon: 'calendar' },
      { href: '/dashboard/camps', label: 'Camps', icon: 'flag', feature: 'camps' },
      { href: '/dashboard/terms', label: 'Terms', icon: 'calendar' },
      { href: '/dashboard/players', label: 'Players', icon: 'football' },
      { href: '/dashboard/parents', label: 'Parents', icon: 'users' },
      { href: '/dashboard/enrolments', label: 'Enrolments', icon: 'clipboard-list' },
      // Phase 2.7 placement fix — surface the trial booking management
      // surface in the sidebar so academy owners can reach conversion
      // metrics without going via the dashboard activity feed.
      { href: '/dashboard/trials', label: 'Trials', icon: 'funnel' },
      { href: '/dashboard/leads', label: 'Leads', icon: 'funnel' },
      { href: '/dashboard/migration', label: 'Migration', icon: 'arrow-down-tray' },
      { href: '/dashboard/migrate-member', label: 'Migrate Member', icon: 'arrow-down-tray' },
    ]},
    { title: 'Coaching', items: [
      { href: '/dashboard/session-plans', label: 'Session Plans', icon: 'clipboard-document', feature: 'session_plans' },
      { href: '/dashboard/drills', label: 'Drill Library', icon: 'football', feature: 'session_plans' },
      { href: '/dashboard/attendance', label: 'Attendance', icon: 'check-circle' },
      { href: '/dashboard/reviews', label: 'Player Reports', icon: 'pencil-square', feature: 'progress_reviews' },
    ]},
    { title: 'Communication', items: [
      { href: '/dashboard/messages', label: 'Messages', icon: 'chat-bubble', feature: 'messaging' },
      { href: '/dashboard/announcements', label: 'Announcements', icon: 'megaphone' },
      { href: '/dashboard/awards', label: 'Awards', icon: 'trophy', feature: 'achievements' },
    ]},
    { title: 'Finance', items: [
      { href: '/dashboard/plans', label: 'Plans & Pricing', icon: 'tag' },
      { href: '/dashboard/payments', label: 'Payments', icon: 'credit-card' },
      { href: '/dashboard/shop/manage', label: 'Shop', icon: 'shopping-bag', feature: 'shop' },
      { href: '/dashboard/referrals', label: 'Referrals', icon: 'gift', feature: 'referrals' },
    ]},
    { title: 'Reports', items: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: 'chart-bar-square', feature: 'analytics' },
      { href: '/dashboard/exports', label: 'Exports', icon: 'arrow-down-tray' },
      { href: '/dashboard/audit', label: 'Audit Log', icon: 'shield-check', feature: 'audit_log' },
      { href: '/dashboard/cpd', label: 'Compliance', icon: 'shield-check', feature: 'cpd_compliance' },
      { href: '/dashboard/engagement', label: 'Engagement', icon: 'chart-bar', feature: 'engagement' },
    ]},
    { title: '', items: [
      { href: '/dashboard/billing', label: 'Billing & Plan', icon: 'credit-card' },
      { href: '/dashboard/settings', label: 'Settings', icon: 'cog' },
    ]},
  ],
}

// Sprint M1 (MF-2) — admin mobile bottom nav: Players replaces Analytics.
// Analytics is still in the sidebar Reports group; Players is the day-to-day
// surface academy owners want a thumb away from on the phone.
//
// Sprint M1.1 — admin mobile bottom nav re-aligned to actual academy-owner
// frequency tiers from the Mobile Navigation Audit:
//   - Drop Classes (Tier B) → still 1 tap away via More → sidebar
//   - Drop Payments (Tier C weekly) → reachable via More
//   - Drop Settings (Tier D rarely) → reachable via More
//   - Add Attendance (Tier A peak during training windows) — Live Register
//     entry point
//   - Add Messages (Tier A daily) — highest-volume interactive surface
//   - Add 'more' sentinel — opens the existing hamburger sidebar drawer
//     (no new component, just relabel the 5th slot as a sidebar opener)
// Parent + coach unchanged this sprint.
const MOBILE_MORE = 'more' as const
const mobileTabItems: Record<UserRole, string[]> = {
  parent: ['/dashboard', '/dashboard/schedule', '/dashboard/payments', '/dashboard/messages', '/dashboard/account'],
  coach: ['/dashboard', '/dashboard/session', '/dashboard/messages', '/dashboard/account'],
  admin: ['/dashboard', '/dashboard/players', '/dashboard/attendance', '/dashboard/messages', MOBILE_MORE],
}

export default function Navigation({
  role,
  userName,
  userId,
  unreadCount,
  notificationCount,
  orgName,
  logoUrl,
  isSuperAdmin,
  nextSessionHref,
  availableFeatures,
  isPilot,
  planSlug,
}: {
  role: UserRole
  userName: string
  userId: string
  unreadCount?: number
  notificationCount?: number
  orgName?: string
  logoUrl?: string
  isSuperAdmin?: boolean
  nextSessionHref?: string
  availableFeatures?: FeatureKey[]
  isPilot?: boolean
  planSlug?: PlanTier | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme, resolved } = useTheme()
  const featureSet = new Set<FeatureKey>(availableFeatures || [])
  // Filter nav items by feature access. Pilot orgs bypass gating entirely.
  const hasFeature = (item: NavItem): boolean => {
    if (!item.feature) return true // no feature requirement
    if (isPilot) return true // pilot bypass
    return featureSet.has(item.feature)
  }
  const rawGroups = navGroups[role] || []
  const groups = rawGroups
    .map(g => ({ ...g, items: g.items.filter(hasFeature) }))
    .filter(g => g.items.length > 0)
  const allItems = groups.flatMap(g => g.items)
  // Sprint M1.1 — `mobileItems` (filter-by-href) was removed; the bottom-nav
  // now iterates `mobileTabs` directly so order follows the array, and the
  // 'more' sentinel can be handled without being in allItems.
  const mobileTabs = mobileTabItems[role] || []
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Collapsible groups with localStorage persistence
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nav-collapsed')
      if (saved) setCollapsed(JSON.parse(saved))
    } catch {}
  }, [])
  const toggleGroup = useCallback((title: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem('nav-collapsed', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    // Clear all sb- cookies client-side
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim()
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      }
    })
    // Use signout route to also clear server-side cookies
    window.location.href = '/auth/signout'
  }

  function cycleTheme() {
    const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % 3])
  }

  const themeIcon = resolved === 'dark' ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  )

  const firstName = userName.split(' ')[0]

  return (
    <>
      {/* ── Top Bar ── */}
      <nav className="sticky top-0 z-40 bg-primary border-b border-white/5">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>

              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={orgName || 'Logo'}
                    className="h-10 w-10 sm:h-11 sm:w-11 object-cover rounded-xl shadow-sm border border-white/[0.08] group-hover:border-white/20 transition-colors"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/logo.png" alt="Player Portal" className="h-10 w-auto object-contain" />
                )}
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-white font-extrabold text-base tracking-tight">{orgName || 'Player Portal'}</span>
                  {orgName && <span className="text-[10px] text-white/30 font-medium">Powered by Player Portal</span>}
                </div>
                {/* Mobile: just the org name, no subtitle */}
                <span className="sm:hidden font-extrabold text-base tracking-tight text-white">{orgName || 'Player Portal'}</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <button
                onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Search (⌘K)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <kbd className="hidden sm:inline text-[10px] font-medium px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white/40">
                  ⌘K
                </kbd>
              </button>

              {/* Theme */}
              <button
                onClick={cycleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title={`Theme: ${theme}`}
              >
                {themeIcon}
              </button>

              {/* Notifications */}
              <NotificationDropdown userId={userId} initialCount={notificationCount || 0} />

              {/* User */}
              <div className="hidden sm:flex items-center gap-2 ml-1 pl-2 border-l border-white/10">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-accent">{firstName[0]?.toUpperCase()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white/80 leading-none">{firstName}</span>
                  <span className="text-[10px] text-accent/70 capitalize leading-tight">{role}</span>
                </div>
              </div>

              {/* Expandable signout — icon-only by default, slides open to reveal label on hover.
                  Premium feel: smooth width transition, door-opening icon animation (translate+rotate),
                  subtle red glow ring on hover. */}
              <button
                onClick={handleSignOut}
                className="hidden sm:flex group items-center gap-2 h-10 pl-2.5 pr-2.5 hover:pr-4 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-400/10 active:scale-95 transition-all duration-300 overflow-hidden whitespace-nowrap relative"
                style={{ boxShadow: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px rgba(248, 113, 113, 0.15), 0 0 20px rgba(248, 113, 113, 0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
                title="Sign out"
                aria-label="Sign out"
              >
                <svg className="w-[18px] h-[18px] flex-shrink-0 transition-all duration-500 group-hover:translate-x-1 group-hover:-rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-xs font-semibold max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 transition-all duration-300 ease-out">
                  Sign out
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Sidebar Overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-64 bg-[#0a0a0a] border-r border-white/[0.06] overflow-y-auto transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3 space-y-0.5">
          {groups.map((group, gi) => {
            const isCollapsible = !!group.title
            const isOpen = !collapsed[group.title]
            const hasActiveChild = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
            return (
              <div key={gi}>
                {isCollapsible ? (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-3 pt-4 pb-1 group"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 group-hover:text-white/60 transition-colors">
                      {group.title}
                    </span>
                    <svg
                      className={`w-3 h-3 text-white/30 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                ) : null}
                <div className={`overflow-hidden transition-all duration-200 ${
                  isCollapsible && !isOpen && !hasActiveChild ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
                }`}>
                  {group.items.map((item) => {
                    const sidebarHref = item.href === '/dashboard/session'
                      ? (nextSessionHref || '/dashboard/session-plans')
                      : item.href
                    const active = item.href === '/dashboard/session'
                      ? pathname.startsWith('/dashboard/session')
                      : pathname === item.href
                    const isMessages = item.href === '/dashboard/messages'
                    return (
                      <Link
                        key={item.href}
                        href={sidebarHref}
                        onClick={() => setSidebarOpen(false)}
                        className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                          active
                            ? 'bg-accent/10 text-accent shadow-sm shadow-accent/5'
                            : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-r-full" />
                        )}
                        <span className="w-5 flex items-center justify-center">{icons[item.icon] || item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        {isMessages && (unreadCount || 0) > 0 && (
                          <span className="bg-danger text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Platform Admin link (super admins only) */}
        {isSuperAdmin && (
          <div className="px-3 mt-2">
            <Link
              href="/platform"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                pathname === '/platform'
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-indigo-400/60 hover:bg-indigo-500/10 hover:text-indigo-400'
              }`}
            >
              <span className="w-5 flex items-center justify-center">
                <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </span>
              <span className="flex-1">Platform Admin</span>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Super</span>
            </Link>
          </div>
        )}

        {/* Sidebar footer */}
        <div className="p-3 mt-2 border-t border-white/[0.06] sm:hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xs font-bold text-accent">{firstName[0]?.toUpperCase()}</span>
              </div>
              <span className="text-sm font-medium text-white/80">{firstName}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-all"
            >
              <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ── */}
      <div className="mobile-bottom-nav lg:hidden bg-[#0a0a0a] border-t border-white/[0.06]">
        <div className="flex justify-around items-center h-14">
          {/* Sprint M1.1 — iterate `mobileTabs` (the role's bottom-nav source
              of truth) instead of the feature-filtered `mobileItems`, so
              ORDER follows the array declaration. Special-case the 'more'
              sentinel: render as a button that opens the existing hamburger
              sidebar drawer — no new component, no new state. */}
          {mobileTabs.map((tabPath) => {
            // 'more' sentinel — opens existing sidebar overlay
            if (tabPath === MOBILE_MORE) {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="More"
                  className="flex flex-col items-center gap-0.5 px-3 py-1 relative transition-all duration-150 text-white/50 active:scale-95"
                >
                  <span className="flex items-center justify-center">{icons['ellipsis-horizontal']}</span>
                  <span className="text-[10px] font-medium leading-tight">More</span>
                </button>
              )
            }
            // Lookup the corresponding NavItem (respects feature gating).
            // If the org's plan doesn't include this feature, the slot
            // silently disappears — same pre-existing behaviour for
            // /dashboard/messages on non-pilot orgs without messaging.
            const item = allItems.find((i) => i.href === tabPath)
            if (!item) return null
            // For coach Session tab: resolve to dynamic next session href
            const resolvedHref = item.href === '/dashboard/session'
              ? (nextSessionHref || '/dashboard/session-plans')
              : item.href
            const active = item.href === '/dashboard/session'
              ? pathname.startsWith('/dashboard/session')
              : pathname === item.href
            // Coach mobile: show "More" with ellipsis icon for account tab
            const mobileLabel = (role === 'coach' && item.href === '/dashboard/account') ? 'More' : item.label
            const mobileIcon = (role === 'coach' && item.href === '/dashboard/account') ? 'ellipsis-horizontal' : item.icon
            return (
              <Link
                key={item.href}
                href={resolvedHref}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 relative transition-all duration-150 ${
                  active ? 'text-accent' : 'text-white/50 active:scale-95'
                }`}
              >
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-accent rounded-b-full" />
                )}
                <span className="flex items-center justify-center">{icons[mobileIcon] || mobileIcon}</span>
                <span className="text-[10px] font-medium leading-tight">{mobileLabel}</span>
                {item.href === '/dashboard/messages' && (unreadCount || 0) > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-danger rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      <CommandPalette role={role} />
    </>
  )
}
