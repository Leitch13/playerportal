import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Parent self-booking endpoint.
 *
 * Was previously a direct client-side insert into `enrolments` — meaning parents
 * could book unlimited classes from the schedule page without a subscription.
 * Now gated: must have an active or trialing subscription with the same academy.
 *
 * Returns:
 *   200  { success: true }                  — enrolled
 *   401                                      — not signed in
 *   402  { error, needsSubscription, bookingUrl } — pay first (link to academy booking page)
 *   404  { error }                          — class / player not found
 *   409  { error }                          — already enrolled
 *   500  { error }                          — Stripe / DB failure
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { playerId, groupId } = await request.json()
    if (!playerId || !groupId) {
      return NextResponse.json({ error: 'Missing playerId or groupId' }, { status: 400 })
    }

    // Confirm the class exists + grab its org
    const { data: group } = await supabase
      .from('training_groups')
      .select('id, organisation_id, name')
      .eq('id', groupId)
      .single()
    if (!group) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }

    // Confirm the player belongs to this parent
    const { data: player } = await supabase
      .from('players')
      .select('id, parent_id, first_name')
      .eq('id', playerId)
      .eq('parent_id', user.id)
      .single()
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // GATE 1: require active/trialing subscription in this org for THIS PLAYER
    // (subscriptions are per-child, so a parent paying for child A can't sneak
    // child B into a class).
    const planSelect = 'id, plan_id, status, plan:subscription_plans(id, name, amount, sessions_per_week, class_type)'
    type SubPlan = { id?: string; name?: string; amount?: number; sessions_per_week?: number | null; class_type?: string | null }
    const { data: playerSubs } = await supabase
      .from('subscriptions')
      .select(planSelect)
      .eq('parent_id', user.id)
      .eq('organisation_id', group.organisation_id)
      .eq('player_id', playerId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })

    // Fallback: legacy subs may not have player_id set — check parent-level subs
    // in that case (one sub covering whichever children).
    let activeSubsForPlayer = (playerSubs || []).length
    let currentSubId = (playerSubs || [])[0]?.id as string | undefined
    let planForLimit = (playerSubs || [])[0]?.plan as unknown as SubPlan | undefined

    if (activeSubsForPlayer === 0) {
      const { data: anyParentSubs } = await supabase
        .from('subscriptions')
        .select(planSelect)
        .eq('parent_id', user.id)
        .eq('organisation_id', group.organisation_id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
      activeSubsForPlayer = (anyParentSubs || []).length
      if (activeSubsForPlayer > 0) {
        currentSubId = (anyParentSubs || [])[0]?.id as string | undefined
        planForLimit = (anyParentSubs || [])[0]?.plan as unknown as SubPlan | undefined
      }
    }

    if (activeSubsForPlayer === 0) {
      const { data: org } = await supabase
        .from('organisations')
        .select('slug, name')
        .eq('id', group.organisation_id)
        .single()
      // Send them to the SPECIFIC class page (not the academy home) so they land
      // on the exact class they tried to book and the subscribe carries its
      // classId — the webhook then auto-enrols them in this class after payment.
      const bookingUrl = org?.slug ? `/book/${org.slug}/class/${groupId}` : '/dashboard/payments'
      return NextResponse.json(
        {
          error: `You need an active subscription with ${org?.name || 'this academy'} before booking classes.`,
          needsSubscription: true,
          bookingUrl,
        },
        { status: 402 }
      )
    }

    // GATE 2: enforce sessions_per_week cap. A "1 Session/Week" plan = 1 active
    // enrolment max per child. "Unlimited" plans (sessions_per_week >= 7 or null) skip the check.
    const sessionsAllowed = planForLimit?.sessions_per_week ?? null
    const isUnlimited = sessionsAllowed == null || Number(sessionsAllowed) >= 7

    if (!isUnlimited) {
      const { count: currentEnrolments } = await supabase
        .from('enrolments')
        .select('id', { count: 'exact', head: true })
        .eq('player_id', playerId)
        .eq('status', 'active')

      const used = currentEnrolments || 0
      if (used >= Number(sessionsAllowed)) {
        const { data: org } = await supabase
          .from('organisations')
          .select('slug, name')
          .eq('id', group.organisation_id)
          .single()
        const upgradeUrl = org?.slug ? `/book/${org.slug}/class/${groupId}` : '/dashboard/payments'

        // Find the cheapest "next tier up" in the SAME family (same class_type,
        // or generic if current is generic) that covers used+1 sessions and
        // costs more. If found, the button offers a one-tap in-place upgrade
        // (no second subscription). If not (already top tier), it falls back
        // to the class-page link.
        const neededSessions = used + 1
        let upgradePlan: { id: string; name: string; amount: number; sessions_per_week: number | null } | null = null
        if (currentSubId && planForLimit?.amount != null) {
          const { data: candidates } = await supabase
            .from('subscription_plans')
            .select('id, name, amount, sessions_per_week, class_type, training_group_id')
            .eq('organisation_id', group.organisation_id)
            .eq('active', true)
            .is('training_group_id', null)
            .gt('amount', planForLimit.amount)
            .order('amount', { ascending: true })
          const match = (candidates || []).find((p) => {
            const sameFamily = (p.class_type ?? null) === (planForLimit?.class_type ?? null)
            const spw = p.sessions_per_week
            const enough = spw == null || Number(spw) >= neededSessions
            return sameFamily && enough
          })
          if (match) {
            upgradePlan = { id: match.id as string, name: match.name as string, amount: Number(match.amount), sessions_per_week: match.sessions_per_week as number | null }
          }
        }

        return NextResponse.json(
          {
            error: `${player.first_name} is already booked in ${used} of ${sessionsAllowed} session${sessionsAllowed === 1 ? '' : 's'} this week on the ${planForLimit?.name || 'current'} plan. Upgrade to add more.`,
            needsUpgrade: true,
            upgradeUrl,
            sessionsAllowed: Number(sessionsAllowed),
            sessionsUsed: used,
            // For the one-tap upgrade confirm:
            subscriptionId: currentSubId || null,
            currentPlan: planForLimit ? { name: planForLimit.name, amount: planForLimit.amount } : null,
            upgradePlan,
          },
          { status: 403 }
        )
      }
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('enrolments')
      .select('id, status, activates_on')
      .eq('player_id', playerId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'active') {
        // GATE 3: enrolment exists but its activates_on is in the future.
        // The parent picked a future start date; they can't attend earlier.
        // Returns 403 + the date so the UI can render a friendly explanation.
        if (existing.activates_on) {
          const todayIso = new Date().toISOString().split('T')[0]
          if (existing.activates_on > todayIso) {
            return NextResponse.json(
              {
                error: `${player.first_name}'s enrolment starts on ${existing.activates_on}. Bookings open from that date.`,
                enrolmentNotStarted: true,
                activatesOn: existing.activates_on,
              },
              { status: 403 }
            )
          }
        }
        return NextResponse.json({ error: `${player.first_name} is already enrolled in this class.` }, { status: 409 })
      }
      // Re-activate previously-cancelled enrolment
      await supabase
        .from('enrolments')
        .update({ status: 'active' })
        .eq('id', existing.id)
      return NextResponse.json({ success: true, reactivated: true })
    }

    // Create enrolment — activates_on defaults to today so self-booking via
    // the schedule page (no start-date picker) yields immediately-bookable
    // enrolments, matching pre-Stage-1 behaviour.
    const todayIso = new Date().toISOString().split('T')[0]
    const { error: enrolError } = await supabase
      .from('enrolments')
      .insert({
        player_id: playerId,
        group_id: groupId,
        status: 'active',
        organisation_id: group.organisation_id,
        activates_on: todayIso,
      })

    if (enrolError) {
      return NextResponse.json({ error: enrolError.message }, { status: 500 })
    }

    // Fire booking-confirmation email (best effort)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
      fetch(`${baseUrl}/api/email/booking-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, groupId }),
      }).catch(() => {})
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
