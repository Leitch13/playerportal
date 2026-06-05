import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import PrintButton from '../../PrintButton'
import RegisterTabs from '../Tabs'

export default async function BlankRegisterPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params

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

  const role = (profile?.role || 'parent') as UserRole
  if (role === 'parent') redirect('/dashboard/attendance')

  const orgId = profile?.organisation_id || ''

  // Fetch org details
  const { data: org } = await supabase
    .from('organisations')
    .select('name, logo_url')
    .eq('id', orgId)
    .single()

  // Fetch group details
  const { data: group } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, coach_id, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('id', groupId)
    .single()

  if (!group) redirect('/dashboard/attendance/register')

  const coach = group.coach as unknown as { full_name: string } | null

  // Fetch enrolled players (active)
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('player_id, player:players(id, first_name, last_name)')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const players = (enrolments || [])
    .map((e) => e.player as unknown as { id: string; first_name: string; last_name: string })
    .filter(Boolean)
    .sort((a, b) => {
      const nameA = `${a.last_name} ${a.first_name}`.toLowerCase()
      const nameB = `${b.last_name} ${b.first_name}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })

  const blankColumns = Array.from({ length: 8 }, (_, i) => i)

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 1cm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          nav, aside, header,
          [data-sidebar], [data-topbar],
          .no-print {
            display: none !important;
          }
          .print-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          .print-container * {
            color: black !important;
            border-color: #333 !important;
          }
          .register-table th {
            background: #e5e7eb !important;
            font-weight: 700 !important;
          }
          .register-table td, .register-table th {
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
          .register-table td.blank-cell {
            min-height: 24px !important;
            height: 24px !important;
          }
        }
      `}</style>

      {/* Screen controls */}
      <div className="no-print bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 text-white">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Blank Register</h1>
            <p className="text-sm text-white/60 mt-0.5">{group.name} — print and fill in by hand</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sprint 11a: Live / Report / Blank tabs so coaches don't lose context */}
            <RegisterTabs groupId={groupId} />
            <Link
              href="/dashboard/attendance/register"
              className="px-4 py-2 bg-white/[0.08] text-white text-sm font-medium rounded-xl hover:bg-white/[0.12] transition-colors"
            >
              Back
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>

      {/* Printable blank register */}
      <div className="print-container bg-white text-black p-6 lg:p-8 mt-4 no-print:rounded-2xl">
        {/* Header */}
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
            <div className="font-semibold">Blank Attendance Register</div>
            <div className="text-xs mt-1">Write the date in each column header</div>
          </div>
        </div>

        {/* Register table */}
        {players.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No players enrolled in this class.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="register-table w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-400 bg-gray-200 px-3 py-2 text-left font-bold min-w-[180px]">
                    Player
                  </th>
                  {blankColumns.map((i) => (
                    <th
                      key={i}
                      className="border border-gray-400 bg-gray-200 px-2 py-2 text-center font-semibold min-w-[70px]"
                    >
                      Date: ___/___
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => (
                  <tr key={player.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-3 py-2 font-medium">
                      {player.last_name}, {player.first_name}
                    </td>
                    {blankColumns.map((i) => (
                      <td
                        key={i}
                        className="blank-cell border border-gray-300 px-2 py-3 text-center"
                      >
                        &nbsp;
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes section */}
        <div className="mt-8">
          <h3 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1">Notes</h3>
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">&nbsp;</div>
            <div className="border-b border-gray-200 pb-4">&nbsp;</div>
            <div className="border-b border-gray-200 pb-4">&nbsp;</div>
            <div className="border-b border-gray-200 pb-4">&nbsp;</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-gray-300 flex items-center justify-between text-xs text-gray-500">
          <span>Total Players: <strong className="text-black">{players.length}</strong></span>
          <span>{org?.name || 'Academy'} — Class Register</span>
        </div>
      </div>
    </>
  )
}
