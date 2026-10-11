/**
 * Every trial booking tells the academy. One function, one written record.
 *
 * Paid trials were silent from the day they were built (May 2026) until
 * 10 Oct 2026: the Stripe webhook saved the booking and returned, so the
 * academy got no email and no bell, the parent got no confirmation, and
 * nothing stopped the same child being booked twice. Ten paid trials in six
 * weeks went unannounced (Gold & Gray 6, Talent FA 3, Jamie Allan 1); one
 * parent, hearing nothing, paid a second time for the same session.
 *
 * The free trial told the academy from its own route. Two routes, two copies
 * of "what happens when a trial is booked", and only one of them was complete.
 *
 * So there is now ONE place. alertAcademyOfTrial() is called by both routes,
 * and it writes an audit_log row (TRIAL_ALERTED_ACTION) every time. That row
 * is what makes this checkable: canary 17 reads every recent trial and emails
 * John if any one of them has no such row. A third trial route that forgets
 * to call this is caught the next morning, not by an academy a month later.
 *
 * Never throws: a trial that is booked (and, for a paid one, paid) must stand
 * even if an email provider is down. A failure is recorded, and the canary
 * reports it.
 */
import { sendEmail } from './email'
import { newTrialBookingAdminEmail, paidTrialConfirmationEmail } from './email-templates'
import { paidTrialPence } from './trial-booking'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

export const TRIAL_ALERTED_ACTION = 'trial.academy_alerted'

export { paidTrialPence, paidTrialSessionId, sameTrial, TRIAL_ALREADY_BOOKED_MESSAGE } from './trial-booking'

const longDate = (iso: string | null | undefined) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : null

export interface TrialAlertResult {
  ok: boolean
  /** True when this trial had already been announced (webhook re-delivery, double call). */
  already: boolean
  notifications: number
  emailSent: boolean
  error?: string
}

/**
 * Tell the academy about one trial booking: a bell notification for every
 * admin and one email to the academy's contact address. Safe to call twice.
 */
export async function alertAcademyOfTrial(sb: Supabase, trialId: string): Promise<TrialAlertResult> {
  try {
    const { data: prior } = await sb.from('audit_log').select('id').eq('action', TRIAL_ALERTED_ACTION).eq('entity_id', trialId).limit(1)
    if (prior && prior.length > 0) return { ok: true, already: true, notifications: 0, emailSent: false }

    const { data: trial } = await sb
      .from('trial_bookings')
      .select('id, organisation_id, parent_name, parent_email, parent_phone, child_name, child_age, preferred_date, notes, training_group:training_groups(name, time_slot), organisation:organisations(name, contact_email)')
      .eq('id', trialId)
      .maybeSingle()
    if (!trial) return { ok: false, already: false, notifications: 0, emailSent: false, error: 'trial not found' }

    const group = trial.training_group as { name: string; time_slot: string | null } | null
    const org = trial.organisation as { name: string; contact_email: string | null } | null
    const paid = paidTrialPence(trial.notes)
    const paidText = paid != null ? `£${(paid / 100).toFixed(2)}` : null
    const when = longDate(trial.preferred_date)

    const { data: admins } = await sb.from('profiles').select('id').eq('organisation_id', trial.organisation_id).eq('role', 'admin')
    let notifications = 0
    if (admins && admins.length > 0) {
      const rows = (admins as { id: string }[]).map((a) => ({
        user_id: a.id,
        organisation_id: trial.organisation_id,
        type: 'new_trial',
        title: `New trial: ${trial.child_name}`,
        body: `${trial.parent_name} booked ${paidText ? `and paid ${paidText} for a trial` : 'a free trial'}${group?.name ? ` for ${group.name}` : ''}${trial.preferred_date ? ` — ${trial.preferred_date}` : ''}.`,
        link: '/dashboard/trials',
      }))
      const { error: nErr, count } = await sb.from('notifications').insert(rows, { count: 'exact' })
      if (!nErr) notifications = count ?? rows.length
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
    const recipient = org?.contact_email || process.env.ADMIN_NOTIFICATION_EMAIL || 'johnleitch970@gmail.com'
    const template = newTrialBookingAdminEmail({
      academyName: org?.name || 'your academy',
      parentName: trial.parent_name,
      parentEmail: trial.parent_email,
      parentPhone: trial.parent_phone,
      childName: trial.child_name,
      childAge: trial.child_age,
      className: group?.name ?? null,
      preferredDate: when,
      notes: paidText ? `Paid ${paidText} online. The money is in your Stripe account.` : trial.notes,
      dashboardUrl: `${appUrl}/dashboard/trials`,
    })
    const sent = await sendEmail({ to: recipient, ...template })
    const emailSent = !!sent.success && !('skipped' in sent && sent.skipped)

    await sb.from('audit_log').insert({
      organisation_id: trial.organisation_id,
      action: TRIAL_ALERTED_ACTION,
      entity_type: 'trial_booking',
      entity_id: trial.id,
      details: { notifications, email_sent: emailSent, to_academy_contact: !!org?.contact_email, paid_pence: paid },
    })
    return { ok: notifications > 0 || emailSent, already: false, notifications, emailSent }
  } catch (err) {
    return { ok: false, already: false, notifications: 0, emailSent: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** The parent's confirmation for a paid trial: what they booked, when, and what they paid. Never throws. */
export async function confirmPaidTrialToParent(sb: Supabase, trialId: string): Promise<boolean> {
  try {
    const { data: trial } = await sb
      .from('trial_bookings')
      .select('parent_name, parent_email, child_name, preferred_date, notes, training_group:training_groups(name, day_of_week, time_slot, location), organisation:organisations(name, contact_email)')
      .eq('id', trialId)
      .maybeSingle()
    if (!trial?.parent_email) return false
    const group = trial.training_group as { name: string; day_of_week: string | null; time_slot: string | null; location: string | null } | null
    const org = trial.organisation as { name: string; contact_email: string | null } | null
    const paid = paidTrialPence(trial.notes)
    const template = paidTrialConfirmationEmail({
      parentName: trial.parent_name,
      childName: trial.child_name,
      academyName: org?.name || 'the academy',
      className: group?.name ?? null,
      date: longDate(trial.preferred_date),
      time: group?.time_slot ?? null,
      location: group?.location ?? null,
      paid: paid != null ? `£${(paid / 100).toFixed(2)}` : null,
    })
    const sent = await sendEmail({ to: trial.parent_email, ...template, fromName: org?.name || undefined, replyTo: org?.contact_email || undefined })
    return !!sent.success && !('skipped' in sent && sent.skipped)
  } catch {
    return false
  }
}
