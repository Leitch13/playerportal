import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAllCanaries, formatCanaryLine } from '@/lib/canaries'
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
      const lines = (firing.length > 0 ? firing : results).map(formatCanaryLine)
      const subject = firing.length > 0
        ? `🚨 Canary alert: ${firing.length} firing`
        : '✅ Canary heartbeat: all clear'
      const intro = firing.length > 0
        ? 'The following canaries are firing or erroring. Any line here means a real problem — zero rows is the only healthy state.'
        : 'Weekly heartbeat. Every canary ran and returned zero rows. This email exists so a dead alarm can’t be mistaken for a healthy platform.'
      const html = `
        <div style="font-family: -apple-system, sans-serif; max-width: 640px;">
          <h2 style="margin: 0 0 8px;">${subject}</h2>
          <p style="color: #555; margin: 0 0 16px;">${intro}</p>
          <pre style="background: #0a0a0a; color: #e5e5e5; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">${lines.join('\n')}</pre>
          <p style="color: #999; font-size: 12px;">Run at ${new Date().toISOString()} — /api/cron/canaries</p>
        </div>`

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
