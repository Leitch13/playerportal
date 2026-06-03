/**
 * §2 My Children — per-child summary so the parent instantly understands
 * "who is enrolled and where".
 *
 * For each child:
 *   • name + (age if DOB present)
 *   • count of active enrolments
 *   • sessions-per-week (sum across active enrolments' plans)
 *   • per-row actions: View Profile / View Reports (existing routes)
 *
 * Pure server component.
 */
import Link from 'next/link'

export interface ChildSummary {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  activeClassCount: number
  sessionsPerWeek: number      // sum across active enrolments
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export default function MyChildrenList({ children }: { children: ChildSummary[] }) {
  if (children.length === 0) {
    return (
      <section className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center" data-testid="my-children-empty">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50 mb-2">My children</h2>
        <p className="text-sm text-white/70 mb-4">No children added yet.</p>
        <Link
          href="/dashboard/children"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#4ecde6] text-[#0a0a0a] hover:bg-[#5edcf6] transition-colors"
        >
          Add your first child →
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-3" data-testid="my-children-list">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">My children</h2>
        <span className="text-xs text-white/40">{children.length} {children.length === 1 ? 'child' : 'children'}</span>
      </div>
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden divide-y divide-[#1e1e1e]">
        {children.map(c => {
          const age = computeAge(c.date_of_birth)
          return (
            <div key={c.id} className="p-4 flex items-center justify-between gap-3 flex-wrap hover:bg-white/[0.02] transition-colors" data-testid="my-children-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-semibold text-white truncate">
                    {c.first_name} {c.last_name}
                  </h3>
                  {age != null && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                      Age {age}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/55">
                  {c.activeClassCount > 0 ? (
                    <>
                      <strong className="text-white/75">{c.activeClassCount}</strong> {c.activeClassCount === 1 ? 'class' : 'classes'}
                      {c.sessionsPerWeek > 0 && <> · {c.sessionsPerWeek} sess/week</>}
                    </>
                  ) : (
                    <span className="italic text-white/40">No active classes</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/dashboard/players/${c.id}`}
                  className="text-xs font-semibold text-white/70 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all"
                >
                  View profile
                </Link>
                <Link
                  href={`/dashboard/players/${c.id}/report`}
                  className="text-xs font-semibold text-[#4ecde6] hover:text-[#7adeeb] px-3 py-1.5 rounded-lg bg-[#4ecde6]/8 border border-[#4ecde6]/30 hover:border-[#4ecde6]/50 transition-all"
                >
                  Reports →
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
