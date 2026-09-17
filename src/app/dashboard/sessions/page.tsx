import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminClient, getCoaches, getVenues, hhmm, fmtDate, gbp, DAY } from '@/lib/one-to-one/db'
import { creditBalance, monthLabel } from '@/lib/one-to-one/money'
import { monthStart, nextMonthStart, todayLondon } from '@/lib/one-to-one/time'
import ParentSessions from './ParentSessions'

export const dynamic = 'force-dynamic'

// The parent's own page: their children's regular 1-2-1 slots, this month and
// next, the credit on their account, and what's owed. They can decline a date.
// Nothing else on the timetable is theirs to change.
export default async function ParentSessionsPage({ searchParams }: { searchParams: Promise<{ setup?: string; paid?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!profile) redirect('/dashboard')
  const admin = adminClient()
  const orgId = profile.organisation_id as string
  const today = todayLondon()
  const thisMonth = monthStart(today), next = nextMonthStart(today)

  const [slots, sessions, charges, credit, coaches, venues, org] = await Promise.all([
    admin.from('regular_slots').select('*, player:players(first_name, last_name)').eq('parent_id', user.id).in('status', ['pending', 'active', 'paused']).order('weekday'),
    admin.from('coaching_sessions').select('*, player:players(first_name)').eq('parent_id', user.id).gte('session_date', thisMonth).order('session_date').order('start_minutes'),
    admin.from('coaching_charges').select('*').eq('parent_id', user.id).order('billing_month', { ascending: false }).limit(4),
    creditBalance(admin, orgId, user.id), getCoaches(admin, orgId), getVenues(admin, orgId),
    admin.from('organisations').select('name').eq('id', orgId).single(),
  ])
  const cname = (id: string) => coaches.find((c) => c.id === id)?.full_name?.split(' ')[0] || 'Coach'
  const vname = (id: string) => venues.find((v) => v.id === id)?.name || ''

  return (
    <ParentSessions
      academy={(org.data?.name as string) || 'Your academy'}
      today={today}
      creditPence={credit}
      notice={sp.setup === 'done' ? 'Slot set up and paid. Thanks.' : sp.setup === 'cancelled' ? 'Payment cancelled. Ask the academy for a new link when you\'re ready.' : sp.paid === '1' ? 'Paid. Thank you.' : null}
      slots={(slots.data ?? []).map((s) => ({
        id: s.id, child: s.player ? `${s.player.first_name}` : 'Your child', status: s.status,
        label: `${DAY[s.weekday]}s ${hhmm(s.start_minutes)} · ${vname(s.venue_id)} · with ${cname(s.coach_id)}`, pricePence: s.price_pence,
        type: s.session_type === 'two_to_one' ? '2-to-1' : '1-to-1',
      }))}
      months={[thisMonth, next].map((m) => ({
        month: m, label: monthLabel(m),
        charge: (charges.data ?? []).find((c) => c.billing_month === m) ? {
          id: (charges.data ?? []).find((c) => c.billing_month === m)!.id,
          status: (charges.data ?? []).find((c) => c.billing_month === m)!.status,
          amountPence: (charges.data ?? []).find((c) => c.billing_month === m)!.amount_pence,
          creditPence: (charges.data ?? []).find((c) => c.billing_month === m)!.credit_applied_pence,
          attempts: (charges.data ?? []).find((c) => c.billing_month === m)!.attempt_count,
        } : null,
        sessions: (sessions.data ?? []).filter((s) => s.session_date >= m && s.session_date < (m === thisMonth ? next : nextMonthStart(next)) && s.source !== 'adhoc').map((s) => ({
          id: s.id, date: s.session_date, dateLabel: fmtDate(s.session_date), time: hhmm(s.start_minutes), child: s.player?.first_name || 'Your child',
          coach: cname(s.coach_id), venue: vname(s.venue_id), status: s.status, chargeState: s.charge_state, pricePence: s.price_pence, declineTier: s.decline_tier,
          canDecline: s.status === 'scheduled' && s.session_date >= today,
        })),
      }))}
      gbp={gbp}
    />
  )
}
