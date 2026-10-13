import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { trialJoinLinkEmail } from '@/lib/email-templates'
import { joinLinkProblem, trialJoinPath, TRIAL_JOIN_SENT_ACTION } from '@/lib/trial-join'

/**
 * Academy: email a trial parent their joining link. See src/lib/trial-join.ts.
 *
 * One tap on the Trials page. Writes TRIAL_JOIN_SENT_ACTION to audit_log so
 * the page can show "Link sent 13 Oct", and sets conversion_offer_sent so the
 * automatic follow-up emails do not send the same thing again.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!me || me.role !== 'admin') return NextResponse.json({ ok: false, error: 'Only an academy admin can send this.' }, { status: 403 })

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: trial } = await service
    .from('trial_bookings')
    .select('id, organisation_id, status, converted, parent_name, parent_email, child_name, training_group:training_groups(name), organisation:organisations(name, slug, contact_email)')
    .eq('id', id)
    .maybeSingle()
  if (!trial || trial.organisation_id !== me.organisation_id) return NextResponse.json({ ok: false, error: joinLinkProblem(null) }, { status: 404 })
  const problem = joinLinkProblem(trial)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })

  const org = trial.organisation as unknown as { name: string; slug: string; contact_email: string | null }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
  const template = trialJoinLinkEmail({
    parentName: trial.parent_name,
    childName: trial.child_name,
    academyName: org.name,
    className: (trial.training_group as unknown as { name: string } | null)?.name || null,
    joinUrl: `${appUrl}${trialJoinPath(org.slug, trial.id)}`,
  })
  const sent = await sendEmail({ to: trial.parent_email, ...template, fromName: org.name, replyTo: org.contact_email || undefined })
  if (!sent.success || ('skipped' in sent && sent.skipped)) {
    return NextResponse.json({ ok: false, error: 'The email could not be sent. Copy the link and send it by text instead.' }, { status: 502 })
  }
  const sentAt = new Date().toISOString()
  await service.from('trial_bookings').update({ conversion_offer_sent: true, followup_sent: true }).eq('id', trial.id)
  await service.from('audit_log').insert({ organisation_id: trial.organisation_id, user_id: user.id, action: TRIAL_JOIN_SENT_ACTION, entity_type: 'trial_booking', entity_id: trial.id, details: { to: trial.parent_email } })
  return NextResponse.json({ ok: true, sentAt })
}
