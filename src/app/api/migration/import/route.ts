import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Bulk migration wizard import. Creates players + parents + enrolments + pending
 * subscriptions with invitation tokens, then triggers a batch email to parents.
 *
 * Called after the academy has mapped each source class to a PP group + plan.
 */
interface ImportRow {
  first_name: string
  last_name: string
  date_of_birth: string
  age_group: string
  parent_email: string
  parent_name: string
  parent_phone: string
  group_name: string
  medical_info: string
}

interface ClassMapping {
  groupId: string | null
  planId: string | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organisation_id) {
    return NextResponse.json({ error: 'No organisation' }, { status: 400 })
  }
  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }

  const orgId = profile.organisation_id

  let body: { rows?: ImportRow[]; classMap?: Record<string, ClassMapping>; sendInvitations?: boolean; billingStartsAt?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = body.rows || []
  const classMap = body.classMap || {}
  const sendInvitations = body.sendInvitations !== false

  // Optional: defer the first charge to when migrated members' existing
  // (prepaid) payment runs out, so we don't double-charge them on confirm.
  let billingStartsAt: string | null = null
  if (body.billingStartsAt) {
    const d = new Date(body.billingStartsAt)
    if (!isNaN(d.getTime()) && d.getTime() > Date.now()) billingStartsAt = d.toISOString()
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  // Service role to create parent profiles we don't have auth for
  const admin = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const summary = {
    imported: 0,
    skipped: 0,
    errors: [] as { row: number; error: string }[],
    invitationsQueued: 0,
  }

  const parentByEmail = new Map<string, string>()
  const invitationsToSend: Array<{
    email: string
    parentName: string
    childName: string
    token: string
    planAmount: number
    planName: string
  }> = []

  // Resolve plan details for email copy
  const planIds = Array.from(new Set(
    Object.values(classMap).map((m) => m.planId).filter((v): v is string => !!v)
  ))
  const { data: planRows } = planIds.length > 0
    ? await admin.from('subscription_plans').select('id, name, amount').in('id', planIds)
    : { data: [] as { id: string; name: string; amount: number }[] }
  const planById = new Map((planRows || []).map((p) => [p.id as string, { name: p.name as string, amount: Number(p.amount) }]))

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    try {
      const email = (r.parent_email || '').trim().toLowerCase()
      if (!email) {
        summary.skipped++
        continue
      }

      const mapping = classMap[r.group_name] || { groupId: null, planId: null }

      // Find-or-create parent: creates an auth user (auto-generates profile via trigger),
      // then updates the profile row with org + name + phone.
      let parentId = parentByEmail.get(email) || null
      if (!parentId) {
        const { data: existing } = await admin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (existing?.id) {
          parentId = existing.id
          // Keep profile tied to the right org + make sure contact info is present
          await admin
            .from('profiles')
            .update({
              organisation_id: orgId,
              full_name: r.parent_name || undefined,
              phone: r.parent_phone || undefined,
              role: 'parent',
            })
            .eq('id', parentId)
        } else {
          // Create auth user — handle_new_user trigger (if present) creates the profile row.
          // If no trigger, we upsert the profile manually below.
          const { data: authResult, error: authErr } = await admin.auth.admin.createUser({
            email,
            email_confirm: false, // parent confirms via magic link / signin later
            user_metadata: { full_name: r.parent_name || '', imported: true, source: 'classforkids' },
          })
          if (authErr || !authResult?.user) {
            summary.errors.push({ row: i + 1, error: `Parent auth: ${authErr?.message || 'unknown'}` })
            continue
          }
          parentId = authResult.user.id

          // Upsert the profile row (trigger may or may not have run)
          await admin
            .from('profiles')
            .upsert({
              id: parentId,
              email,
              full_name: r.parent_name || null,
              phone: r.parent_phone || null,
              role: 'parent',
              organisation_id: orgId,
            }, { onConflict: 'id' })
        }
        if (parentId) parentByEmail.set(email, parentId)
      }

      // Find-or-create player (idempotent — re-running this doesn't duplicate)
      const { data: existingPlayer } = await admin
        .from('players')
        .select('id')
        .eq('organisation_id', orgId)
        .eq('parent_id', parentId)
        .ilike('first_name', r.first_name)
        .ilike('last_name', r.last_name || '')
        .maybeSingle()

      let playerId: string | undefined = existingPlayer?.id as string | undefined

      if (!playerId) {
        const { data: newPlayer, error: playerErr } = await admin
          .from('players')
          .insert({
            organisation_id: orgId,
            parent_id: parentId,
            first_name: r.first_name,
            last_name: r.last_name || null,
            date_of_birth: r.date_of_birth || null,
            age_group: r.age_group || null,
            medical_info: r.medical_info || null,
          })
          .select('id')
          .single()

        if (playerErr || !newPlayer) {
          summary.errors.push({ row: i + 1, error: `Player: ${playerErr?.message || 'unknown'}` })
          continue
        }
        playerId = newPlayer.id
      }

      // Enrolment if we have a matched group
      if (mapping.groupId && playerId) {
        const { data: existingEnrol } = await admin
          .from('enrolments')
          .select('id')
          .eq('player_id', playerId)
          .eq('group_id', mapping.groupId)
          .eq('status', 'active')
          .maybeSingle()

        if (!existingEnrol) {
          await admin.from('enrolments').insert({
            organisation_id: orgId,
            player_id: playerId,
            group_id: mapping.groupId,
            status: 'active',
          })
        }
      }

      // Pending subscription if we have a matched plan
      if (mapping.planId && playerId && parentId) {
        const { data: existingSub } = await admin
          .from('subscriptions')
          .select('id, status')
          .eq('player_id', playerId)
          .eq('plan_id', mapping.planId)
          .in('status', ['active', 'trialing', 'pending_migration'])
          .maybeSingle()

        if (!existingSub) {
          const token = randomBytes(24).toString('base64url')
          const { error: subErr } = await admin
            .from('subscriptions')
            .insert({
              parent_id: parentId,
              player_id: playerId,
              plan_id: mapping.planId,
              organisation_id: orgId,
              status: 'pending_migration',
              invite_token: token,
              invite_source: 'classforkids',
              migration_billing_starts_at: billingStartsAt,
            })

          if (subErr) {
            summary.errors.push({ row: i + 1, error: `Subscription: ${subErr.message}` })
          } else if (sendInvitations) {
            const planInfo = planById.get(mapping.planId)
            invitationsToSend.push({
              email,
              parentName: r.parent_name || email.split('@')[0],
              childName: `${r.first_name} ${r.last_name || ''}`.trim(),
              token,
              planAmount: planInfo?.amount ?? 0,
              planName: planInfo?.name ?? 'Subscription',
            })
          }
        }
      }

      summary.imported++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      summary.errors.push({ row: i + 1, error: message })
    }
  }

  // Queue invitation emails
  if (sendInvitations && invitationsToSend.length > 0) {
    const origin = request.headers.get('origin') || 'https://theplayerportal.net'
    fetch(`${origin}/api/email/migration-invite-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ orgId, invitations: invitationsToSend }),
    }).catch((err) => console.error('Failed to queue invitations', err))
    summary.invitationsQueued = invitationsToSend.length
  }

  return NextResponse.json({ ok: true, summary })
}

// Fetch unique classes + their counts from pending rows — used by the wizard
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const rows = (body.rows || []) as ImportRow[]
  const counts = new Map<string, number>()
  for (const r of rows) {
    const key = (r.group_name || '(unmapped)').trim()
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const unique = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  return NextResponse.json({ ok: true, unique })
}
