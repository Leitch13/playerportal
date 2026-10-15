import type { SupabaseClient } from '@supabase/supabase-js'
import { DAY, hhmm } from './db'
import { sendPriceChanged } from './emails'

/**
 * Email the family a regular's new price. Returns what the academy sees under Save:
 * who it went to, or why it couldn't go. Best-effort — the price is already saved.
 */
export async function emailPriceChange(admin: SupabaseClient, orgId: string, f: { slotId: string; parentId: string; playerId: string; weekday: number; start: number; sessionType: string; oldPence: number; newPence: number; today: string }): Promise<string> {
  try {
    const [{ data: parent }, { data: child }, { data: org }, { data: next }] = await Promise.all([
      admin.from('profiles').select('full_name, email').eq('id', f.parentId).maybeSingle(),
      admin.from('players').select('first_name').eq('id', f.playerId).maybeSingle(),
      admin.from('organisations').select('name').eq('id', orgId).single(),
      // The first date the new price applies to: the next scheduled, not-yet-paid session.
      admin.from('coaching_sessions').select('session_date').eq('regular_slot_id', f.slotId).eq('organisation_id', orgId)
        .gte('session_date', f.today).eq('status', 'scheduled').eq('charge_state', 'unpaid').order('session_date').limit(1).maybeSingle(),
    ])
    if (!parent?.email) return 'New price saved. The family has no email address, so tell them yourself.'
    const fromDate = (next?.session_date as string | undefined) ?? (() => { const [y, m] = f.today.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) })()
    const month = fromDate.slice(0, 7)
    const [yy, mm] = month.split('-').map(Number)
    const nextMonth = new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 10)
    // The dates at the new price in that first month (scheduled, not yet paid), listed in the email.
    const { data: dates } = await admin.from('coaching_sessions').select('session_date, start_minutes').eq('regular_slot_id', f.slotId)
      .eq('organisation_id', orgId).eq('status', 'scheduled').eq('charge_state', 'unpaid')
      .gte('session_date', fromDate).lt('session_date', nextMonth).order('session_date')
    const academy = (org?.name as string) || 'Your academy'
    await sendPriceChanged({
      academy, to: parent.email as string, parentName: (parent.full_name as string | null) ?? null, childName: (child?.first_name as string) || 'your child',
      slotLabel: `${DAY[f.weekday]} ${hhmm(f.start)} ${f.sessionType === 'two_to_one' ? '2-to-1' : '1-2-1'}`,
      oldPence: f.oldPence, newPence: f.newPence, fromDate,
      monthLabel: new Date(`${month}-15T12:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric' }), dates: (dates ?? []).map((d) => ({ date: d.session_date as string, startMinutes: d.start_minutes as number })),
    })
    return `New price saved and emailed to ${parent.email}.`
  } catch (e) {
    console.error('[one-to-one] price change email failed', { slot: f.slotId, error: e instanceof Error ? e.message : String(e) })
    return 'New price saved, but the email to the family did not send. Tell them yourself.'
  }
}

