'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Parent {
  id: string
  full_name: string
  email: string
}

interface Group {
  id: string
  name: string
}

const inputCls = 'w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/30 focus:border-[#4ecde6]/50 transition-all'
const labelCls = 'block text-xs font-medium text-white/60 mb-1.5'
const selectCls = inputCls + ' appearance-none'

export default function QuickAddPlayer({
  parents,
  groups,
  autoOpen,
  orgId,
}: {
  parents: Parent[]
  groups: Group[]
  autoOpen: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [playingLevel, setPlayingLevel] = useState('development')
  const [leagueLevel, setLeagueLevel] = useState('')
  const [groupId, setGroupId] = useState('')

  const [parentId, setParentId] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPhone, setParentPhone] = useState('')

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const supabase = createClient()
    let resolvedParentId = parentId

    if (mode === 'new') {
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: parentEmail,
        password: tempPassword,
        options: {
          data: {
            full_name: parentName,
            phone: parentPhone,
            role: 'parent',
          },
        },
      })

      if (authErr || !authData.user) {
        setError(authErr?.message || 'Failed to create parent account')
        setLoading(false)
        return
      }

      resolvedParentId = authData.user.id
      await new Promise((r) => setTimeout(r, 500))
    }

    const { error: playerErr } = await supabase.from('players').insert({
      organisation_id: orgId,
      parent_id: resolvedParentId,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob || null,
      age_group: ageGroup || null,
      playing_level: playingLevel,
      league_level: leagueLevel || null,
    })

    if (playerErr) {
      setError(playerErr.message)
      setLoading(false)
      return
    }

    if (groupId) {
      const { data: newPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('parent_id', resolvedParentId)
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (newPlayer) {
        await supabase.from('enrolments').insert({
          organisation_id: orgId,
          player_id: newPlayer.id,
          group_id: groupId,
          status: 'active',
        })
      }
    }

    setSuccess(`${firstName} ${lastName} added!`)
    setFirstName('')
    setLastName('')
    setDob('')
    setAgeGroup('')
    setPlayingLevel('development')
    setLeagueLevel('')
    setGroupId('')
    setParentId('')
    setParentName('')
    setParentEmail('')
    setParentPhone('')
    router.refresh()
    setLoading(false)

    setTimeout(() => setSuccess(''), 3000)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-semibold hover:bg-[#6dd8ee] transition-colors"
      >
        + Add Player
      </button>
    )
  }

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">Add Player</h2>
        <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-sm transition-colors">Close</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Player details */}
        <div>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Player Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>First Name *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="First name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name *</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Last name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
            </div>
            <div>
              <label className={labelCls}>Age Group</label>
              <input type="text" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="e.g. U10" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Player Level</label>
              <select value={playingLevel} onChange={(e) => setPlayingLevel(e.target.value)} className={selectCls}>
                <option value="beginner" className="bg-[#1a1a1a]">Beginner — Just starting out</option>
                <option value="development" className="bg-[#1a1a1a]">Development — Learning the basics</option>
                <option value="intermediate" className="bg-[#1a1a1a]">Intermediate — Good understanding</option>
                <option value="advanced" className="bg-[#1a1a1a]">Advanced — Strong technical ability</option>
                <option value="elite" className="bg-[#1a1a1a]">Elite — Academy/representative level</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>League Level</label>
              <select value={leagueLevel} onChange={(e) => setLeagueLevel(e.target.value)} className={selectCls}>
                <option value="" className="bg-[#1a1a1a]">Select league level...</option>
                <option value="recreational" className="bg-[#1a1a1a]">Recreational</option>
                <option value="grassroots" className="bg-[#1a1a1a]">Grassroots</option>
                <option value="b_league" className="bg-[#1a1a1a]">B League</option>
                <option value="a_league" className="bg-[#1a1a1a]">A League</option>
                <option value="academy" className="bg-[#1a1a1a]">Academy</option>
                <option value="professional" className="bg-[#1a1a1a]">Professional Development</option>
              </select>
            </div>
          </div>
        </div>

        {/* Parent linking */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Parent</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('existing')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === 'existing' ? 'bg-[#4ecde6] text-[#0a0a0a]' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1]'}`}>
                Existing
              </button>
              <button type="button" onClick={() => setMode('new')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${mode === 'new' ? 'bg-[#4ecde6] text-[#0a0a0a]' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1]'}`}>
                + New Parent
              </button>
            </div>
          </div>

          {mode === 'existing' ? (
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} required className={selectCls}>
              <option value="" className="bg-[#1a1a1a]">Select parent...</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#1a1a1a]">{p.full_name} ({p.email})</option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} required={mode === 'new'} placeholder="Parent name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required={mode === 'new'} placeholder="parent@email.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="+44 7700 900000" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Optional auto-enrol */}
        <div>
          <label className={labelCls}>Enrol in Class (optional)</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectCls}>
            <option value="" className="bg-[#1a1a1a]">No class yet</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id} className="bg-[#1a1a1a]">{g.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-[#4ecde6] font-medium">{success}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-semibold hover:bg-[#6dd8ee] disabled:opacity-50 transition-colors">
            {loading ? 'Adding...' : 'Add Player'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2.5 bg-white/[0.06] text-white/60 rounded-xl text-sm font-medium hover:bg-white/[0.1] transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
