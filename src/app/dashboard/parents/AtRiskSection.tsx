/**
 * Families Requiring Attention section — Parents List v2.
 *
 * Server-rendered. Shows the top 5 at-risk families with their badges
 * and quick actions. Only renders when:
 *   - the current filter is "all" (otherwise the chips ALREADY isolate
 *     the cohort, no need to repeat it)
 *   - there's at least 1 at-risk family to surface
 *
 * "Show all N →" link routes the user to ?filter=attention so the rest
 * of the cohort is reachable in one tap.
 */
import Link from 'next/link'
import type { ParentRowFacts } from '@/lib/parents-derive'

const BADGE_TONE: Record<string, string> = {
  rose:    'bg-rose-500/15    text-rose-300    border-rose-500/30',
  amber:   'bg-amber-500/15   text-amber-300   border-amber-500/30',
  sky:     'bg-sky-500/15     text-sky-300     border-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

export default function AtRiskSection({
  families,
  totalCount,
}: {
  families: ParentRowFacts[]
  totalCount: number
}) {
  if (families.length === 0) return null
  const top = families.slice(0, 5)

  return (
    <section className="bg-rose-500/[0.04] border border-rose-500/[0.20] rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-rose-300">
          ⚠ Families requiring attention
        </h2>
        <span className="text-xs text-white/40">{totalCount} {totalCount === 1 ? 'family' : 'families'}</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {top.map(f => {
          const waNumber = (f.parentPhone || '').replace(/[\s\-()+]+/g, '').replace(/^0/, '44')
          return (
            <div key={f.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start sm:items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/dashboard/parents/${f.id}`}
                  className="text-sm font-medium text-white hover:text-[#4ecde6] transition-colors"
                >
                  {f.parentName}
                </Link>
                <div className="text-[11px] text-white/40 mt-0.5">
                  {f.childCount} {f.childCount === 1 ? 'child' : 'children'}
                  {f.familyValue > 0 && <> · £{f.familyValue.toFixed(0)}/mo</>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {f.badges.filter(b => b.key !== 'sibling_eligible').map(b => (
                    <span
                      key={b.key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${BADGE_TONE[b.tone] || BADGE_TONE.amber}`}
                    >
                      <span aria-hidden>{b.emoji}</span>{b.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/dashboard/parents/${f.id}`}
                  title="View family"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
                >
                  👨‍👩‍👧
                </Link>
                <Link
                  href={`/dashboard/messages?to=${f.id}`}
                  title="Message"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
                >
                  ✉️
                </Link>
                {f.parentPhone && (
                  <>
                    <a
                      href={`tel:${f.parentPhone}`}
                      title="Call"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white transition-colors"
                    >📞</a>
                    <a
                      href={`https://wa.me/${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
                    >💬</a>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {totalCount > top.length && (
        <div className="pt-2 border-t border-white/[0.04]">
          <Link
            href="/dashboard/parents?filter=attention"
            className="text-xs font-semibold text-rose-300 hover:text-rose-200 transition-colors"
          >
            Show all {totalCount} →
          </Link>
        </div>
      )}
    </section>
  )
}
