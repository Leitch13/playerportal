/**
 * Stripe webhook event idempotency helpers.
 *
 * The webhook handler at /api/stripe/webhooks calls these to guarantee
 * each Stripe event is processed at most once successfully, even when
 * Stripe re-delivers (which it explicitly may do under "at least once"
 * delivery semantics).
 *
 * Pairs with migration 069 which creates the stripe_events table.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProcessDecision {
  proceed: boolean
  reason?: 'already_success' | 'race_lost' | 'check_failed'
  // When proceed=false because of check_failed, the caller MUST return 500
  // so Stripe retries. When proceed=false because of already_success or
  // race_lost, the caller MUST return 200.
  retryStripe?: boolean
}

/**
 * Records a webhook event attempt. Returns `{ proceed: true }` if this is
 * a new event the handler should process, or `{ proceed: false }` if we've
 * already processed it successfully OR if another delivery beat us to it.
 *
 * If the check itself fails (Supabase blip), returns
 * `{ proceed: false, reason: 'check_failed', retryStripe: true }` —
 * the caller MUST return HTTP 500 in that case so Stripe retries.
 */
export async function shouldProcessEvent(
  supabase: SupabaseClient,
  event: { id: string; type: string; livemode?: boolean },
  handler: string
): Promise<ProcessDecision> {
  try {
    // 1) Check existing row
    const { data: existing, error: selErr } = await supabase
      .from('stripe_events')
      .select('event_id, status, attempt_count')
      .eq('event_id', event.id)
      .maybeSingle()

    if (selErr) {
      // Transient DB error — tell caller to 500 so Stripe retries.
      return { proceed: false, reason: 'check_failed', retryStripe: true }
    }

    if (existing?.status === 'success') {
      return { proceed: false, reason: 'already_success' }
    }

    // 2) Insert or bump attempt_count
    if (!existing) {
      const { error: insErr } = await supabase.from('stripe_events').insert({
        event_id: event.id,
        event_type: event.type,
        livemode: event.livemode,
        status: 'in_progress',
        handler,
      })
      if (insErr) {
        // PK collision: another delivery raced us to insert. Skip; return 200.
        if ((insErr as { code?: string }).code === '23505') {
          return { proceed: false, reason: 'race_lost' }
        }
        // Transient error — caller should 500.
        return { proceed: false, reason: 'check_failed', retryStripe: true }
      }
    } else {
      const { error: updErr } = await supabase
        .from('stripe_events')
        .update({
          status: 'in_progress',
          attempt_count: (existing.attempt_count || 0) + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('event_id', event.id)
      if (updErr) {
        return { proceed: false, reason: 'check_failed', retryStripe: true }
      }
    }

    return { proceed: true }
  } catch {
    // Catch any unexpected throws (network, etc) — tell caller to 500.
    return { proceed: false, reason: 'check_failed', retryStripe: true }
  }
}

export async function markEventSuccess(
  supabase: SupabaseClient,
  eventId: string
): Promise<void> {
  await supabase
    .from('stripe_events')
    .update({
      status: 'success',
      completed_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('event_id', eventId)
}

export async function markEventError(
  supabase: SupabaseClient,
  eventId: string,
  err: unknown
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  await supabase
    .from('stripe_events')
    .update({
      status: 'error',
      error_message: message.slice(0, 4000),
      last_attempt_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
}
