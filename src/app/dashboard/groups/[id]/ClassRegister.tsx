'use client'

/**
 * The class register.
 *
 * One list for running a session: tap the circle to mark a child here or away,
 * see their age and anything that needs noticing (a medical note, no membership,
 * a trial) before you tap, and tap the name for the parent's number, the
 * emergency contact and the rest. Sort by name or age, or show one age.
 *
 * It replaces a list that showed a name and the parent's name and nothing else;
 * marking attendance, printing and seeing who had paid were three other pages.
 * See src/lib/class-register.ts.
 *
 * Attendance is written to the same `attendance` table, in the same shape, as
 * the Attendance page, so the two always agree. A tap saves straight away.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SortBar from '@/components/SortBar'
import ClassRosterRow from './ClassRosterRow'
import { sortRoster, agesPresent, onlyAge, type RosterSort } from '@/lib/roster-sort'
import { hasMedicalNote } from '@/lib/camp-booking-details'
import { nextMark, countMarks, weekdayOf, registerCsv, type Mark } from '@/lib/class-register'

export interface RegisterChild {
  enrolmentId: string
  playerId: string
  firstName: string
  lastName: string
  age: number | null
  dob: string | null
  medical: string | null
  emergencyName: string | null
  emergencyPhone: string | null
  parentId: string | null
  parentName: string | null
  parentPhone: string | null
  parentEmail: string | null
  /** "Paying", "No membership", "Payment problem", "Invite not confirmed"… and how loud to be about it. */
  membership: { label: string; tone: 'ok' | 'warn' | 'bad' | 'off' }
  isTrial: boolean
  otherActiveClasses: number
}

export interface RegisterTrialGuest {
  id: string
  childName: string
  childAge: number | null
  parentName: string | null
  parentPhone: string | null
  date: string | null
  paid: boolean
}

const TONE: Record<string, string> = {
  ok: 'bg-emerald-500/12 text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-300',
  bad: 'bg-red-500/15 text-red-300',
  off: 'bg-amber-500/15 text-amber-300',
}

