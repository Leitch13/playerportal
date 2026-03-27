'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/FileUpload'

interface Drill {
  id: string
  name: string
  category: string | null
  description: string | null
  duration_minutes: number
  equipment: string | null
  min_players: number
  max_players: number | null
  difficulty: string
  image_url: string | null
  pdf_url?: string | null
  created_by: string | null
}

export default function DrillForm({
  orgId,
  userId,
  editDrill,
  onClose,
}: {
  orgId: string
  userId: string
  editDrill?: Drill | null
  onClose: () => void
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(editDrill?.name || '')
  const [category, setCategory] = useState(editDrill?.category || '')
  const [description, setDescription] = useState(editDrill?.description || '')
  const [duration, setDuration] = useState(editDrill?.duration_minutes || 15)
  const [equipment, setEquipment] = useState(editDrill?.equipment || '')
  const [minPlayers, setMinPlayers] = useState(editDrill?.min_players || 2)
  const [maxPlayers, setMaxPlayers] = useState(editDrill?.max_players?.toString() || '')
  const [ageGroup, setAgeGroup] = useState('')
  const [difficulty, setDifficulty] = useState(editDrill?.difficulty || 'intermediate')
  const [imageUrl, setImageUrl] = useState(editDrill?.image_url || '')
  const [pdfUrl, setPdfUrl] = useState(editDrill?.pdf_url || '')

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)

    const supabase = createClient()
    const payload = {
      organisation_id: orgId,
      created_by: userId,
      name: name.trim(),
      category: category || null,
      description: description.trim() || null,
      duration_minutes: duration,
      equipment: equipment.trim() || null,
      min_players: minPlayers,
      max_players: maxPlayers ? Number(maxPlayers) : null,
      age_group: ageGroup.trim() || null,
      difficulty,
      image_url: imageUrl || null,
      pdf_url: pdfUrl || null,
    }

    if (editDrill) {
      await supabase.from('drills').update(payload).eq('id', editDrill.id)
    } else {
      await supabase.from('drills').insert(payload)
    }

    setSaving(false)
    onClose()
    router.refresh()
  }

  const inputCls =
    'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50 transition'
  const labelCls = 'block text-xs font-medium text-white/50 mb-1'

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">{editDrill ? 'Edit Drill' : 'Add Drill'}</h2>
        <button onClick={onClose} className="text-white/40 hover:text-white text-sm transition">
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Name *</label>
          <input
            className={inputCls}
            placeholder="e.g. 4v2 Rondo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select category...</option>
            <option value="warm_up">Warm Up</option>
            <option value="technical">Technical</option>
            <option value="tactical">Tactical</option>
            <option value="physical">Physical</option>
            <option value="game">Game</option>
            <option value="cool_down">Cool Down</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Difficulty</label>
          <select className={inputCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls}>Description</label>
          <textarea
            className={inputCls + ' min-h-[80px]'}
            rows={3}
            placeholder="Explain the drill setup, rules, and coaching points..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Duration (minutes)</label>
          <input
            type="number"
            className={inputCls}
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>

        <div>
          <label className={labelCls}>Equipment</label>
          <input
            className={inputCls}
            placeholder="Cones, bibs, balls..."
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Min Players</label>
          <input
            type="number"
            className={inputCls}
            min={1}
            value={minPlayers}
            onChange={(e) => setMinPlayers(Number(e.target.value))}
          />
        </div>

        <div>
          <label className={labelCls}>Max Players</label>
          <input
            type="number"
            className={inputCls}
            min={1}
            placeholder="Optional"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Age Group</label>
          <input
            className={inputCls}
            placeholder="e.g. U8-U10"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
          />
        </div>
      </div>

      {/* File Uploads */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white/60 border-b border-[#1e1e1e] pb-2">Attachments</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUpload
            bucketName="coaching"
            folder="drills/images"
            accept="image/*"
            onUpload={(url) => setImageUrl(url)}
            currentUrl={imageUrl}
            label="Drill Diagram / Image"
          />

          <FileUpload
            bucketName="coaching"
            folder="drills/pdfs"
            accept=".pdf"
            onUpload={(url) => setPdfUrl(url)}
            currentUrl={pdfUrl}
            label="Drill PDF / Instructions"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-[#4ecde6] hover:bg-[#4ecde6]/80 text-black text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-40"
        >
          {saving ? 'Saving...' : editDrill ? 'Update Drill' : 'Save Drill'}
        </button>
      </div>
    </div>
  )
}
