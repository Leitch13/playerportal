import { createClient } from '@supabase/supabase-js'

/**
 * Fan an in-app notification out to every admin of an organisation.
 *
 * Built for the "tell me when ANYTHING happens" ask from academy owners:
 * bookings, class moves, cancellations, payments — the events that used to
 * happen silently. Uses the service role so it works regardless of who
 * triggered the event (parent session, webhook, cron).
 *
 * ALWAYS best-effort: swallows every error. A notification must never fail
 * the flow that triggered it.
 */
export async function notifyOrgAdmins(params: {
  orgId: string
  type: string
  title: string
  body: string
  link?: string
}): Promise<void> {
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .eq('organisation_id', params.orgId)
      .eq('role', 'admin')
    if (!admins?.length) return
    await db.from('notifications').insert(
      admins.map((a) => ({
        user_id: a.id as string,
        organisation_id: params.orgId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link || '/dashboard',
      }))
    )
  } catch {
    /* never fail the caller */
  }
}
