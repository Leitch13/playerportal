/**
 * A record of every time the sign-up payment step turns a parent away, and why.
 *
 * Before this, a refusal left no trace: the parent saw a message, the academy
 * heard "it wouldn't let me pay", and nobody could say which rule had fired.
 * Rows go in the existing audit_log (action 'signup.refused'), so each academy
 * sees its own on the Audit page and nothing new is needed in the database.
 *
 * Recording must never change what happens to the parent: it is awaited so a
 * serverless function can't drop it, but every failure is swallowed.
 */
import { createClient } from '@supabase/supabase-js'

export type SignupRefusalReason =
  | 'quarterly_unavailable'
  | 'academy_payments_not_set_up'
  | 'academy_payments_not_ready'
  | 'existing_membership'
  | 'existing_payment_link_waiting'
  | 'existing_membership_payment_failed'
  | 'class_full'
  | 'start_date_not_a_class_day'
  | 'checkout_error'

export interface SignupRefusalContext {
  organisationId?: string | null
  userId?: string | null
  planId?: string | null
  playerId?: string | null
  classId?: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What goes in the row. Pure, so the shape is tested without a database. */
export function signupRefusalRow(ctx: SignupRefusalContext, reason: SignupRefusalReason, message: string, status: number, extra?: Record<string, unknown>) {
  // Without an academy and a plan there is nothing to file the row under.
  if (!ctx.organisationId || !ctx.planId || !UUID.test(ctx.planId)) return null
  return {
    organisation_id: ctx.organisationId,
    user_id: ctx.userId || null,
    action: 'signup.refused',
    entity_type: 'plan',
    entity_id: ctx.planId,
    details: {
      reason,
      message: message.slice(0, 400),
      status,
      player_id: ctx.playerId && UUID.test(ctx.playerId) ? ctx.playerId : null,
      class_id: ctx.classId && UUID.test(ctx.classId) ? ctx.classId : null,
      ...(extra || {}),
    },
  }
}

export async function recordSignupRefusal(ctx: SignupRefusalContext, reason: SignupRefusalReason, message: string, status: number, extra?: Record<string, unknown>): Promise<void> {
  try {
    const row = signupRefusalRow(ctx, reason, message, status, extra)
    if (!row) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await db.from('audit_log').insert(row)
    if (error) console.error('[signup-refusal] not recorded', error.message)
  } catch (e) {
    console.error('[signup-refusal] not recorded', e instanceof Error ? e.message : e)
  }
}
