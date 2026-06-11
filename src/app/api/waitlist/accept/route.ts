import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { waitlistAcceptedEmail, waitlistSpotLostEmail } from '@/lib/email-templates'
import { verifyWaitlistToken, fetchStoredToken } from '@/lib/waitlist-token'

// ============================================================================
// Schema-fix flag: WAITLIST_SCHEMA_FIX_ENABLED.
// ============================================================================
// Production waitlist.column is group_id (from migration 008); migration 012
// tried to use training_group_id but CREATE TABLE IF NOT EXISTS no-op'd over
// the existing schema. The rest of this codebase was written against the
// 012 intent — every direct column reference + FK alias against training_group_id
// fails at the SELECT step (route returned 404 "not found" on probe).
//
// Flag ON  → use real column name group_id, drop the FK alias (let PostgREST
//            infer the only FK from waitlist→training_groups), write inserts
//            with group_id.
// Flag OFF → preserve today's broken code path verbatim so rollback is just
//            an env flip.
// ============================================================================
const SCHEMA_FIX_ON = process.env.WAITLIST_SCHEMA_FIX_ENABLED === 'true'

const ENTRY_SELECT = SCHEMA_FIX_ON
  ? `id, player_id, parent_id, group_id, organisation_id, status, expires_at,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_group_id_fkey(id, name)`
  : `id, player_id, parent_id, training_group_id, organisation_id, status, expires_at,
     player:players(id, first_name, last_name),
     parent:profiles!waitlist_parent_id_fkey(full_name, email),
     group:training_groups!waitlist_training_group_id_fkey(id, name)`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entryGroupId(entry: any): string {
  return SCHEMA_FIX_ON ? entry.group_id : entry.training_group_id
}