export default function ClassRegister({
  groupId, organisationId, className, classDay, today, startDate, children: kids, trialGuests,
}: {
  groupId: string
  organisationId: string
  className: string
  classDay: string | null
  today: string
  /** The date the register opens on: today if the class runs today, else the last time it ran. */
  startDate: string
  children: RegisterChild[]
  trialGuests: RegisterTrialGuest[]
}) {
  const [date, setDate] = useState(startDate)
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<RosterSort>('name')
  const [ageOnly, setAgeOnly] = useState<number | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  // What is already marked for this date.
  useEffect(() => {
    let cancelled = false
    setLoaded(false); setError('')
    ;(async () => {
      const { data, error: e } = await createClient().from('attendance').select('player_id, present').eq('group_id', groupId).eq('session_date', date)
      if (cancelled) return
      if (e) setError('Could not load the register for that date. Please refresh.')
      const next: Record<string, Mark> = {}
      for (const r of (data || []) as { player_id: string; present: boolean }[]) next[r.player_id] = r.present ? 'present' : 'absent'
      setMarks(next); setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [groupId, date])

  async function save(playerIds: string[], to: Mark) {
    const before = marks
    setError(''); setSaving(playerIds.length === 1 ? playerIds[0] : 'all')
    setMarks((m) => { const n = { ...m }; for (const id of playerIds) { if (to === 'unmarked') delete n[id]; else n[id] = to } return n })
    const supabase = createClient()
    const res = to === 'unmarked'
      ? await supabase.from('attendance').delete().eq('group_id', groupId).eq('session_date', date).in('player_id', playerIds)
      : await supabase.from('attendance').upsert(
          playerIds.map((id) => ({ player_id: id, group_id: groupId, session_date: date, present: to === 'present', organisation_id: organisationId })),
          { onConflict: 'player_id,group_id,session_date' },
        )
    if (res.error) { setMarks(before); setError('That didn’t save. Check your signal and try again.') }
    setSaving(null)
  }

  const ages = useMemo(() => agesPresent(kids, (c) => c.age), [kids])
  const shown = useMemo(
    () => sortRoster(onlyAge(kids, ageOnly, (c) => c.age), sort, (c) => `${c.firstName} ${c.lastName}`, (c) => c.age),
    [kids, ageOnly, sort],
  )
  const counts = countMarks(kids.map((c) => c.playerId), marks)
  const guests = trialGuests.filter((t) => t.date === date)
  const offDay = !!classDay && weekdayOf(date) !== classDay
  const unmarkedIds = kids.filter((c) => !marks[c.playerId]).map((c) => c.playerId)

  function downloadCsv() {
    const rows: (string | number | null)[][] = [['Child', 'Age', 'Date of birth', date, 'Parent', 'Phone', 'Email', 'Emergency contact', 'Emergency phone', 'Medical', 'Membership']]
    for (const c of sortRoster(kids, 'name', (k) => `${k.firstName} ${k.lastName}`, (k) => k.age)) {
      rows.push([`${c.firstName} ${c.lastName}`.trim(), c.age, c.dob, marks[c.playerId] === 'present' ? 'Here' : marks[c.playerId] === 'absent' ? 'Away' : '', c.parentName, c.parentPhone, c.parentEmail, c.emergencyName, c.emergencyPhone, c.medical, c.membership.label])
    }
    const url = URL.createObjectURL(new Blob([registerCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${className.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-register-${date}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const detail = (label: string, value: React.ReactNode) => value
    ? <div className="flex gap-3 py-1"><dt className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-white/35">{label}</dt><dd className="min-w-0 flex-1 break-words text-[13px] text-white/85">{value}</dd></div>
    : null
  const tel = (n: string) => <a href={`tel:${n.replace(/\s+/g, '')}`} className="font-semibold text-[#4ecde6] underline-offset-2 hover:underline">{n}</a>

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1d2c42] bg-[#0f1a2b]" data-testid="class-register">
      {/* The date, and what the register says for it */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <label htmlFor="register-date" className="text-xs font-semibold text-white/60">Register for</label>
          <input id="register-date" type="date" value={date} max={today} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setOpenId(null) } }}
            data-testid="register-date" className="rounded-lg border border-[#1d2c42] bg-[#080e18] px-2 py-1.5 text-sm text-white [color-scheme:dark] focus:border-[#4ecde6]/50 focus:outline-none" />
        </div>
        <span className="text-xs text-white/60" data-testid="register-count">
          <span className="font-semibold text-emerald-300">{counts.present} here</span>
          {counts.absent > 0 && <> · <span className="font-semibold text-red-300">{counts.absent} away</span></>}
          {counts.unmarked > 0 && <> · {counts.unmarked} not marked</>}
        </span>
      </div>

      <div className="space-y-2 px-4 py-3 sm:px-5">
        {offDay && <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200" data-testid="register-offday">This class runs on {classDay}s, and that date is a {weekdayOf(date)}. You can still mark it.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SortBar sort={sort} onSort={setSort} ages={ages} age={ageOnly} onAge={setAgeOnly} options={['name', 'youngest', 'oldest']} testid="register-sort" />
          <div className="flex flex-wrap items-center gap-1.5">
            {unmarkedIds.length > 0 && (
              <button type="button" onClick={() => save(unmarkedIds, 'present')} disabled={!loaded || saving !== null} data-testid="register-all-here"
                className="rounded-lg bg-[#4ecde6] px-3 py-1.5 text-xs font-bold text-[#04141a] transition hover:brightness-105 disabled:opacity-50">
                {unmarkedIds.length === kids.length ? 'Mark everyone here' : `Mark the other ${unmarkedIds.length} here`}
              </button>
            )}
            <Link href={`/dashboard/attendance/register/${groupId}`} className="rounded-lg border border-[#1d2c42] px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white">Print</Link>
            <button type="button" onClick={downloadCsv} data-testid="register-export" className="rounded-lg border border-[#1d2c42] px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white">Export</button>
          </div>
        </div>
        <p className="text-[11px] text-white/35">Tap the circle: once for here, twice for away, again to clear. Tap a name for their details.</p>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" data-testid="register-error">{error}</p>}
      </div>

      <ul className="border-t border-white/[0.06]" data-testid="register-list">
        {shown.map((c) => {
          const mark: Mark = marks[c.playerId] || 'unmarked', open = openId === c.playerId
          const name = `${c.firstName} ${c.lastName}`.trim()
          const flags: { text: string; cls: string }[] = []
          if (hasMedicalNote(c.medical)) flags.push({ text: 'Medical note', cls: 'text-amber-300' })
          if (c.membership.tone !== 'ok') flags.push({ text: c.membership.label, cls: c.membership.tone === 'bad' ? 'text-red-300' : 'text-amber-300/90' })
          if (c.isTrial) flags.push({ text: 'On a trial', cls: 'text-[#9fe3f1]' })
          return (
            <li key={c.playerId} className="border-t border-white/[0.05] first:border-t-0">
              <div className="flex items-center gap-3 px-4 py-2 sm:px-5">
                <button type="button" onClick={() => save([c.playerId], nextMark(mark))} disabled={!loaded || saving === c.playerId || saving === 'all'}
                  aria-label={mark === 'present' ? `${name} is here. Tap to mark away.` : mark === 'absent' ? `${name} is away. Tap to clear.` : `Mark ${name} here`}
                  data-testid="register-mark" data-mark={mark}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors disabled:opacity-50 ${
                    mark === 'present' ? 'border-emerald-400 bg-emerald-400 text-[#04141a]' : mark === 'absent' ? 'border-red-400 bg-red-400/90 text-[#1a0505]' : 'border-white/25 text-transparent hover:border-white/50'
                  }`}>
                  {mark === 'absent' ? '✕' : '✓'}
                </button>
                <button type="button" onClick={() => setOpenId(open ? null : c.playerId)} aria-expanded={open} data-testid="register-name" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white">{name}</span>
                    {flags.length > 0 && <span className="block truncate text-[11px]">{flags.map((f, i) => <span key={f.text} className={f.cls}>{i > 0 ? ' · ' : ''}{f.text}</span>)}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-white/45" data-testid="register-age">{c.age ?? '—'}</span>
                    <span className={`text-xs text-white/35 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                  </span>
                </button>
              </div>
              {open && (
                <div className="mb-2.5 ml-[60px] mr-4 rounded-lg border border-white/[0.07] bg-[#080e18] px-3 py-2 sm:mr-5" data-testid="register-details">
                  <dl>
                    {detail('Age', c.age != null ? `${c.age}${c.dob ? ` (born ${new Date(c.dob + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })})` : ''}` : <span className="text-amber-200/80">No date of birth on record</span>)}
                    {detail('Parent', c.parentName)}
                    {detail('Phone', c.parentPhone ? tel(c.parentPhone) : <span className="text-amber-200/80">None on record</span>)}
                    {detail('Email', c.parentEmail ? <a href={`mailto:${c.parentEmail}`} className="text-[#4ecde6] underline-offset-2 hover:underline">{c.parentEmail}</a> : null)}
                    {detail('Emergency', c.emergencyPhone ? <>{c.emergencyName ? `${c.emergencyName} · ` : ''}{tel(c.emergencyPhone)}</> : <span className="text-amber-200/80">None on record</span>)}
                    {detail('Medical', hasMedicalNote(c.medical) ? <span className="text-amber-200">{c.medical}</span> : c.medical ? c.medical : <span className="text-amber-200/80">Not answered</span>)}
                    {detail('Membership', <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[c.membership.tone]}`}>{c.membership.label}</span>)}
                  </dl>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2">
                    <Link href={`/dashboard/players/${c.playerId}`} className="rounded-lg border border-[#1d2c42] px-2.5 py-1 text-xs font-semibold text-white/75 hover:text-white">Open profile</Link>
                    {c.parentId && <Link href={`/dashboard/messages?recipients=${encodeURIComponent(c.parentId)}`} className="rounded-lg border border-[#1d2c42] px-2.5 py-1 text-xs font-semibold text-white/75 hover:text-white">Message parent</Link>}
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-white/40">Move or remove
                      <ClassRosterRow menuOnly enrolmentId={c.enrolmentId} playerId={c.playerId} playerFirstName={c.firstName} playerLastName={c.lastName} playerPhotoUrl={null}
                        parentId={c.parentId} parentName={c.parentName} className={className} otherActiveClasses={c.otherActiveClasses} groupId={groupId} organisationId={organisationId} />
                    </span>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {guests.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-3 sm:px-5" data-testid="register-trials">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9fe3f1]">Trial today · {guests.length}</p>
          <ul className="space-y-1.5">
            {guests.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-white">{t.childName}{t.childAge != null ? <span className="text-white/45"> · {t.childAge}</span> : null}{t.paid ? <span className="text-emerald-300/90"> · paid</span> : null}</span>
                <span className="shrink-0 text-xs text-white/55">{t.parentPhone ? tel(t.parentPhone) : t.parentName}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-white/35">Mark trial children attended or no-show on the <Link href="/dashboard/trials" className="text-[#4ecde6]">Trials</Link> page.</p>
        </div>
      )}
    </div>
  )
}
