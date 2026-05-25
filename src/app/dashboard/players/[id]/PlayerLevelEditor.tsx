'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PLAYING_LEVELS = [
  { value: 'beginner', label: 'Beginner', color: 'bg-green-500/15 text-green-400' },
  { value: 'development', label: 'Development', color: 'bg-blue-500/15 text-blue-400' },
  { value: 'intermediate', label: 'Intermediate', color: 'bg-amber-500/15 text-amber-400' },
  { value: 'advanced', label: 'Advanced', color: 'bg-purple-500/15 text-purple-400' },
  { value: 'elite', label: 'Elite', color: 'bg-red-500/15 text-red-400' },
]

const LEAGUE_LEVELS = [
  { value: 'recreational', label: 'Recreational', color: 'bg-gray-500/15 text-gray-400' },
  { value: 'grassroots', label: 'Grassroots', color: 'bg-lime-500/15 text-lime-400' },
  { value: 'b_league', label: 'B League', color: 'bg-sky-500/15 text-sky-400' },
  { value: 'a_league', label: 'A League', color: 'bg-orange-500/15 text-orange-400' },
  { value: 'academy', label: 'Academy', color: 'bg-violet-500/15 text-violet-400' },
  { value: 'professional', label: 'Professional', color: 'bg-rose-500/15 text-rose-400' },
]

interface Props {
  playerId: string
  playingLevel: string | null
  leagueLevel: string | null
}

export default function PlayerLevelEditor({ playerId, playingLevel, leagueLevel }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)

  async function handleChange(field: 'playing_level' | 'league_level', value: string) {
    setSaving(field)
    const supabase = createClient()
    const { error } = await supabase
      .from('players')
      .update({ [field]: value || null, updated_at: new Date().toISOString() })
      .eq('id', playerId)

    if (error) {
      alert(error.message)
    } else {
      router.refresh()
    }
    setSaving(null)
  }

  return (
    <>
      <select
        value={playingLevel || ''}
        onChange={(e) => handleChange('playing_level', e.target.value)}
        disabled={saving === 'playing_level'}
        className="appearance-none px-2 py-0.5 rounded-full text-xs font-medium bg-[#141414] border border-[#1e1e1e] text-white cursor-pointer hover:border-[#4ecde6]/40 focus:border-[#4ecde6] focus:outline-none transition-colors"
      >
        <option value="">Playing Level</option>
        {PLAYING_LEVELS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
      <select
        value={leagueLevel || ''}
        onChange={(e) => handleChange('league_level', e.target.value)}
        disabled={saving === 'league_level'}
        className="appearance-none px-2 py-0.5 rounded-full text-xs font-medium bg-[#141414] border border-[#1e1e1e] text-white cursor-pointer hover:border-[#4ecde6]/40 focus:border-[#4ecde6] focus:outline-none transition-colors"
      >
        <option value="">League Level</option>
        {LEAGUE_LEVELS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
    </>
  )
}
