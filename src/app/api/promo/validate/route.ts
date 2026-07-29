import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluatePromo, applyPromoPence, type PromoContext, type PromoRow } from '@/lib/promo'

export const dynamic = 'force-dynamic'

/**
 * Read-only promo-code check. Called from the public booking / checkout UI to
 * validate a code and preview the discounted price BEFORE any payment is made.
 * It never writes and never touches Stripe — redemption (creating the coupon,
 * incrementing current_uses) happens in the checkout + webhook paths. This
 * endpoint only tells the UI "yes/no + what it's worth" using the shared
 * `evaluatePromo` rules, so the quoted price and charged price can't drift.
 *
 * Uses the service role to read `promo_codes` because the caller is usually an
 * unauthenticated parent on a public academy page (RLS is org-admin scoped).
 * Only the code's discount is returned — no other academy data is exposed.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string
    context?: PromoContext
    slug?: string
    orgId?: string
    amountPence?: number
  }

  const code = String(body.code || '').toUpperCase().trim()
  const context: PromoContext = body.context || 'subscription'
  const amountPence = typeof body.amountPence === 'number' ? body.amountPence : null

  if (!code) return NextResponse.json({ valid: false, reason: 'Enter a code' })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Resolve the organisation — by explicit id, or by public slug.
  let organisationId = body.orgId || null
  if (!organisationId && body.slug) {
    const { data: org } = await admin
      .from('organisations')
      .select('id')
      .eq('slug', body.slug)
      .maybeSingle()
    organisationId = (org?.id as string | undefined) || null
  }
  if (!organisationId) return NextResponse.json({ valid: false, reason: 'Unknown academy' })

  const { data: row } = await admin
    .from('promo_codes')
    .select(
      'id, code, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, applies_to, active'
    )
    .eq('organisation_id', organisationId)
    .eq('code', code)
    .maybeSingle()

  const result = evaluatePromo(row as PromoRow | null, context)
  if (!result.valid) return NextResponse.json(result)

  const promo = row as PromoRow
  const out: {
    valid: true
    code: string
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    newAmountPence?: number
    savedPence?: number
  } = {
    valid: true,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
  }
  if (amountPence != null) {
    out.newAmountPence = applyPromoPence(amountPence, promo)
    out.savedPence = amountPence - out.newAmountPence
  }
  return NextResponse.json(out)
}
