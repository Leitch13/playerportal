import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ManualReminder from './ManualReminder'

export default async function RemindersPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: reminders } = await supabase
    .from('payment_reminders')
    .select(`
      id, reminder_type, sent_at, email_sent,
      profile:profiles!payment_reminders_profile_id_fkey(full_name, email),
      payment:payments!payment_reminders_payment_id_fkey(amount)
    `)
    .eq('organisation_id', orgId)
    .order('sent_at', { ascending: false })
    .limit(100)

  // Get parents with overdue payments for manual reminder
  const { data: overduePayments } = await supabase
    .from('payments')
    .select('id, amount, profile:profiles!payments_profile_id_fkey(id, full_name, email)')
    .eq('organisation_id', orgId)
    .in('status', ['overdue', 'pending'])

  const stats = {
    total: (reminders || []).length,
    day3: (reminders || []).filter(r => r.reminder_type === '3_day').length,
    day7: (reminders || []).filter(r => r.reminder_type === '7_day').length,
    day14: (reminders || []).filter(r => r.reminder_type === '14_day').length,
  }

  const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
    '3_day': { label: '3 Day', color: 'text-blue-400', bg: 'bg-blue-500/15' },
    '7_day': { label: '7 Day', color: 'text-amber-400', bg: 'bg-amber-500/15' },
    '14_day': { label: '14 Day', color: 'text-red-400', bg: 'bg-red-500/15' },
    'custom': { label: 'Manual', color: 'text-purple-400', bg: 'bg-purple-500/15' },
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Reminders</h1>
          <p className="text-white/40 text-sm mt-1">Track automated and manual payment reminders</p>
        </div>
        <ManualReminder
          orgId={orgId}
          overdueParents={(overduePayments || []).map(p => {
            const profile = p.profile as unknown as { id: string; full_name: string; email: string } | null
            return {
              paymentId: p.id,
              profileId: profile?.id || '',
              name: profile?.full_name || '',
              email: profile?.email || '',
              amount: Number(p.amount),
            }
          }).filter(p => p.profileId)}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center transition-all duration-200 hover:border-[#2a2a2a]">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-white/40 font-medium">Total Sent</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center transition-all duration-200 hover:border-[#2a2a2a]">
          <p className="text-2xl font-bold text-blue-400">{stats.day3}</p>
          <p className="text-xs text-white/40 font-medium">3-Day</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center transition-all duration-200 hover:border-[#2a2a2a]">
          <p className="text-2xl font-bold text-amber-400">{stats.day7}</p>
          <p className="text-xs text-white/40 font-medium">7-Day</p>
        </div>
        <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-4 text-center transition-all duration-200 hover:border-[#2a2a2a]">
          <p className="text-2xl font-bold text-red-400">{stats.day14}</p>
          <p className="text-xs text-white/40 font-medium">14-Day (Final)</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Parent</th>
                <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Type</th>
                <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase hidden md:table-cell">Sent</th>
                <th className="text-left px-4 py-3 font-medium text-white/50 text-xs uppercase">Email</th>
              </tr>
            </thead>
            <tbody>
              {(reminders || []).map(r => {
                const profile = r.profile as unknown as { full_name: string; email: string } | null
                const payment = r.payment as unknown as { amount: number } | null
                const cfg = typeConfig[r.reminder_type] || typeConfig.custom
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-white/40">{profile?.email || ''}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      £{Number(payment?.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 hidden md:table-cell">
                      {new Date(r.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      {r.email_sent ? (
                        <span className="text-emerald-400 text-xs font-semibold">Sent</span>
                      ) : (
                        <span className="text-white/40 text-xs">In-app only</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(!reminders || reminders.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="font-semibold text-white">No reminders sent yet</p>
                    <p className="text-xs mt-1">Automated reminders trigger at 3, 7, and 14 days overdue</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
