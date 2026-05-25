import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import ParentProfileEditor from './ParentProfileEditor'

export default async function ParentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: parents } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'parent')
    .order('full_name')

  // Get children
  const { data: players } = await supabase
    .from('players')
    .select('id, parent_id, first_name, last_name')

  const childrenByParent: Record<string, { id: string; first_name: string; last_name: string }[]> = {}
  for (const p of players || []) {
    if (!childrenByParent[p.parent_id]) childrenByParent[p.parent_id] = []
    childrenByParent[p.parent_id].push(p)
  }

  // Get payment summaries per parent
  const { data: payments } = await supabase
    .from('payments')
    .select('parent_id, amount, amount_paid, status')

  const paymentsByParent: Record<string, { due: number; paid: number; hasOverdue: boolean }> = {}
  for (const pay of payments || []) {
    if (!paymentsByParent[pay.parent_id]) paymentsByParent[pay.parent_id] = { due: 0, paid: 0, hasOverdue: false }
    paymentsByParent[pay.parent_id].due += Number(pay.amount)
    paymentsByParent[pay.parent_id].paid += Number(pay.amount_paid || 0)
    if (pay.status === 'overdue') paymentsByParent[pay.parent_id].hasOverdue = true
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Parents</h1>

      {(parents || []).length === 0 ? (
        <EmptyState message="No parents registered yet." />
      ) : (
        <div className="space-y-3">
          {(parents || []).map((p) => {
            const children = childrenByParent[p.id] || []
            const payInfo = paymentsByParent[p.id]
            const outstanding = payInfo ? payInfo.due - payInfo.paid : 0

            return (
              <Card key={p.id}>
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{p.full_name}</h3>
                      <div className="text-sm text-text-light">{p.email}</div>
                      {p.phone && <div className="text-sm text-text-light">{p.phone}</div>}
                      {p.address && <div className="text-sm text-text-light">{p.address}</div>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {p.phone && (
                          <a href={`tel:${p.phone}`} title="Call" className="text-white/40 hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          </a>
                        )}
                        {p.phone && (() => {
                          const digits = p.phone.replace(/[\s\-()]+/g, '')
                          const waNumber = digits.startsWith('+') ? digits.replace('+', '') : digits.startsWith('0') ? '44' + digits.slice(1) : digits
                          return (
                            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-white/40 hover:text-green-400 transition-colors">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                            </a>
                          )
                        })()}
                        {p.email && (
                          <a href={`mailto:${p.email}`} title="Email" className="text-white/40 hover:text-[#4ecde6] transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {payInfo && (
                        <div className={`text-sm font-medium ${outstanding > 0 ? (payInfo.hasOverdue ? 'text-danger' : 'text-warning') : 'text-accent'}`}>
                          {outstanding > 0 ? `£${outstanding.toFixed(0)} owed` : 'Paid up'}
                        </div>
                      )}
                      <div className="text-xs text-text-light">Joined {new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Children */}
                  {children.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {children.map((c) => (
                        <Link
                          key={c.id}
                          href={`/dashboard/players/${c.id}`}
                          className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                        >
                          {c.first_name} {c.last_name}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Secondary contact */}
                  {(p.secondary_contact_name || p.notes) && (
                    <div className="text-sm border-t border-border pt-2">
                      {p.secondary_contact_name && (
                        <p className="text-text-light">
                          <span className="font-medium text-text">Alt Contact:</span>{' '}
                          {p.secondary_contact_name}
                          {p.secondary_contact_phone && ` — ${p.secondary_contact_phone}`}
                        </p>
                      )}
                      {p.notes && (
                        <p className="text-text-light mt-1">
                          <span className="font-medium text-text">Notes:</span> {p.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Edit button */}
                  <ParentProfileEditor parent={p} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
