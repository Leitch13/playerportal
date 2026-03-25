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
