import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { trialSignupPath } from '@/lib/trial-join'

/**
 * The joining link a parent gets after a trial. See src/lib/trial-join.ts.
 *
 * Notes which trial this sign-up came from (so the payment marks that trial as
 * joined), then sends the parent to sign-up with the trial's class chosen.
 * Anything wrong with the link falls back to the academy's booking page: a
 * parent must never land on an error.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; trialId: string }> }) {
  const { slug, trialId } = await params
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin))
  const fallback = `/book/${encodeURIComponent(slug)}`
  if (!/^[0-9a-f-]{36}$/i.test(trialId)) return to(fallback)
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: trial } = await sb
      .from('trial_bookings')
      .select('id, organisation_id, parent_email, converted, training_group_id, organisation:organisations(slug), training_group:training_groups(id, is_published)')
      .eq('id', trialId)
      .maybeSingle()
    const org = trial?.organisation as unknown as { slug: string } | null
    if (!trial || !org?.slug || org.slug.toLowerCase() !== slug.toLowerCase()) return to(fallback)
    if (trial.converted) return to(fallback)
    if (trial.parent_email) {
      const { error } = await sb.from('trial_signup_attributions').insert({ trial_booking_id: trial.id, parent_email: trial.parent_email.toLowerCase(), organisation_id: trial.organisation_id })
      if (error) console.error('[trial_join_attribution_failed]', { trialId, error: error.message })
    }
    const group = trial.training_group as unknown as { id: string; is_published: boolean | null } | null
    return to(trialSignupPath(org.slug, trial.id, group?.is_published ? group.id : null))
  } catch (err) {
    console.error('[trial_join_failed]', { trialId, error: err instanceof Error ? err.message : String(err) })
    return to(fallback)
  }
}
