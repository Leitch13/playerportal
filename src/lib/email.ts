import { Resend } from 'resend'

const FROM_EMAIL = process.env.FROM_EMAIL || 'Player Portal <noreply@playerportal.app>'

// Pull just the address out of FROM_EMAIL, e.g. "noreply@theplayerportal.net"
// from "Player Portal <noreply@theplayerportal.net>". We keep this verified
// platform address as the actual sender (so deliverability/SPF/DKIM hold), and
// only swap the DISPLAY NAME per academy.
function senderAddress(): string {
  const m = FROM_EMAIL.match(/<([^>]+)>/)
  return m ? m[1].trim() : FROM_EMAIL.trim()
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  // Optional academy display name — shown as the sender, e.g. "JSI Sports".
  // Falls back to the platform default when not provided.
  fromName?: string
  // Optional reply-to (e.g. the academy's contact email) so parent replies
  // land with the academy rather than the no-reply inbox.
  replyTo?: string
}

export async function sendEmail({ to, subject, html, fromName, replyTo }: EmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    return { success: true, skipped: true }
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // Build the From line. With a fromName we present the academy's name on the
    // verified platform address; without it we use FROM_EMAIL verbatim.
    const cleanName = fromName?.replace(/[<>"]/g, '').trim()
    const from = cleanName ? `${cleanName} <${senderAddress()}>` : FROM_EMAIL
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    })
    if (error) {
      return { success: false, error }
    }
    return { success: true, id: data?.id }
  } catch (err) {
    return { success: false, error: err }
  }
}

/**
 * Send many emails with bounded concurrency. Used by the daily cron jobs so a
 * run that fans out to hundreds/thousands of families finishes in seconds
 * instead of sending one-at-a-time and timing out mid-loop (which silently
 * drops whoever hadn't been reached yet).
 *
 * A fixed-size worker pool pulls from the job list, so at most `concurrency`
 * sends are in flight at once — fast, but gentle enough not to trip Resend's
 * rate limits. Failures are counted, never thrown, so one bad address can't
 * abort the whole batch.
 */
// The one address that is never a real inbox: the retired academy mailbox
// every demo academy's placeholder parents point at (Resend has it
// suppressed). Sending to it wastes the rate budget real families need. On
// 6 Sep 2026 the session-reminder cron built 154 jobs of which 121 were
// this address; Resend's 2-requests/second limit then rejected most of the
// run and only 3 real parents out of 33 got their reminder.
//
// Deliberately NOT a domain rule: john@ and support@theplayerportal.net are
// real inboxes that receive cron output.
const PLACEHOLDER_RECIPIENT = /^john\.leitch@playitloveit\.com$/i

const BATCH_MAX = 100 // Resend's per-call limit for /emails/batch

function toResendPayload({ to, subject, html, fromName, replyTo }: EmailOptions) {
  const cleanName = fromName?.replace(/[<>"]/g, '').trim()
  return {
    from: cleanName ? `${cleanName} <${senderAddress()}>` : FROM_EMAIL,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  }
}

/**
 * Send many emails. Used by the daily crons that fan out to hundreds of
 * families.
 *
 * Goes through Resend's batch endpoint — one request per 100 emails — so a
 * 154-recipient run is two calls, not 154. The previous version fired 8
 * single sends at once into a 2-per-second limit and silently counted the
 * rejections as "failed"; the route still returned 200.
 *
 * If a batch call fails outright, that chunk falls back to one-at-a-time at
 * a rate Resend accepts, with one retry on a rate-limit response. Failures
 * are counted, never thrown, so one bad address can't abort the run.
 * Placeholder recipients are skipped before anything is sent.
 */
export async function sendEmailBatch(
  jobs: EmailOptions[],
  // Kept so existing callers that pass a concurrency still compile; the batch
  // endpoint makes it meaningless.
  _concurrency?: number,
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, failed: 0, skipped: jobs.length }
  const real = jobs.filter((j) => j.to && !PLACEHOLDER_RECIPIENT.test(j.to))
  let sent = 0
  let failed = 0
  const skipped = jobs.length - real.length
  if (real.length === 0) return { sent, failed, skipped }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  for (let i = 0; i < real.length; i += BATCH_MAX) {
    const chunk = real.slice(i, i + BATCH_MAX)
    try {
      // 'permissive': one bad address is reported, not a reason to reject the
      // other 99. Default 'strict' would fail the whole chunk.
      const { data, error } = await resend.batch.send(chunk.map(toResendPayload), { batchValidation: 'permissive' })
      if (!error) {
        const ok = data?.data?.length ?? chunk.length
        sent += ok
        failed += chunk.length - ok
        continue
      }
      console.error('[sendEmailBatch] batch call failed, falling back to sequential:', error)
    } catch (err) {
      console.error('[sendEmailBatch] batch call threw, falling back to sequential:', err)
    }
    // Fallback: sequential at ~2/s, one retry on a rate-limit response.
    for (const job of chunk) {
      let result = await sendEmail(job)
      if (!result.success && /rate|429/i.test(String((result.error as { message?: string } | undefined)?.message ?? result.error))) {
        await sleep(1100)
        result = await sendEmail(job)
      }
      if (result.success) sent++
      else failed++
      await sleep(550)
    }
  }
  return { sent, failed, skipped }
}
