import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyOrgAdmins } from '@/lib/notify-admins'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Daily cron: tell an academy when trial bookings are sitting unconfirmed.
 *
 * WHY THIS EXISTS: nothing moves a trial off `pending` — an admin has to
 * click Confirm in /dashboard/trials. The academy is emailed once when the
 * trial is booked, and if that email is missed the lead is invisible
 * forever: every downstream automation (day-1 follow-up, conversion offer)
 * targets `attended` only, so an unconfirmed trial falls through all of it.
 * In production this stranded 10 of 34 trials, several for 5+ weeks.
 *
 * DELIBERATELY CONSERVATIVE:
 *  - Only nudges about trials whose session date has NOT yet passed, plus a
 *    short grace window. Chasing a parent's long-gone trial date is noise,
 *    and we never want an academy emailing someone about a session that
 *    happened a month ago.
 *  - Nudges at most once every NUDGE_INTERVAL_DAYS per organisation, tracked
 *    on the org's most recent nudge notification — never a daily drip.
 *  - Sends ONE digest per academy, not one email per trial.
 *  - Silent when there is nothing pending (the overwhelming majority of days).
 *
 * SAFETY: reads trial_bookings, writes only notifications (via
 * notifyOrgAdmins, which is best-effort and swallows its own errors).
 * It never changes a trial's status, never emails a parent, and never
 * touches billing.
 */

/** Don't nudge the same academy more often than this. */
const NUDGE_INTERVAL_DAYS = 3
/** Keep chasing for this many days after the requested trial date. */
const GRACE_DAYS = 2

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()
  const graceFloor = new Date(today)
  graceFloor.setDate(graceFloor.getDate() - GRACE_DAYS)
  const graceFloorIso = graceFloor.toISOString().split('T')[0]

  // Pending trials still worth acting on: session date today-ish or future.
  // Rows with no preferred_date are included — they're the most neglected.
  const { data: trials, error } = await supabase
    .from('trial_bookings')
    .select('id, child_name, parent_name, parent_email, preferred_date, created_at, organisation_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 })
  }

  const actionable = (trials || []).filter(
    (t) => !t.preferred_date || String(t.preferred_date) >= graceFloorIso
  )

  // Group by academy so each gets a single digest.
  const byOrg = new Map<string, typeof actionable>()
  for (const t of actionable) {
    if (!t.organisation_id) continue
    const list = byOrg.get(t.organisation_id) || []
    list.push(t)
    byOrg.set(t.organisation_id, list)
  }

  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - NUDGE_INTERVAL_DAYS)
  const cutoffIso = cutoff.toISOString()

  let nudged = 0
  let skippedRecent = 0

  for (const [orgId, list] of byOrg) {
    // Rate limit per academy — look for a nudge we already sent recently.
    const { data: recent } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'trial_pending_nudge')
      .gte('created_at', cutoffIso)
      .in(
        'user_id',
        (
          await supabase.from('profiles').select('id').eq('organisation_id', orgId).eq('role', 'admin')
        ).data?.map((p) => p.id) || ['00000000-0000-0000-0000-000000000000']
      )
      .limit(1)

    if (recent && recent.length > 0) {
      skippedRecent++
      continue
    }

    const oldest = list[0]
    const waitingDays = Math.max(
      0,
      Math.floor((today.getTime() - new Date(oldest.created_at).getTime()) / 86400000)
    )

    const names = list
      .slice(0, 5)
      .map((t) => t.child_name || t.parent_name || 'a child')
      .join(', ')
    const more = list.length > 5 ? ` and ${list.length - 5} more` : ''

    const title =
      list.length === 1
        ? `1 trial waiting to be confirmed`
        : `${list.length} trials waiting to be confirmed`

    const body =
      `${names}${more}. ` +
      (waitingDays >= 1
        ? `The oldest has been waiting ${waitingDays} day${waitingDays === 1 ? '' : 's'}. `
        : '') +
      `Confirm them so they get their reminders — unconfirmed trials don't receive any follow-up.`

    await notifyOrgAdmins({
      orgId,
      type: 'trial_pending_nudge',
      title,
      body,
      link: '/dashboard/trials',
      email: true,
    })
    nudged++
  }

  return NextResponse.json({
    ok: true,
    pendingTotal: (trials || []).length,
    actionable: actionable.length,
    academiesNudged: nudged,
    academiesSkippedRecentlyNudged: skippedRecent,
  })
}
