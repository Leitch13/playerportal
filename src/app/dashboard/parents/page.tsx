import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import ParentProfileEditor from './ParentProfileEditor'

export default async function ParentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // CRITICAL: scope every query to the current admin's own org. RLS alone
  // isn't enough because super-admins bypass it — without this filter, a
  // super_admin opening their own academy's Parents page would see EVERY
  // org's parents in the system.
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  const [
    { data: parents },
    { data: players },
    { data: payments },
    { data: subs },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, address, secondary_contact_name, secondary_contact_phone, notes, created_at')
      .eq('organisation_id', orgId)
      .eq('role', 'parent')
      .order('full_name'),
    supabase
      .from('players')
      .select('id, parent_id, first_name, last_name')
      .eq('organisation_id', orgId),
    supabase
      .from('payments')
      .select('parent_id, amount, amount_paid, status')
      .eq('organisation_id', orgId),
    supabase
      .from('subscriptions')
      .select('parent_id, status, plan:subscription_plans(name, amount)')
      .eq('organisation_id', orgId),
  ])

  const childrenByParent: Record<string, { id: string; first_name: string; last_name: string }[]> = {}
  for (const p of players || []) {
    if (!childrenByParent[p.parent_id]) childrenByParent[p.parent_id] = []
    childrenByParent[p.parent_id].push(p as { id: string; first_name: string; last_name: string; parent_id: string })
  }

  const paymentsByParent: Record<string, { due: number; paid: number; hasOverdue: boolean }> = {}
  for (const pay of payments || []) {
    if (!paymentsByParent[pay.parent_id]) paymentsByParent[pay.parent_id] = { due: 0, paid: 0, hasOverdue: false }
    paymentsByParent[pay.parent_id].due += Number(pay.amount)
    paymentsByParent[pay.parent_id].paid += Number(pay.amount_paid || 0)
    if (pay.status === 'overdue') paymentsByParent[pay.parent_id].hasOverdue = true
  }

  type SubPlanRow = { name?: string; amount?: number }
  const subByParent: Record<string, { active: boolean; plan?: string; amount?: number; status: string }> = {}
  for (const s of subs || []) {
    const planRow = (s.plan as unknown as SubPlanRow) || {}
    const isActive = s.status === 'active' || s.status === 'trialing'
    const existing = subByParent[s.parent_id]
    if (!existing || (isActive && !existing.active)) {
      subByParent[s.parent_id] = { active: isActive, plan: planRow.name, amount: planRow.amount, status: s.status as string }
    }
  }

  const allParents = parents || []

  // Split & sort: paying first, then issues, then not-paid (newest first within each)
  const paying = allParents.filter(p => subByParent[p.id]?.active)
  const issues = allParents.filter(p => subByParent[p.id] && !subByParent[p.id].active)
  const notPaid = allParents.filter(p => !subByParent[p.id]).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const monthlyMRR = paying.reduce((sum, p) => sum + Number(subByParent[p.id]?.amount || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header + stats */}
      <div>
        <h1 className="text-2xl font-bold text-white">Parents</h1>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Total parents" value={allParents.length} accent="text-white" />
          <Stat label="Paying" value={paying.length} accent="text-emerald-400" sub={monthlyMRR ? `£${monthlyMRR.toFixed(0)}/mo` : undefined} />
          <Stat label="Not paid yet" value={notPaid.length} accent="text-white/50" />
        </div>
      </div>

      {allParents.length === 0 ? (
        <EmptyState message="No parents registered yet." />
      ) : (
        <div className="space-y-6">
          {paying.length > 0 && (
            <Section title="Active subscribers" count={paying.length}>
              {paying.map(p => (
                <ParentRow key={p.id} p={p} childrenList={childrenByParent[p.id] || []} sub={subByParent[p.id]} pay={paymentsByParent[p.id]} />
              ))}
            </Section>
          )}
          {issues.length > 0 && (
            <Section title="Needs attention" count={issues.length} accent="amber">
              {issues.map(p => (
                <ParentRow key={p.id} p={p} childrenList={childrenByParent[p.id] || []} sub={subByParent[p.id]} pay={paymentsByParent[p.id]} />
              ))}
            </Section>
          )}
          {notPaid.length > 0 && (
            <Section title="Not paid yet" count={notPaid.length}>
              {notPaid.map(p => (
                <ParentRow key={p.id} p={p} childrenList={childrenByParent[p.id] || []} sub={undefined} pay={paymentsByParent[p.id]} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent, sub }: { label: string; value: number; accent: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className={`text-2xl sm:text-3xl font-extrabold leading-none ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-emerald-400/70 mt-0.5 font-medium">{sub}</div>}
    </div>
  )
}

function Section({ title, count, accent, children }: { title: string; count: number; accent?: 'amber'; children: React.ReactNode }) {
  const color = accent === 'amber' ? 'text-amber-400' : 'text-white/60'
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className={`text-xs font-bold uppercase tracking-wider ${color}`}>{title}</h2>
        <span className="text-xs text-white/30">{count}</span>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05]">
        {children}
      </div>
    </section>
  )
}

type RowProps = {
  p: { id: string; full_name: string | null; email: string | null; phone: string | null; address: string | null; secondary_contact_name: string | null; secondary_contact_phone: string | null; notes: string | null; created_at: string }
  childrenList: { id: string; first_name: string; last_name: string }[]
  sub?: { active: boolean; plan?: string; amount?: number; status: string }
  pay?: { due: number; paid: number; hasOverdue: boolean }
}

function ParentRow({ p, childrenList, sub, pay }: RowProps) {
  const outstanding = pay ? pay.due - pay.paid : 0
  return (
    <div className="p-3 sm:p-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-sm sm:text-base truncate">{p.full_name || '(no name)'}</h3>
            {sub?.active ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1 h-1 rounded-full bg-emerald-400" /> Paying
              </span>
            ) : sub ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">{sub.status.replace('_', ' ')}</span>
            ) : null}
            {outstanding > 0 && (
              <span className={`text-[10px] font-semibold ${pay?.hasOverdue ? 'text-rose-400' : 'text-amber-400'}`}>£{outstanding.toFixed(0)} owed</span>
            )}
          </div>

          {sub?.active && sub.plan && (
            <div className="text-[11px] text-white/50 mt-0.5">{sub.plan}{sub.amount ? ` · £${Number(sub.amount).toFixed(0)}/mo` : ''}</div>
          )}

          <div className="text-xs text-white/40 mt-1 truncate">{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>

          {childrenList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {childrenList.map(c => (
                <Link key={c.id} href={`/dashboard/players/${c.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white/[0.06] text-white/80 font-medium hover:bg-white/[0.1] transition-colors">
                  ⚽ {c.first_name} {c.last_name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick-contact action buttons */}
        <div className="shrink-0 flex items-center gap-1">
          {p.phone && (
            <a href={`tel:${p.phone}`} title="Call" className="w-7 h-7 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </a>
          )}
          {p.phone && (() => {
            const digits = p.phone.replace(/[\s\-()]+/g, '')
            const waNumber = digits.startsWith('+') ? digits.replace('+', '') : digits.startsWith('0') ? '44' + digits.slice(1) : digits
            return (
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                className="w-7 h-7 rounded-md bg-white/[0.04] hover:bg-emerald-500/15 text-white/50 hover:text-emerald-400 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              </a>
            )
          })()}
          {p.email && (
            <a href={`mailto:${p.email}`} title="Email"
              className="w-7 h-7 rounded-md bg-white/[0.04] hover:bg-[#4ecde6]/15 text-white/50 hover:text-[#4ecde6] flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </a>
          )}
          <ParentProfileEditor parent={p} />
        </div>
      </div>

      {/* Optional secondary info (kept compact) */}
      {(p.secondary_contact_name || p.notes) && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] text-[11px] text-white/40 space-y-0.5">
          {p.secondary_contact_name && <div>Alt: {p.secondary_contact_name}{p.secondary_contact_phone ? ` · ${p.secondary_contact_phone}` : ''}</div>}
          {p.notes && <div className="italic">{p.notes}</div>}
        </div>
      )}
    </div>
  )
}
