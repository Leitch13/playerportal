'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUpload from '@/components/FileUpload'

interface Attachment {
  name: string
  url: string
  type: string
  size: number
}

interface SessionPlan {
  id: string
  title: string
  training_group_id: string | null
  session_date: string | null
  duration_minutes: number
  objectives: string | null
  warm_up: string | null
  main_activity: string | null
  cool_down: string | null
  equipment: string | null
  notes: string | null
  status: string
}

export default function SessionPlanForm({
  groups,
  coachId,
  orgId,
  editPlan,
}: {
  groups: { id: string; name: string }[]
  coachId: string
  orgId: string
  editPlan?: SessionPlan
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState(editPlan?.title || '')
  const [groupId, setGroupId] = useState(editPlan?.training_group_id || '')
  const [sessionDate, setSessionDate] = useState(editPlan?.session_date || '')
  const [duration, setDuration] = useState(editPlan?.duration_minutes || 60)
  const [objectives, setObjectives] = useState(editPlan?.objectives || '')
  const [warmUp, setWarmUp] = useState(editPlan?.warm_up || '')
  const [mainActivity, setMainActivity] = useState(editPlan?.main_activity || '')
  const [coolDown, setCoolDown] = useState(editPlan?.cool_down || '')
  const [equipment, setEquipment] = useState(editPlan?.equipment || '')
  const [notes, setNotes] = useState(editPlan?.notes || '')
  const [attachments, setAttachments] = useState<Attachment[]>((editPlan as unknown as { attachments?: Attachment[] })?.attachments || [])

  async function handleSave(status: string) {
    if (!title.trim()) return
    setSaving(true)

    const supabase = createClient()
    const payload = {
      organisation_id: orgId,
      coach_id: coachId,
      training_group_id: groupId || null,
      title: title.trim(),
      session_date: sessionDate || null,
      duration_minutes: duration,
      objectives: objectives.trim() || null,
      warm_up: warmUp.trim() || null,
      main_activity: mainActivity.trim() || null,
      cool_down: coolDown.trim() || null,
      equipment: equipment.trim() || null,
      notes: notes.trim() || null,
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : '[]',
      status,
    }

    if (editPlan) {
      await supabase.from('session_plans').update(payload).eq('id', editPlan.id)
    } else {
      await supabase.from('session_plans').insert(payload)
    }

    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  // If editPlan, render as an edit button
  if (editPlan && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[#4ecde6] hover:text-[#4ecde6]/80 transition text-sm flex-shrink-0"
      >
        Edit
      </button>
    )
  }

  // New plan button
  if (!editPlan && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-[#4ecde6] hover:bg-[#4ecde6]/80 text-black font-semibold text-sm px-4 py-2 rounded-lg transition"
      >
        + New Session Plan
      </button>
    )
  }

  const inputCls =
    'w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50 transition'
  const labelCls = 'block text-xs font-medium text-white/50 mb-1'

  return (
    <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">
          {editPlan ? 'Edit Session Plan' : 'New Session Plan'}
        </h2>
        <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-sm transition">
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Title *</label>
          <input
            className={inputCls}
            placeholder="e.g. U10 Technical Passing Session"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Class</label>
          <select className={inputCls} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Select class...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Date</label>
          <input
            type="date"
            className={inputCls}
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Duration</label>
          <select className={inputCls} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
          </select>
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

        <div className="md:col-span-2">
          <label className={labelCls}>Objectives</label>
          <textarea
            className={inputCls + ' min-h-[60px]'}
            rows={2}
            placeholder="What should players learn or improve?"
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
          />
        </div>
      </div>

      {/* Structured sections */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white/60 border-b border-white/[0.08] pb-2">Session Structure</h3>

        <div>
          <label className={labelCls}>Warm Up</label>
          <textarea
            className={inputCls + ' min-h-[60px]'}
            rows={2}
            placeholder="Dynamic stretches, rondo, passing sequences..."
            value={warmUp}
            onChange={(e) => setWarmUp(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Main Activity</label>
          <textarea
            className={inputCls + ' min-h-[80px]'}
            rows={3}
            placeholder="Core drills and exercises for this session..."
            value={mainActivity}
            onChange={(e) => setMainActivity(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Cool Down</label>
          <textarea
            className={inputCls + ' min-h-[60px]'}
            rows={2}
            placeholder="Static stretches, Q&A, reflection..."
            value={coolDown}
            onChange={(e) => setCoolDown(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={inputCls + ' min-h-[60px]'}
          rows={2}
          placeholder="Any additional coach notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Attachments */}
      <div>
        <label className={labelCls}>Attachments (Diagrams, PDFs, Photos)</label>
        <FileUpload
          attachments={attachments}
          onChange={setAttachments}
          folder="session-plans"
          accept="image/*,.pdf"
          maxFiles={10}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => handleSave('draft')}
          disabled={saving || !title.trim()}
          className="bg-white/10 hover:bg-white/15 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          onClick={() => handleSave('ready')}
          disabled={saving || !title.trim()}
          className="bg-[#4ecde6] hover:bg-[#4ecde6]/80 text-black text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Mark Ready'}
        </button>
        {editPlan && editPlan.status !== 'completed' && (
          <button
            onClick={() => handleSave('completed')}
            disabled={saving}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-40"
          >
            Complete
          </button>
        )}
      </div>
    </div>
  )
}
