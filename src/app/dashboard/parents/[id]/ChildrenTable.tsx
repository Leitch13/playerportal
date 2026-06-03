/**
 * Children section for the Parent Detail page.
 *
 * Columns: Child · Status · Class · Attendance · Subscription
 * Each row links to /dashboard/players/{id} for full profile.
 *
 * Pure presentational. Data is pre-derived in the parent route's loader.
 */
import Link from 'next/link'
import PlayerAvatar from '@/components/PlayerAvatar'
import type { DerivedRowStatus, DerivedSubStatus } from '@/lib/players-derive'

export interface ChildRow {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  rowStatus: DerivedRowStatus
  subStatus: DerivedSubStatus
  className: string
  attendancePct: number | null
  lastAttendanceDays: number | null
}

const SUB_CHIP: Record<DerivedSubStatus, { label: string; emoji: string; cls: string }> = {
  active:    { label: 'Active',    emoji: '💳', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  past_due:  { label: 'Past due',  emoji: '⚠️', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  pending:   { label: 'Pending',   emoji: '⏳', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  cancelled: { label: 'Cancelled', emoji: '❌', cls: 'bg-white/[0.05] text-white/50 border-white/[0.10]' },
  none:      { label: 'No sub',    emoji: '·',  cls: 'bg-white/[0.04] text-white/40 border-white/[0.08]' },
}
const STATUS_CHIP: Record<DerivedRowStatus, { label: string; emoji: string; cls: string }> = {
  active:   { label: 'Active',   emoji: '🟢', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  pending:  { label: 'Pending',  emoji: '🟡', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  trial:    { label: 'Trial',    emoji: '🔵', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  paused:   { label: 'Paused',   emoji: '🟠', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  inactive: { label: 'Inactive', emoji: '·',  cls: 'bg-white/[0.04] text-white/40 border-white/[0.08]' },
}

export default function ChildrenTable({ rows }: { rows: ChildRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center text-white/50 text-sm">
        No children on this account.
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.06]">
              <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Child</th>
              <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Status</th>
              <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden md:table-cell">Class</th>
              <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider hidden sm:table-cell">Attendance</th>
              <th className="text-left py-2 px-3 font-medium text-white/60 text-[11px] uppercase tracking-wider">Subscription</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const status = STATUS_CHIP[r.rowStatus]
              const sub = SUB_CHIP[r.subStatus]
              return (
                <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3">
                    <Link href={`/dashboard/players/${r.id}`} className="flex items-center gap-2 text-[#4ecde6] hover:underline">
                      <PlayerAvatar photoUrl={r.photo_url} firstName={r.first_name} lastName={r.last_name} size="sm" />
                      <span className="font-medium">{r.first_name} {r.last_name}</span>
                    </Link>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${status.cls}`}>
                      <span aria-hidden>{status.emoji}</span>{status.label}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 hidden md:table-cell text-white/60 max-w-[260px] truncate" title={r.className}>{r.className || '—'}</td>
                  <td className="py-2.5 px-3 hidden sm:table-cell">
                    {r.attendancePct === null ? (
                      <span className="text-white/40">—</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-medium tabular-nums">{r.attendancePct}%</span>
                        {r.lastAttendanceDays !== null && (
                          <span className="text-[10px] text-white/40 tabular-nums">{r.lastAttendanceDays === 0 ? 'today' : `${r.lastAttendanceDays}d ago`}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${sub.cls}`}>
                      <span aria-hidden>{sub.emoji}</span>{sub.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
