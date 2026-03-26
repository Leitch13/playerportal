'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GroupForm from './GroupForm'

const CLASS_TYPE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  group: { label: 'Group', bg: 'bg-blue-100', text: 'text-blue-700' },
  small_group: { label: 'Small Group', bg: 'bg-purple-100', text: 'text-purple-700' },
  '1-2-1': { label: '1-2-1', bg: 'bg-amber-100', text: 'text-amber-700' },
  '2-1': { label: '2-1 Pair', bg: 'bg-orange-100', text: 'text-orange-700' },
  gk: { label: 'GK Training', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  soccer_tots: { label: 'Soccer Tots', bg: 'bg-pink-100', text: 'text-pink-700' },
  academy: { label: 'Academy', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  accelerator: { label: 'Accelerator', bg: 'bg-rose-100', text: 'text-rose-700' },
  elite: { label: 'Elite', bg: 'bg-violet-100', text: 'text-violet-700' },
  camp: { label: 'Camp', bg: 'bg-green-100', text: 'text-green-700' },
  trial: { label: 'Trial', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  girls: { label: 'Girls Only', bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
  adults: { label: 'Adults', bg: 'bg-slate-100', text: 'text-slate-700' },
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
}: {
  group: GroupData
  coachName: string | null
  enrolled: number
  isAdmin: boolean
  coaches: { id: string; full_name: string }[]
  orgId: string
  waitlistCount?: number
  orgSlug?: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

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
  const isFull = spotsLeft <= 0
  const isNearFull = spotsLeft <= 3 && spotsLeft > 0

  const typeBadge = CLASS_TYPE_BADGES[group.class_type || 'group'] || CLASS_TYPE_BADGES.group

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('training_groups').delete().eq('id', group.id)
    if (error) {
      alert(error.message)
      setDeleting(false)
    } else {
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
      />
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-all relative group/card">
      {/* Status badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        {group.is_featured && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-600 border border-yellow-200">
            Featured
          </span>
        )}
        {isFull && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600">FULL</span>
        )}
        {isNearFull && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600">{spotsLeft} LEFT</span>
        )}
        {!isFull && !isNearFull && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-600">OPEN</span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeBadge.bg} ${typeBadge.text}`}>
          {typeBadge.label}
        </span>
        {group.age_group && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
            {group.age_group}
          </span>
        )}
      </div>
      <h3 className="text-base font-bold pr-16 mt-1">{group.name}</h3>
      {group.short_description && (
        <p className="text-xs text-text-light mt-1 line-clamp-2">{group.short_description}</p>
      )}
      {!group.short_description && group.description && (
        <p className="text-xs text-text-light mt-1 line-clamp-2">{group.description}</p>
      )}

      {/* Details */}
      <div className="mt-3 space-y-1.5">
        {group.time_slot && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-light">
              <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </span>
            <span className="font-medium">{group.time_slot}</span>
          </div>
        )}
        {group.location && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-light">
              <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </span>
            <span>{group.location}</span>
          </div>
        )}
        {coachName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-light">
              <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </span>
            <span>{coachName}</span>
          </div>
        )}
        {group.price_per_session != null && Number(group.price_per_session) > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-light">
              <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>
            </span>
            <span>&pound;{Number(group.price_per_session).toFixed(2)} / session</span>
          </div>
        )}
      </div>

      {/* Capacity bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-text-light">Capacity</span>
          <span className={`text-xs font-bold ${isFull ? 'text-red-500' : isNearFull ? 'text-orange-500' : 'text-emerald-600'}`}>
            {enrolled}/{group.max_capacity}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              isFull
                ? 'bg-gradient-to-r from-red-400 to-red-500'
                : isNearFull
                  ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                  : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
            }`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        {isFull && (
          <p className="text-[10px] text-red-500 font-medium mt-1">
            Class is full — new players will be waitlisted
            {waitlistCount > 0 && <span className="ml-1 text-orange-500">({waitlistCount} on waitlist)</span>}
          </p>
        )}
      </div>

      {/* Share link */}
      {isAdmin && orgSlug && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            {linkCopied ? 'Copied!' : 'Copy Class Link'}
          </button>
          <button
            onClick={handleShareLink}
            className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            title="Share"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          </button>
        </div>
      )}

      {/* Admin actions */}
      {isAdmin && (
        <div className="mt-2 pt-3 border-t border-border/50 flex items-center gap-2">
          <Link
            href={`/dashboard/attendance/qr/${group.id}`}
            className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
            title="QR Check-in"
          >
            <span className="inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm14 3.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0 0v3.5m0-10V7" />
              </svg>
              QR
            </span>
          </Link>
          <Link
            href={`/dashboard/enrolments?group=${group.id}`}
            className="flex-1 text-center py-1.5 rounded-lg text-xs font-semibold bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
          >
            View Players
          </Link>
          <button
            onClick={() => setEditing(true)}
            className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-gray-50 text-text-light hover:bg-gray-100 hover:text-text transition-colors"
          >
            Edit
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="py-1.5 px-3 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="py-1.5 px-3 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? '...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="py-1.5 px-2 rounded-lg text-xs text-text-light hover:text-text"
              >
                No
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
