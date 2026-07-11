'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/audit'
import GroupForm from './GroupForm'

const CLASS_TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  group: { label: 'Group', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  small_group: { label: 'Small Group', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  '1-2-1': { label: '1-2-1', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  '2-1': { label: '2-1 Pair', bg: 'bg-orange-500/20', text: 'text-orange-400' },
  gk: { label: 'GK Training', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  soccer_tots: { label: 'Soccer Tots', bg: 'bg-pink-500/20', text: 'text-pink-400' },
  academy: { label: 'Academy', bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  accelerator: { label: 'Accelerator', bg: 'bg-rose-500/20', text: 'text-rose-400' },
  elite: { label: 'Elite', bg: 'bg-violet-500/20', text: 'text-violet-400' },
  camp: { label: 'Football Camp', bg: 'bg-green-500/20', text: 'text-green-400' },
  trial: { label: 'Trial', bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  girls: { label: 'Girls Only', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400' },
  adults: { label: 'Adults', bg: 'bg-slate-500/20', text: 'text-slate-400' },
}

interface GroupData {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
  end_time: string | null
  location: string | null
  coach_id: string | null
  max_capacity: number
  age_group: string | null
  description: string | null
  price_per_session: number | null
  class_type?: string | null
  short_description?: string | null
  long_description?: string | null
  benefits?: string[] | null
  suitable_for?: string | null
  what_to_bring?: string | null
  image_url?: string | null
  is_featured?: boolean | null
  // Phase 1B — optional link to public.terms.
  term_id?: string | null
}

export default function GroupCard({
  group,
  coachName,
  enrolled,
  isAdmin,
  coaches,
  orgId,
  waitlistCount = 0,
  orgSlug = '',
  terms = [],
}: {
  group: GroupData
  coachName: string | null
  enrolled: number
  isAdmin: boolean
  coaches: { id: string; full_name: string }[]
  orgId: string
  waitlistCount?: number
  orgSlug?: string
  // Phase 1B — passed through to inline edit form.
  terms?: { id: string; name: string; start_date: string; end_date: string }[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  function handleCopyLink() {
    const url = `${window.location.origin}/book/${orgSlug}/class/${group.id}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }).catch(() => {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  async function handleShareLink() {
    const url = `${window.location.origin}/book/${orgSlug}/class/${group.id}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: group.name,
          text: `Book ${group.name} — ${group.day_of_week || ''} ${group.time_slot || ''}`,
          url,
        })
      } catch { /* user cancelled */ }
    } else {
      handleCopyLink()
    }
  }

  const spotsLeft = group.max_capacity - enrolled
  const fillPercent = Math.min(100, Math.round((enrolled / group.max_capacity) * 100))
  const isFull = enrolled >= group.max_capacity
  const isNearFull = fillPercent >= 70 && !isFull
  const isWarning = fillPercent > 90 && !isFull

  const typeBadge = CLASS_TYPE_BADGES[group.class_type || 'group'] || CLASS_TYPE_BADGES.group

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('training_groups').delete().eq('id', group.id)
    if (error) {
      // 23503 = foreign-key violation: the 097 RESTRICT constraints block
      // deleting a class that still has enrolment / attendance / session-note
      // history (and NO ACTION FKs like targeted announcements surface the
      // same code).
      if (error.code === '23503') {
        alert(
          `"${group.name}" can't be deleted because it has enrolment, attendance or other history linked to it. ` +
          'Move or remove its members first — or unpublish the class to hide it instead.'
        )
      } else {
        alert(error.message)
      }
      setDeleting(false)
    } else {
      await logAudit({
        action: 'group.deleted',
        entityType: 'group',
        entityId: group.id,
        details: { name: group.name },
      })
      router.refresh()
    }
  }

  if (editing) {
    return (
      <GroupForm
        coaches={coaches}
        orgId={orgId}
        editGroup={group}
        onClose={() => setEditing(false)}
        terms={terms}
      />
    )
  }

  const statusChip = isFull ? (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">FULL</span>
  ) : isWarning ? (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">{spotsLeft} LEFT</span>
  ) : isNearFull ? (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">{spotsLeft} LEFT</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">OPEN</span>
  )

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-5 hover:border-[#2a2a2a] transition-all relative flex flex-col min-h-[320px]">
      {/* Top row — badges + overflow menu */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeBadge.bg} ${typeBadge.text}`}>
            {typeBadge.label}
          </span>
          {group.age_group && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
              {group.age_group}
            </span>
          )}
          {group.is_featured && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
              ★ Featured
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {statusChip}
          {isAdmin && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Actions"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-20 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl py-1 text-sm">
                  <button
                    onClick={() => { setEditing(true); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/80 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit class
                  </button>
                  {/* Sprint 8a: repoint to class detail page (the global
                      Enrolments page silently ignored ?group=, so admins
                      were dropped into every other class's enrolments and
                      eventually funnelled to Delete Player). The class
                      detail page filters to this class and hosts the new
                      Remove-from-class action per row. */}
                  <Link
                    href={`/dashboard/groups/${group.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/80 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    View players
                  </Link>
                  <Link
                    href={`/dashboard/attendance/qr/${group.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 text-white/80 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm14 3.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 0v3.5m0-10V7" /></svg>
                    QR check-in
                  </Link>
                  <div className="h-px bg-white/5 my-1" />
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                      Delete class
                    </button>
                  ) : (
                    <div className="px-3 py-2 flex items-center gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        {deleting ? '...' : 'Confirm delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="py-1.5 px-3 rounded-lg text-xs text-white/60 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title + description */}
      <Link href={`/dashboard/groups/${group.id}`} className="block group/title">
        <h3 className="text-base font-bold text-white group-hover/title:text-[#4ecde6] transition-colors leading-tight">
          {group.name}
        </h3>
      </Link>
      <p className="text-xs text-white/40 mt-1 line-clamp-2 min-h-[32px]">
        {group.short_description || group.description || (
          <span className="italic text-white/25">No description yet — add one to help parents choose this class.</span>
        )}
      </p>

      {/* Details — always render all 3 rows for consistent height */}
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-white/70">
          <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span className={group.time_slot ? '' : 'text-white/25 italic'}>
            {group.time_slot || 'Time not set'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className={group.location ? '' : 'text-white/25 italic'}>
            {group.location || 'Location not set'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className={coachName ? '' : 'text-white/25 italic'}>
            {coachName || 'Coach not assigned'}
          </span>
        </div>
        {group.price_per_session != null && Number(group.price_per_session) > 0 && (
          <div className="flex items-center gap-2 text-white/70">
            <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <span>&pound;{Number(group.price_per_session).toFixed(2)} / session</span>
          </div>
        )}
      </div>

      {/* Capacity bar */}
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">Capacity</span>
          <span className={`text-xs font-bold ${isFull ? 'text-red-400' : isWarning ? 'text-red-400' : isNearFull ? 'text-amber-400' : 'text-emerald-400'}`}>
            {enrolled}/{group.max_capacity}
          </span>
        </div>
        <div className="w-full bg-[#0a0a0a] rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isFull || isWarning
                ? 'bg-gradient-to-r from-red-400 to-red-500'
                : isNearFull
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
            }`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        {isFull && (
          <p className="text-[10px] text-red-400 font-medium mt-1.5">
            Full — new players waitlisted
            {waitlistCount > 0 && <span className="ml-1 text-orange-400">({waitlistCount} waiting)</span>}
          </p>
        )}
      </div>

      {/* Share — one tidy row, admin only */}
      {isAdmin && orgSlug && (
        <div className="mt-4 pt-3 border-t border-[#1e1e1e] flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[#4ecde6]/10 text-[#4ecde6] hover:bg-[#4ecde6]/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {linkCopied ? 'Link copied!' : 'Copy booking link'}
          </button>
          <button
            onClick={handleShareLink}
            className="py-2 px-3 rounded-lg text-xs font-semibold bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            title="Share"
            aria-label="Share"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
