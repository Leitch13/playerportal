'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Group {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
}

interface Props {
  playerId: string
  groups: Group[]
  existingGroupIds: string[]
}

export default function AddToGroupButton({ playerId, groups, existingGroupIds }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const availableGroups = groups.filter((g) => !existingGroupIds.includes(g.id))

  async function handleAdd(groupId: string) {
    setSaving(true)
    const supabase = createClient()

    // enrolments.organisation_id is NOT NULL — without this the insert
    // silently fails (RLS rejects rows missing required cols). We resolve
    // the org from the current admin's session via get_my_org().
    const { data: orgId } = await supabase.rpc('get_my_org')
    if (!orgId) {
      alert('Could not determine your organisation. Please refresh and try again.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('enrolments')
      .insert({
        player_id: playerId,
        group_id: groupId,
        status: 'active',
        organisation_id: orgId,
      })

    if (error) {
      alert(error.message)
    } else {
      setOpen(false)
      router.refresh()
    }
    setSaving(false)
  }

  if (availableGroups.length === 0 && !open) {
    return null
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#4ecde6]/10 text-[#4ecde6] border border-[#4ecde6]/20 hover:bg-[#4ecde6]/20 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add to Group
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-white/60">Select a group:</span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-white/40 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
      <div className="grid gap-1.5 max-h-48 overflow-y-auto">
        {availableGroups.map((g) => (
          <button
            key={g.id}
            onClick={() => handleAdd(g.id)}
            disabled={saving}
            className="flex items-center justify-between px-3 py-2 text-sm rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] hover:border-[#4ecde6]/40 transition-colors text-left disabled:opacity-50"
          >
            <span className="font-medium text-white">{g.name}</span>
            <span className="text-xs text-white/50">
              {g.day_of_week && g.day_of_week}
              {g.time_slot && ` ${g.time_slot}`}
            </span>
          </button>
        ))}
        {availableGroups.length === 0 && (
          <p className="text-xs text-white/50 py-2">Already enrolled in all available groups.</p>
        )}
      </div>
    </div>
  )
}
