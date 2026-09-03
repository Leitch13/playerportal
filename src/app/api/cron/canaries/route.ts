import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAllCanaries, formatCanaryLine, buildAlertEmail } from '@/lib/canaries'
import { sendEmail } from '@/lib/email'

/**
 * Daily canary run (vercel.json: 05:30 UTC, before John's day starts).
 *
 * - Runs every canary; a canary that errors reports as ERROR, never as 0 rows.
 * - Emails ONLY when something fires or errors. Silence = healthy…
 * - …except Mondays: the weekly "all clear" heartbeat goes out regardless,
 *   because a dead cron and a healthy platform look identical without it.
 * - The alarm itself must not fail silently: sendEmail returns
 *   { success:false } / { skipped:true } instead of throwing, so we check the
 *   result and return HTTP 500 on any send failure — Vercel then marks the
 *   cron run failed, which is visible in the dashboard.
 */

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const ALERT_TO = process.env.CANARY_ALERT_EMAIL || 'john.leitch@playitloveit.com'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const results = await runAllCanaries(supabase)
    const firing = results.filter((r) => r.status !== 'ok')
    const isHeartbeatDay = new Date().getUTCDay() === 1 // Monday

    let emailed = false
    let emailError: string | null = null

    if (firing.length > 0 || isHeartbeatDay) {
      // Alert body is built by buildAlertEmail: money first, NEW-since-yesterday
      // called out, oldest first, one action line per canary. The old version
      // sent an identical wall of text daily and was — reasonably — tuned out.
      const { subject, html } = buildAlertEmail(firing.length > 0 ? results : [])
      void formatCanaryLine // retained for the plain-text log format

      const sent = await sendEmail({ to: ALERT_TO, subject, html })
      if (!sent.success || ('skipped' in sent && sent.skipped)) {
        emailError = 'skipped' in sent && sent.skipped
          ? 'RESEND_API_KEY not configured — alert email was NOT sent'
          : `send failed: ${JSON.stringify((sent as { error?: unknown }).error)}`
      } else {
        emailed = true
      }
    }

    const body = {
      ranAt: new Date().toISOString(),
      heartbeatDay: isHeartbeatDay,
      emailed,
      ...(emailError ? { emailError } : {}),
      results: results.map((r) => ({
        id: r.id, name: r.name, status: r.status, rowCount: r.rowCount,
        ...(r.error ? { error: r.error } : {}),
      })),
    }

    // A run that needed to email but couldn't is a FAILED run — surface it
    // through the cron's own status rather than pretending all is well.
    return NextResponse.json(body, { status: emailError ? 500 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[canaries] run failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
