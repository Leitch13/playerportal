import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

/**
 * Fan an in-app notification — and optionally an email — out to every admin
 * of an organisation.
 *
 * Built for the "tell me when ANYTHING happens" ask from academy owners:
 * bookings, class moves, cancellations, payments — the events that used to
 * happen silently. Uses the service role so it works regardless of who
 * triggered the event (parent session, webhook, cron).
 *
 * `email: true` sends a simple branded email to each admin as well — use it
 * for discrete events (a booking, a move, a waitlist join). Leave it off for
 * high-frequency events like monthly payment runs, where dozens fire in one
 * hour and email becomes noise.
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
  email?: boolean
}): Promise<void> {
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: admins } = await db
      .from('profiles')
      .select('id, email')
      .eq('organisation_id', params.orgId)
      .eq('role', 'admin')
    if (!admins?.length) return

    const link = params.link || '/dashboard'

    await db.from('notifications').insert(
      admins.map((a) => ({
        user_id: a.id as string,
        organisation_id: params.orgId,
        type: params.type,
        title: params.title,
        body: params.body,
        link,
      }))
    )

    if (params.email) {
      const { data: org } = await db
        .from('organisations')
        .select('name')
        .eq('id', params.orgId)
        .single()
      const academyName = (org?.name as string) || 'Your academy'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
      const href = link.startsWith('http') ? link : `${appUrl}${link}`
      const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
      const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="padding:18px 24px;background:#0f1a2b;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:10px;letter-spacing:0.18em;color:#4ecde6;font-weight:700;">${esc(academyName.toUpperCase())} · ACTIVITY</p>
    <h1 style="margin:8px 0 0;font-size:18px;font-weight:800;color:#ffffff;">${esc(params.title)}</h1>
  </div>
  <div style="padding:20px 24px;background:#ffffff;border:1px solid #e3ebf0;border-top:0;border-radius:0 0 12px 12px;font-size:15px;line-height:1.6;color:#33424f;">
    <p style="margin:0 0 18px;">${esc(params.body)}</p>
    <a href="${href}" style="display:inline-block;background:#0f1a2b;color:#4ecde6;font-weight:700;font-size:14px;padding:11px 22px;border-radius:999px;text-decoration:none;">View in dashboard &rarr;</a>
    <p style="margin:16px 0 0;font-size:11px;color:#93a2ad;">Automatic activity alert from Player Portal.</p>
  </div>
</div>`
      for (const a of admins) {
        const to = (a as { email?: string | null }).email
        if (to) {
          try {
            await sendEmail({ to, subject: `${params.title} — ${academyName}`, html, fromName: academyName })
          } catch { /* per-recipient best-effort */ }
        }
      }
    }
  } catch {
    /* never fail the caller */
  }
}
