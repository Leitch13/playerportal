import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Admin quick-add player.
 *
 * Why this exists: the old client-side implementation called
 * `supabase.auth.signUp()` from the admin's browser to create the parent. That
 * REPLACED the admin's session with the new parent's, then tried to insert the
 * player as the new (unconfirmed) user — which RLS rightly rejected, surfacing
 * a red error message. Moving creation server-side with the service role keeps
 * the admin signed in throughout and bypasses the RLS dance.
 *
 * Body:
 *   {
 *     mode: 'existing' | 'new',
 *     firstName, lastName, dob?, ageGroup?, playingLevel?, leagueLevel?,
 *     parentId?  (when mode === 'existing'),
 *     parentName?, parentEmail?, parentPhone?  (when mode === 'new'),
 *     groupId? — optional auto-enrol
 *   }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only academy admins can add players from here.' }, { status: 403 })
  }
  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) {
    return NextResponse.json({ error: 'No academy on your account.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const mode = body.mode as 'existing' | 'new'
  const firstName = (body.firstName as string | undefined)?.trim() || ''
  const lastName = (body.lastName as string | undefined)?.trim() || ''
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── Resolve the parent (existing or create new) ──
  let resolvedParentId: string | null = null

  if (mode === 'existing') {
    resolvedParentId = (body.parentId as string | undefined) || null
    if (!resolvedParentId) {
      return NextResponse.json({ error: 'Please pick a parent from the list.' }, { status: 400 })
    }
  } else if (mode === 'new') {
    const parentName = (body.parentName as string | undefined)?.trim() || ''
    const parentEmail = (body.parentEmail as string | undefined)?.trim().toLowerCase() || ''
    const parentPhone = (body.parentPhone as string | undefined)?.trim() || null
    if (!parentName || !parentEmail) {
      return NextResponse.json({ error: 'Parent name and email are required.' }, { status: 400 })
    }

    // 1. Try to create the auth user. If the email is already in use, fall back
    //    to looking them up — same parent, just relink them.
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: parentEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: parentName, phone: parentPhone, role: 'parent' },
    })

    if (createErr) {
      // Look up by email (auth.admin.listUsers supports filter via page scan).
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const existing = listed?.users?.find(u => u.email?.toLowerCase() === parentEmail)
      if (existing) {
        resolvedParentId = existing.id
      } else {
        return NextResponse.json(
          { error: createErr.message || 'Could not create the parent account.' },
          { status: 400 }
        )
      }
    } else {
      resolvedParentId = created?.user?.id || null
    }

    if (!resolvedParentId) {
      return NextResponse.json({ error: 'Failed to resolve parent account.' }, { status: 500 })
    }

    // 2. Ensure the profile row exists with the correct org + role + name. The
    //    handle_new_user trigger (if installed) sets bare-bones fields; we
    //    upsert to guarantee org_id + display name even if the trigger didn't
    //    fire.
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: resolvedParentId,
      email: parentEmail,
      full_name: parentName,
      phone: parentPhone,
      role: 'parent',
      organisation_id: orgId,
    }, { onConflict: 'id' })
    if (profileErr) {
      return NextResponse.json({ error: `Parent created but profile setup failed: ${profileErr.message}` }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'mode must be "existing" or "new"' }, { status: 400 })
  }

  // ── Insert the player ──
  const allowedLevels = ['beginner', 'development', 'intermediate', 'advanced', 'elite']
  const playingLevel = (body.playingLevel as string | undefined) || 'development'
  if (!allowedLevels.includes(playingLevel)) {
    return NextResponse.json({ error: 'Invalid player level.' }, { status: 400 })
  }

  const { data: player, error: playerErr } = await admin.from('players').insert({
    organisation_id: orgId,
    parent_id: resolvedParentId,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: (body.dob as string | undefined) || null,
    age_group: (body.ageGroup as string | undefined) || null,
    playing_level: playingLevel,
    league_level: (body.leagueLevel as string | undefined) || null,
  }).select('id').single()

  if (playerErr) {
    return NextResponse.json({ error: playerErr.message }, { status: 500 })
  }

  // ── Optional auto-enrol ──
  const groupId = body.groupId as string | undefined
  if (groupId && player?.id) {
    const { error: enrolErr } = await admin.from('enrolments').insert({
      organisation_id: orgId,
      player_id: player.id,
      group_id: groupId,
      status: 'active',
    })
    if (enrolErr) {
      // Player is created — don't fail the whole thing, just flag the partial.
      return NextResponse.json({
        success: true,
        playerId: player.id,
        warning: `Player added, but couldn't enrol in class: ${enrolErr.message}`,
      })
    }
  }

  return NextResponse.json({ success: true, playerId: player?.id })
}
