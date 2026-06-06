/**
 * Sprint 11a — Live Register (pitch-side attendance taking).
 *
 * One class · one date · per-row ✓/✗ · sticky save bar. Mirrors the
 * proven AttendanceManager UX from /dashboard/attendance, scoped to a
 * single class so the coach lands here straight from a class card.
 *
 * Pitch-side info shown per row (data already in the players table):
 *   • photo or initials fallback
 *   • age (derived from DOB)
 *   • medical info indicator (red badge + full text on hover)
 *   • emergency contact name + tel: link
 *
 * Trial guests are surfaced ABOVE the enrolled-player list (matches the
 * existing register print + attendance-manager pattern).
 *
 * OUT OF SCOPE (Sprint 11a):
 *   • Player drawer
 *   • QR polling
 *   • Status badges (enrolment/payment)
 *   • Message-parent deep-link
 *   • beforeunload warning
 *   • Schema changes
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
// Sprint 11b — Player Quick Drawer mounted at the bottom of the register.
import PlayerQuickDrawer from './PlayerQuickDrawer'

export interface LiveRegisterPlayer {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  date_of_birth: string | null
  medical_info: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  // Sprint 11b — added so the drawer can lazy-fetch the parent profile
  // without a second round-trip. Server-side SELECT extended in
  // page.tsx; nothing else on the register reads it.
  parent_id: string | null
}

export interface LiveRegisterTrial {
  id: string
  child_name: string
  child_age: number | null
  parent_name: string
  parent_email: string
  parent_phone: string | null
  preferred_date: string | null
  status: string
}

type AttendanceState = 'present' | 'absent' | 'unmarked'

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export default function LiveRegisterClient({
  groupId,
  groupName,
  orgId,
  defaultDate,
  players,
  trials,
}: {
  groupId: string
  groupName: string
  orgId: string
  defaultDate: string                  // YYYY-MM-DD; server-provided default
  players: LiveRegisterPlayer[]
  trials: LiveRegisterTrial[]
}) {
  const router = useRouter()
  const [sessionDate, setSessionDate] = useState(defaultDate)
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({})
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState('')
  const [existingLoaded, setExistingLoaded] = useState(false)
  // Sprint 11b — Player Quick Drawer. Single open-player ID; null = closed.
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null)

  // ─── Pre-fill from existing attendance rows for this group + date ───
  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('attendance')
        .select('player_id, present')
        .eq('group_id', groupId)
        .eq('session_date', sessionDate)
      if (cancelled) return
      const next: Record<string, AttendanceState> = {}
      for (const row of data || []) {
        next[(row as { player_id: string }).player_id] =
          (row as { present: boolean }).present ? 'present' : 'absent'
      }
      setAttendance(next)
      setExistingLoaded(true)
      setSavedNote('')
    }
    setExistingLoaded(false)
    load()
    return () => { cancelled = true }
  }, [groupId, sessionDate])

  // ─── Trial guests for the chosen date ───
  const trialsToday = useMemo(
    () => trials.filter((t) => t.preferred_date === sessionDate).sort((a, b) => a.child_name.localeCompare(b.child_name)),
    [trials, sessionDate],
  )

  // ─── Counts ───
  const counts = useMemo(() => {
    let present = 0, absent = 0, unmarked = 0
    for (const p of players) {
      const s = attendance[p.id] || 'unmarked'
      if (s === 'present') present++
      else if (s === 'absent') absent++
      else unmarked++
    }
    return { present, absent, unmarked, total: players.length }
  }, [attendance, players])

  // ─── Per-row state setters ───
  function setOne(id: string, s: AttendanceState) {
    setAttendance((prev) => ({ ...prev, [id]: s }))
    setSavedNote('')
  }
  function markAllPresent() {
    const next: Record<string, AttendanceState> = { ...attendance }
    for (const p of players) next[p.id] = 'present'
    setAttendance(next)
    setSavedNote('')
  }
  function resetAll() {
    setAttendance({})
    setSavedNote('')
  }

  // ─── Save ───
  async function handleSave() {
    if (counts.present + counts.absent === 0) return
    setSaving(true)
    setSavedNote('')
    const supabase = createClient()
    const records = players
      .filter((p) => attendance[p.id] && attendance[p.id] !== 'unmarked')
      .map((p) => ({
        player_id: p.id,
        group_id: groupId,
        session_date: sessionDate,
        present: attendance[p.id] === 'present',
        organisation_id: orgId,
      }))
    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'player_id,group_id,session_date' })
    if (error) {
      setSavedNote(`Save failed: ${error.message}`)
    } else {
      setSavedNote(`Saved · ${counts.present} present · ${counts.absent} absent`)
      router.refresh()
      setTimeout(() => setSavedNote(''), 4000)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3" data-testid="live-register">
      {/* ─── Toolbar: date + counts + bulk actions ─── */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Session date</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="bg-[#0a0a0a] border border-[#1e1e1e] text-white text-sm rounded-lg px-3 py-1.5 [color-scheme:dark] focus:border-[#4ecde6] focus:outline-none"
              data-testid="live-register-date"
            />
          </div>
          <div className="text-xs text-white/55 leading-snug" data-testid="live-register-counts">
            <strong className="text-white">{counts.total}</strong> enrolled ·{' '}
            <strong className="text-emerald-400">{counts.present}</strong> present ·{' '}
            <strong className="text-red-400">{counts.absent}</strong> absent
            {counts.unmarked > 0 && <> · <strong className="text-amber-400">{counts.unmarked}</strong> unmarked</>}
            {existingLoaded && Object.keys(attendance).length > 0 && Object.values(attendance).some((s) => s !== 'unmarked') && (
              <div className="text-[10px] text-white/40 mt-0.5">Existing register loaded · edit and re-save</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={markAllPresent}
            disabled={players.length === 0}
            data-testid="live-register-mark-all"
            className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ✓ All present
          </button>
          <button
            type="button"
            onClick={resetAll}
            disabled={Object.keys(attendance).length === 0}
            data-testid="live-register-reset"
            className="px-3 py-2 rounded-lg text-xs font-bold bg-white/[0.04] text-white/80 border border-white/10 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ─── Trial guests block (informational) ─── */}
      {trialsToday.length > 0 && (
        <div
          className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4 space-y-2"
          data-testid="live-register-trial-guests"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-300/90 font-bold">Trial guests today</span>
            <span className="text-[10px] text-white/40">{trialsToday.length} expected</span>
          </div>
          {trialsToday.map((t) => (
            <div
              key={t.id}
              data-testid="live-register-trial-row"
              className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{t.child_name}</span>
                  {t.child_age != null && <span className="text-[10px] text-white/50">age {t.child_age}</span>}
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Trial · {t.status}
                  </span>
                </div>
                <p className="text-xs text-white/55 mt-0.5">
                  Parent: <span className="text-white/80">{t.parent_name}</span>
                  {t.parent_phone && <> · <a href={`tel:${t.parent_phone}`} className="text-amber-300/80 hover:text-amber-300">{t.parent_phone}</a></>}
                  {!t.parent_phone && t.parent_email && <> · <span className="text-white/60">{t.parent_email}</span></>}
                </p>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-white/40">
            Trial guests aren&apos;t on the attendance table — mark them Attended / No Show on the Trials page after the session.
          </p>
        </div>
      )}

      {/* ─── Player list ─── */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Enrolled players</h2>
          <span className="text-[11px] text-white/40">{players.length} on register</span>
        </div>

        {players.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-sm text-white/55">No players enrolled in this class yet.</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {players.map((p) => {
              const state = attendance[p.id] || 'unmarked'
              const age = ageFromDob(p.date_of_birth)
              const hasMedical = !!(p.medical_info && p.medical_info.trim())
              const emergencyName = p.emergency_contact_name
              const emergencyPhone = p.emergency_contact_phone
              const initials = `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}`.toUpperCase()

              return (
                <div
                  key={p.id}
                  data-testid="live-register-row"
                  data-player-id={p.id}
                  data-state={state}
                  className={`rounded-xl border p-3 transition-colors ${
                    state === 'present' ? 'bg-emerald-500/5 border-emerald-500/30'
                    : state === 'absent' ? 'bg-red-500/5 border-red-500/30'
                    : 'bg-[#0a0a0a] border-[#1e1e1e]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Sprint 11b — left zone is now a button that opens the
                        Player Quick Drawer. The Present/Absent buttons remain
                        siblings to the right so taps on them never bubble. */}
                    <button
                      type="button"
                      onClick={() => setOpenPlayerId(p.id)}
                      data-testid="live-register-row-open"
                      aria-label={`Open quick view for ${p.first_name} ${p.last_name}`}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left rounded-lg p-0 -m-0 hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4ecde6]/50"
                    >
                      {/* Photo or initials */}
                      <span className="shrink-0">
                        {p.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.photo_url}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover border border-[#1e1e1e]"
                            data-testid="live-register-row-photo"
                          />
                        ) : (
                          <span
                            className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border ${
                              state === 'present' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : state === 'absent' ? 'bg-red-500/20 text-red-300 border-red-500/30'
                              : 'bg-[#4ecde6]/10 text-[#4ecde6] border-[#4ecde6]/20'
                            }`}
                            data-testid="live-register-row-initials"
                          >
                            {initials || '?'}
                          </span>
                        )}
                      </span>

                      {/* Name + meta */}
                      <span className="min-w-0 flex-1 block">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">
                            {p.first_name} {p.last_name}
                          </span>
                          {age != null && <span className="text-[11px] text-white/45">age {age}</span>}
                          {hasMedical && (
                            <span
                              data-testid="live-register-row-medical"
                              title={p.medical_info as string}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40"
                            >
                              ⚠ Medical
                            </span>
                          )}
                        </span>
                        {(emergencyName || emergencyPhone) && (
                          <span
                            className="block text-[11px] text-white/50 mt-0.5"
                            data-testid="live-register-row-emergency"
                          >
                            🚨 Emergency:{' '}
                            {emergencyName && <span className="text-white/70">{emergencyName}</span>}
                            {emergencyName && emergencyPhone && ' · '}
                            {emergencyPhone && (
                              <span
                                className="text-[#4ecde6]"
                                data-testid="live-register-row-emergency-tel"
                              >
                                {emergencyPhone}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>

                    {/* Present / Absent buttons — siblings of the drawer
                        opener button so their clicks never bubble up. */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOne(p.id, 'present') }}
                        data-testid="live-register-row-present"
                        aria-label={`Mark ${p.first_name} present`}
                        className={`w-12 h-10 sm:w-14 rounded-lg text-sm font-bold transition-all ${
                          state === 'present'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105'
                            : 'bg-emerald-500/10 text-emerald-300/70 hover:bg-emerald-500/20 hover:text-emerald-300'
                        }`}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOne(p.id, 'absent') }}
                        data-testid="live-register-row-absent"
                        aria-label={`Mark ${p.first_name} absent`}
                        className={`w-12 h-10 sm:w-14 rounded-lg text-sm font-bold transition-all ${
                          state === 'absent'
                            ? 'bg-red-500 text-white shadow-md shadow-red-500/30 scale-105'
                            : 'bg-red-500/10 text-red-300/70 hover:bg-red-500/20 hover:text-red-300'
                        }`}
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Sticky save bar ─── */}
      {players.length > 0 && (
        <div
          className="sticky bottom-0 z-10 bg-[#141414] border border-[#1e1e1e] rounded-2xl p-3 flex items-center justify-between gap-3"
          data-testid="live-register-save-bar"
        >
          <div className="text-xs text-white/55">
            {counts.unmarked === counts.total ? (
              <>Tap ✓ or ✗ for each player to start</>
            ) : (
              <><strong className="text-white">{counts.present + counts.absent}</strong> of {counts.total} marked</>
            )}
            {savedNote && (
              <div
                className={`text-[11px] mt-0.5 font-semibold ${savedNote.startsWith('Saved') ? 'text-emerald-400' : 'text-red-300'}`}
                data-testid="live-register-saved-note"
              >
                {savedNote}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || counts.present + counts.absent === 0}
            data-testid="live-register-save"
            className="px-5 py-2.5 rounded-full text-sm font-bold bg-[#4ecde6] text-black hover:bg-[#3dbcd5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save register'}
          </button>
        </div>
      )}

      {/* ─── Sprint 11b — Player Quick Drawer ─── */}
      <PlayerQuickDrawer
        player={openPlayerId ? (players.find((p) => p.id === openPlayerId) ?? null) : null}
        groupId={groupId}
        groupName={groupName}
        organisationId={orgId}
        attendance={openPlayerId ? (attendance[openPlayerId] || 'unmarked') : 'unmarked'}
        onMark={(s) => { if (openPlayerId) setOne(openPlayerId, s) }}
        onClose={() => setOpenPlayerId(null)}
      />
    </div>
  )
}