export async function POST(request: NextRequest) {
  try {
    const { id, token } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Waitlist entry id is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch the waitlist entry
    const { data: entry, error: fetchError } = await supabase
      .from('waitlist')
      .select(ENTRY_SELECT)
      .eq('id', id)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }
    // Finding #1: token gate (no-op when flag OFF; grace-allows NULL-token
    // in-flight offers). Checked before any state change so a guessed id
    // without the matching token learns nothing and mutates nothing.
    if (!verifyWaitlistToken(await fetchStoredToken(supabase, id), token).ok) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 403 })
    }
    const groupIdValue = entryGroupId(entry)

    if (entry.status !== 'offered') {
      return NextResponse.json({ error: `Cannot accept — current status is "${entry.status}"` }, { status: 400 })
    }

    // Check if the offer has expired
    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', id)
      return NextResponse.json({ error: 'This offer has expired' }, { status: 410 })
    }

    // ════════════════════════════════════════════════════════════════════
    // Phase 1 capacity guard — WAITLIST_CAPACITY_GUARD_ENABLED.
    // ════════════════════════════════════════════════════════════════════
    // When the flag is true, route the enrolment write through the atomic
    // enrol_if_capacity_available RPC (migration 079 / SECURITY DEFINER /
    // FOR UPDATE on training_groups). Three branches:
    //   - class_full      → §7a Option A: strict reject, mark waitlist
    //                       'expired', fan out capacity_overflow admin
    //                       notifications, send parent "spot lost" email,
    //                       return HTTP 409 — NO enrolment written.
    //   - idempotent on a status='cancelled' row → §7b Option B: return
    //                       409 'cancelled_re_enrol_needs_admin' — parent
    //                       must contact academy. No write.
    //   - ok:true (fresh or active idempotent) → success path; skip the
    //                       inline insert below, fall through to mark
    //                       'accepted' + send confirmation email.
    // Flag OFF or RPC error → falls through to today's inline insert.
    // ════════════════════════════════════════════════════════════════════
    let skipInlineInsert = false
    if (process.env.WAITLIST_CAPACITY_GUARD_ENABLED === 'true') {
      const { data: rpcResult, error: rpcErr } = await supabase
        .rpc('enrol_if_capacity_available', {
          p_player_id: entry.player_id,
          p_group_id: groupIdValue,
          p_org_id: entry.organisation_id,
          p_status: 'active',
        })

      if (rpcErr) {
        console.error('[waitlist-capacity-guard] rpc_error', rpcErr.message)
        // Fall through to inline insert below.
      } else if (rpcResult?.ok === false && rpcResult?.error === 'class_full') {
        console.log('[waitlist-capacity-guard] class_full', {
          id,
          count: rpcResult.count,
          capacity: rpcResult.capacity,
        })

        // Mark waitlist entry expired — the offer is no longer valid.
        await supabase.from('waitlist').update({ status: 'expired' }).eq('id', id)

        // Build display names for admin notification + parent email.
        const parent = entry.parent as unknown as { full_name: string; email: string } | null
        const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
        const group = entry.group as unknown as { name: string } | null
        const parentDisplayName = parent?.full_name || 'A waitlisted parent'
        const childDisplayName =
          player?.full_name ||
          `${player?.first_name || ''} ${player?.last_name || ''}`.trim() ||
          'their child'
        const className = group?.name || 'a class'

        // Fan out capacity_overflow notifications to org admins.
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('organisation_id', entry.organisation_id)
          .eq('role', 'admin')
        for (const a of admins || []) {
          await supabase.from('notifications').insert({
            user_id: a.id as string,
            organisation_id: entry.organisation_id,
            type: 'capacity_overflow',
            title: 'Waitlist offer lost a race — class is full',
            body: `${parentDisplayName} accepted a waitlist offer for ${className} but the class filled before we could enrol ${childDisplayName}. They were not added. Please review.`,
            link: `/dashboard/groups/${groupIdValue}`,
          })
        }

        // Parent "spot lost" email.
        if (parent?.email) {
          const parentFirstName = parent.full_name?.split(' ')[0] || 'there'
          const template = waitlistSpotLostEmail({
            parentName: parentFirstName,
            childName: childDisplayName,
            className,
          })
          await sendEmail({ to: parent.email, ...template })
        }

        return NextResponse.json(
          { error: 'class_full', count: rpcResult.count, capacity: rpcResult.capacity },
          { status: 409 }
        )
      } else if (rpcResult?.ok === true && rpcResult?.idempotent === true) {
        // The RPC found an existing (player_id, group_id) row regardless of status.
        // §7b Option B: if that row is cancelled, block and ask parent to contact academy.
        const { data: existing } = await supabase
          .from('enrolments')
          .select('status')
          .eq('id', rpcResult.enrolment_id)
          .maybeSingle()
        if (existing?.status === 'cancelled') {
          console.log('[waitlist-capacity-guard] cancelled_re_enrol_blocked', {
            id,
            enrolment_id: rpcResult.enrolment_id,
          })
          return NextResponse.json(
            { error: 'cancelled_re_enrol_needs_admin' },
            { status: 409 }
          )
        }
        // Existing row is active or pending — parent double-clicked. Treat as success.
        console.log('[waitlist-capacity-guard] idempotent_success', {
          id,
          enrolment_id: rpcResult.enrolment_id,
        })
        skipInlineInsert = true
      } else if (rpcResult?.ok === true) {
        // Fresh insert succeeded inside the RPC.
        console.log('[waitlist-capacity-guard] insert', {
          id,
          enrolment_id: rpcResult.enrolment_id,
        })
        skipInlineInsert = true
      }
    }

    // Create the enrolment (inline fallback — flag OFF or RPC error).
    if (!skipInlineInsert) {
      const { error: enrolError } = await supabase
        .from('enrolments')
        .insert({
          player_id: entry.player_id,
          group_id: groupIdValue,
          status: 'active',
          organisation_id: entry.organisation_id,
        })

      if (enrolError) {
        return NextResponse.json({ error: 'Failed to create enrolment' }, { status: 500 })
      }
    }

    // Update waitlist entry to accepted
    await supabase.from('waitlist').update({ status: 'accepted' }).eq('id', id)

    // Send confirmation email
    const parent = entry.parent as unknown as { full_name: string; email: string } | null
    const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
    const group = entry.group as unknown as { name: string } | null

    if (parent?.email) {
      const parentName = parent.full_name?.split(' ')[0] || 'there'
      const childName = player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child'
      const className = group?.name || 'the class'

      const template = waitlistAcceptedEmail({ parentName, childName, className })
      await sendEmail({ to: parent.email, ...template })
    }

    return NextResponse.json({ success: true, enrolment_created: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also support GET for email link clicks — redirect to dashboard after processing
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const token = request.nextUrl.searchParams.get('token')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  if (!id) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=missing_id`)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch the waitlist entry
  const { data: entry } = await supabase
    .from('waitlist')
    .select(ENTRY_SELECT)
    .eq('id', id)
    .single()

  if (!entry) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=not_found`)
  }
  // Finding #1: token gate (email-link path). No-op when flag OFF.
  if (!verifyWaitlistToken(await fetchStoredToken(supabase, id), token).ok) {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=invalid_token`)
  }
  const groupIdValueGet = entryGroupId(entry)

  if (entry.status !== 'offered') {
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=status_${entry.status}`)
  }

  if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
    await supabase.from('waitlist').update({ status: 'expired' }).eq('id', id)
    return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=expired`)
  }

  // ════════════════════════════════════════════════════════════════════
  // Phase 1 capacity guard (GET / email-link path). Mirrors the POST
  // branch above but returns redirects instead of JSON. Same RPC, same
  // branches, same admin notification + parent "spot lost" email.
  // ════════════════════════════════════════════════════════════════════
  let skipInlineInsert = false
  if (process.env.WAITLIST_CAPACITY_GUARD_ENABLED === 'true') {
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('enrol_if_capacity_available', {
        p_player_id: entry.player_id,
        p_group_id: groupIdValueGet,
        p_org_id: entry.organisation_id,
        p_status: 'active',
      })

    if (rpcErr) {
      console.error('[waitlist-capacity-guard] GET rpc_error', rpcErr.message)
      // Fall through to inline insert.
    } else if (rpcResult?.ok === false && rpcResult?.error === 'class_full') {
      console.log('[waitlist-capacity-guard] GET class_full', {
        id,
        count: rpcResult.count,
        capacity: rpcResult.capacity,
      })

      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', id)

      const parent = entry.parent as unknown as { full_name: string; email: string } | null
      const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
      const group = entry.group as unknown as { name: string } | null
      const parentDisplayName = parent?.full_name || 'A waitlisted parent'
      const childDisplayName =
        player?.full_name ||
        `${player?.first_name || ''} ${player?.last_name || ''}`.trim() ||
        'their child'
      const className = group?.name || 'a class'

      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('organisation_id', entry.organisation_id)
        .eq('role', 'admin')
      for (const a of admins || []) {
        await supabase.from('notifications').insert({
          user_id: a.id as string,
          organisation_id: entry.organisation_id,
          type: 'capacity_overflow',
          title: 'Waitlist offer lost a race — class is full',
          body: `${parentDisplayName} accepted a waitlist offer for ${className} but the class filled before we could enrol ${childDisplayName}. They were not added. Please review.`,
          link: `/dashboard/groups/${groupIdValueGet}`,
        })
      }

      if (parent?.email) {
        const { waitlistSpotLostEmail } = await import('@/lib/email-templates')
        const parentFirstName = parent.full_name?.split(' ')[0] || 'there'
        const template = waitlistSpotLostEmail({
          parentName: parentFirstName,
          childName: childDisplayName,
          className,
        })
        await sendEmail({ to: parent.email, ...template })
      }

      return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=class_full`)
    } else if (rpcResult?.ok === true && rpcResult?.idempotent === true) {
      const { data: existing } = await supabase
        .from('enrolments')
        .select('status')
        .eq('id', rpcResult.enrolment_id)
        .maybeSingle()
      if (existing?.status === 'cancelled') {
        console.log('[waitlist-capacity-guard] GET cancelled_re_enrol_blocked', {
          id,
          enrolment_id: rpcResult.enrolment_id,
        })
        return NextResponse.redirect(`${appUrl}/dashboard/waitlist?error=contact_academy`)
      }
      console.log('[waitlist-capacity-guard] GET idempotent_success', {
        id,
        enrolment_id: rpcResult.enrolment_id,
      })
      skipInlineInsert = true
    } else if (rpcResult?.ok === true) {
      console.log('[waitlist-capacity-guard] GET insert', {
        id,
        enrolment_id: rpcResult.enrolment_id,
      })
      skipInlineInsert = true
    }
  }

  if (!skipInlineInsert) {
    // Inline fallback (flag OFF or RPC error).
    await supabase.from('enrolments').insert({
      player_id: entry.player_id,
      group_id: groupIdValueGet,
      status: 'active',
      organisation_id: entry.organisation_id,
    })
  }

  // Update waitlist
  await supabase.from('waitlist').update({ status: 'accepted' }).eq('id', id)

  // Send confirmation email
  const parent = entry.parent as unknown as { full_name: string; email: string } | null
  const player = entry.player as unknown as { full_name?: string; first_name?: string; last_name?: string } | null
  const group = entry.group as unknown as { name: string } | null

  if (parent?.email) {
    const { waitlistAcceptedEmail } = await import('@/lib/email-templates')
    const template = waitlistAcceptedEmail({
      parentName: parent.full_name?.split(' ')[0] || 'there',
      childName: player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'your child',
      className: group?.name || 'the class',
    })
    await sendEmail({ to: parent.email, ...template })
  }

  return NextResponse.redirect(`${appUrl}/dashboard/waitlist?accepted=true`)
}
