/**
 * Sprint 11a — printable monthly attendance report.
 *
 * This is the page that USED to live at
 *   /dashboard/attendance/register/[groupId]
 * before Sprint 11a moved the route to the live taking experience.
 *
 * Code identical to the pre-Sprint-11a version save for:
 *   • the import path for PrintButton is now ../../PrintButton (one
 *     directory deeper),
 *   • a Tabs strip is rendered at the top of the screen controls so
 *     coaches can flip back to Live / Blank without losing the class
 *     context.
 *
 * Everything else — date-range form, matrix table, trial guests block,
 * print stylesheet, footer / legend, attendance % math — is preserved
 * byte-for-byte from the previous register page. Anyone who bookmarked
 * the printable will land here once they update the URL with a `/report`
 * suffix or hit the Report tab from the Live page.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import PrintButton from '../../PrintButton'
import RegisterTabs from '../Tabs'

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function RegisterReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { groupId } = await params
  const query = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard/attendance')

  const orgId = profile?.organisation_id || ''

  // Org details
  const { data: org } = await supabase
    .from('organisations')
    .select('name, logo_url')
    .eq('id', orgId)
    .single()

  // Group details
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, coach_id, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('id', groupId)
    .single()

  if (!group) redirect('/dashboard/attendance/register')

  const coach = group.coach as unknown as { full_name: string } | null

  // Date range
  const defaultRange = getMonthRange()
  const from = query.from || defaultRange.from
  const to = query.to || defaultRange.to

  // Enrolled players
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('player_id, player:players(id, first_name, last_name)')
    .eq('group_id', groupId)
    .eq('status', 'active')

  // Trial guests in the date range
  const { data: trialGuests } = await supabase
    .from('trial_bookings')
    .select('id, parent_name, parent_email, parent_phone, child_name, preferred_date, status')
    .eq('training_group_id', groupId)
    .in('status', ['pending', 'confirmed', 'attended', 'no_show'])
    .gte('preferred_date', from)
    .lte('preferred_date', to)
    .order('preferred_date')

  const players = (enrolments || [])
    .map((e) => e.player as unknown as { id: string; first_name: string; last_name: string })
    .filter(Boolean)
    .sort((a, b) => {
      const nameA = `${a.last_name} ${a.first_name}`.toLowerCase()
      const nameB = `${b.last_name} ${b.first_name}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })

  const playerIds = players.map((p) => p.id)
  const { data: attendanceRecords } = playerIds.length > 0
    ? await supabase
        .from('attendance')
        .select('player_id, session_date, present')
        .eq('group_id', groupId)
        .in('player_id', playerIds)
        .gte('session_date', from)
        .lte('session_date', to)
        .order('session_date')
    : { data: [] as { player_id: string; session_date: string; present: boolean }[] }

  const sessionDatesSet = new Set<string>()
  for (const r of attendanceRecords || []) sessionDatesSet.add(r.session_date)
  const sessionDates = Array.from(sessionDatesSet).sort()

  const attendanceMap = new Map<string, Map<string, boolean>>()
  for (const r of attendanceRecords || []) {
    if (!attendanceMap.has(r.player_id)) attendanceMap.set(r.player_id, new Map())
    attendanceMap.get(r.player_id)!.set(r.session_date, r.present)
  }

  const totalPlayers = players.length
  const totalRecords = (attendanceRecords || []).length
  const totalPresent = (attendanceRecords || []).filter((r) => r.present).length
  const avgAttendance = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0

  const printedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      {/* Print styles — unchanged from pre-Sprint-11a */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, aside, header, [data-sidebar], [data-topbar], .no-print { display: none !important; }
          .print-container { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; color: black !important; }
          .print-container * { color: black !important; border-color: #333 !important; }
          .register-table th { background: #e5e7eb !important; font-weight: 700 !important; }
          .register-table td, .register-table th { padding: 4px 6px !important; font-size: 10px !important; }
        }
      `}</style>

      {/* Screen controls */}
      <div className="no-print bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 text-white">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Attendance Report</h1>
            <p className="text-sm text-white/60 mt-0.5">{group.name}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <RegisterTabs groupId={groupId} />
            <Link
              href="/dashboard/attendance/register"
              className="px-4 py-2 bg-white/5 border border-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              Back
            </Link>
            <PrintButton />
          </div>
        </div>

        {/* Date range form */}
        <form className="flex items-end gap-4 mb-6 flex-wrap">
          <div>
            <label className="block text-xs text-white/60 mb-1">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-[#4ecde6] text-[#0a0a0a] text-sm font-bold rounded-lg hover:bg-[#3dbcd5] transition-colors"
          >
            Update
          </button>
        </form>
      </div>

      {/* Printable register */}
      <div className="print-container bg-white text-black p-6 lg:p-8 mt-4 rounded-2xl shadow-lg print:shadow-none print:rounded-none print:mt-0">
        <div className="flex items-start justify-between mb-6 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-xl font-bold">{org?.name || 'Academy'}</h1>
            <h2 className="text-lg font-semibold mt-1">{group.name}</h2>
            <div className="text-sm mt-1 space-y-0.5 text-gray-700">
              {group.day_of_week && <div>Day: {group.day_of_week}</div>}
              {group.time_slot && <div>Time: {group.time_slot}</div>}
              {group.location && <div>Location: {group.location}</div>}
              {coach?.full_name && <div>Coach: {coach.full_name}</div>}
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <div className="font-semibold">Attendance Register</div>
            <div>{formatDateFull(from)} &mdash; {formatDateFull(to)}</div>
          </div>
        </div>

        {(trialGuests || []).length > 0 && (
          <div className="mb-6" data-testid="register-trial-guests">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-700">Trial Guests</h3>
            <table className="register-table w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-gray-400 bg-amber-100 px-2 py-1.5 text-left font-bold">Child</th>
                  <th className="border border-gray-400 bg-amber-100 px-2 py-1.5 text-left font-bold">Parent</th>
                  <th className="border border-gray-400 bg-amber-100 px-2 py-1.5 text-left font-bold">Contact</th>
                  <th className="border border-gray-400 bg-amber-100 px-2 py-1.5 text-left font-bold">Trial date</th>
                  <th className="border border-gray-400 bg-amber-100 px-2 py-1.5 text-left font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(trialGuests || []).map((t) => (
                  <tr key={t.id} className="bg-amber-50" data-testid="register-trial-row">
                    <td className="border border-gray-300 px-2 py-1.5 font-medium">{t.child_name}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{t.parent_name}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-gray-700">{t.parent_phone || t.parent_email}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{t.preferred_date ? formatDate(t.preferred_date) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-1.5">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900">
                        Trial · {String(t.status || 'pending')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-500 mt-1">
              Trial guests are not on the attendance table. Mark them Attended / No Show on the Trials page after the session.
            </p>
          </div>
        )}

        {players.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No players enrolled in this class.</div>
        ) : sessionDates.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No attendance records found for this date range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="register-table w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-gray-400 bg-gray-200 px-2 py-1.5 text-left font-bold sticky left-0 bg-gray-200 min-w-[160px]">Player</th>
                  {sessionDates.map((date) => (
                    <th key={date} className="border border-gray-400 bg-gray-200 px-1.5 py-1.5 text-center font-semibold min-w-[52px]">
                      {formatDate(date)}
                    </th>
                  ))}
                  <th className="border border-gray-400 bg-gray-200 px-2 py-1.5 text-center font-bold min-w-[50px]">%</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => {
                  const playerAttendance = attendanceMap.get(player.id)
                  const sessionsRecorded = sessionDates.filter((d) => playerAttendance?.has(d)).length
                  const sessionsPresent = sessionDates.filter((d) => playerAttendance?.get(d) === true).length
                  const pct = sessionsRecorded > 0 ? Math.round((sessionsPresent / sessionsRecorded) * 100) : 0
                  return (
                    <tr key={player.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-2 py-1.5 font-medium sticky left-0 bg-inherit">
                        {player.last_name}, {player.first_name}
                      </td>
                      {sessionDates.map((date) => {
                        const record = playerAttendance?.get(date)
                        let symbol = '-'
                        let cellClass = 'text-gray-300'
                        if (record === true) { symbol = '✓'; cellClass = 'text-green-700 font-bold' }
                        else if (record === false) { symbol = '✗'; cellClass = 'text-red-600 font-bold' }
                        return (
                          <td key={date} className={`border border-gray-300 px-1.5 py-1.5 text-center ${cellClass}`}>
                            {symbol}
                          </td>
                        )
                      })}
                      <td className={`border border-gray-300 px-2 py-1.5 text-center font-bold ${
                        pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {sessionsRecorded > 0 ? `${pct}%` : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-300 flex items-center justify-between text-xs text-gray-500">
          <div className="space-x-4">
            <span>Total Players: <strong className="text-black">{totalPlayers}</strong></span>
            <span>Sessions: <strong className="text-black">{sessionDates.length}</strong></span>
            <span>Average Attendance: <strong className="text-black">{avgAttendance}%</strong></span>
          </div>
          <div>Printed: {printedAt}</div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span><span className="text-green-700 font-bold">{'✓'}</span> Present</span>
          <span><span className="text-red-600 font-bold">{'✗'}</span> Absent</span>
          <span><span className="text-gray-300">-</span> No record</span>
        </div>
      </div>
    </>
  )
}
