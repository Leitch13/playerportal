import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Generate a 9-character temporary password using crypto.randomInt for entropy.
 * Character set excludes visually-ambiguous glyphs (0/O, 1/l/I) so the password
 * is reliably typeable from an email.
 *
 * Format: 4 letters + 4 digits + 1 symbol — meets Supabase's 6-char minimum
 * with comfortable margin and includes mixed character classes by construction.
 */
function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%*'
  const parts: string[] = []
  for (let i = 0; i < 4; i++) parts.push(letters[randomInt(letters.length)])
  for (let i = 0; i < 4; i++) parts.push(digits[randomInt(digits.length)])
  parts.push(symbols[randomInt(symbols.length)])
  return parts.join('')
}

// Admin-provisioned staff creation. This is the SAFE replacement for the old
// "copy ?role=coach invite link" buttons, which became dead after the public
// role-escalation fix (public signup now always creates parents).
//
// Trust model: the caller must be a signed-in admin; their role AND their
// organisation are derived server-side from the session (get_my_role /
// get_my_org, both SECURITY DEFINER). The client may only supply email,
// full_name and role — never organisation_id. The new staff role is written
// explicitly with the service-role key AFTER creation, so the hardened
// handle_new_user trigger (which forces 'parent') is preserved and no public
// signup path can escalate.

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  // ── 1. AuthN + AuthZ — caller must be a signed-in admin of an academy ──
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  }
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only academy admins can add staff.' }, { status: 403 })
  }
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) {
    return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })
  }

  // ── 2. Input — client may ONLY provide these three. org comes from the caller. ──
  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const fullName = String(body.full_name || '').trim()
  const newRole = body.role
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (!fullName) {
    return NextResponse.json({ error: "Enter the staff member's name." }, { status: 400 })
  }
  if (newRole !== 'coach' && newRole !== 'admin') {
    return NextResponse.json({ error: 'Role must be coach or admin.' }, { status: 400 })
  }

  const db = adminDb()

  // Caller's academy (slug for trigger placement, name/contact for the email).
  const { data: org } = await db
    .from('organisations')
    .select('id, slug, name, contact_email')
    .eq('id', orgId)
    .single()
  if (!org) {
    return NextResponse.json({ error: 'Your academy could not be found.' }, { status: 400 })
  }

  // ── 3. Duplicate-email pre-check — never reassign a profile across academies ──
  // One auth user per email, so at most one profile.
  const { data: existingRows } = await db
    .from('profiles')
    .select('id, full_name, role, organisation_id')
    .ilike('email', email)
    .limit(1)
  const existing = existingRows?.[0]

  if (existing) {
    if (existing.organisation_id && existing.organisation_id !== org.id) {
      return NextResponse.json(
        { error: "That email already belongs to a different academy. They'll need to leave it before you can add them here." },
        { status: 409 }
      )
    }
    // Same academy (or an unattached account): promote to the requested staff
    // role and claim into this academy. We do NOT touch any other academy.
    const { error: upErr } = await db
      .from('profiles')
      .update({ role: newRole, organisation_id: org.id, full_name: existing.full_name || fullName })
      .eq('id', existing.id)
    if (upErr) {
      return NextResponse.json({ error: 'Could not update that account.' }, { status: 500 })
    }
    // Existing user is being promoted — they already have a password, do NOT
    // reset it. Send the email without credentials, just the promotion notice.
    await sendStaffEmail({ email, fullName: existing.full_name || fullName, role: newRole, org, tempPassword: null })
    return NextResponse.json({ status: 'updated', userId: existing.id })
  }

  // ── 4. Create the auth user server-side. Role is NOT passed in metadata —
  // the hardened trigger forces 'parent'; we set the real role in step 5. ──
  // The temp password is emailed verbatim to the staff member as their first
  // sign-in credential — see the email-credentials approach in sendStaffEmail.
  const tempPassword = generateTempPassword()
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, org_slug: org.slug },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message || ''
    return NextResponse.json(
      {
        error: /already|exists|registered/i.test(msg)
          ? 'An account with that email already exists. Ask them to use “Forgot password” on the sign-in page, then try adding them again.'
          : 'Could not create the staff account. Please try again.',
      },
      { status: 400 }
    )
  }
  const userId = created.user.id

  // ── 5. Ensure the profile row is in THIS academy with the staff role ──
  // The handle_new_user trigger created a row with the hardcoded 'parent'
  // role (security: 091 hardening). We MUST overwrite it here, and if that
  // write fails for any reason we cannot silently return success — the
  // admin would see a green toast for a coach who is still a parent.
  const { data: prof } = await db.from('profiles').select('id').eq('id', userId).maybeSingle()
  const profileWriteError = prof
    ? (await db.from('profiles').update({ role: newRole, organisation_id: org.id, full_name: fullName }).eq('id', userId)).error
    : (await db.from('profiles').insert({ id: userId, email, full_name: fullName, role: newRole, organisation_id: org.id })).error

  if (profileWriteError) {
    return NextResponse.json(
      {
        error:
          "The account was created but the staff role couldn't be set. Please try adding them again — if the issue persists, contact support.",
      },
      { status: 500 }
    )
  }

  // ── 6. Invite email with sign-in credentials (best-effort) ──
  // PRAGMATIC ACCESS HOTFIX: instead of a Supabase recovery action_link (which
  // had multiple failure modes through /auth/reset-password), we email the
  // temp password directly. The staff member uses it to sign in at /auth/signin.
  // We'll restore polished recovery links once the reset flow is stable.
  await sendStaffEmail({ email, fullName, role: newRole, org, tempPassword })

  return NextResponse.json({ status: 'created', userId })
}

async function sendStaffEmail(
  { email, fullName, role, org, tempPassword }: {
    email: string
    fullName: string
    role: string
    org: { name: string | null; contact_email: string | null }
    /** Null for promotions of existing accounts — they keep their current password. */
    tempPassword: string | null
  }
) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

    const { sendEmail } = await import('@/lib/email')
    const { staffInviteEmail } = await import('@/lib/email-templates')
    const tpl = staffInviteEmail({
      staffName: (fullName || '').split(' ')[0] || 'there',
      academyName: org.name || 'your academy',
      role,
      signinEmail: email,
      tempPassword,
      signinUrl: `${appUrl}/auth/signin`,
      supportEmail: org.contact_email || 'support@theplayerportal.net',
    })
    await sendEmail({ to: email, ...tpl, fromName: org.name || undefined, replyTo: org.contact_email || undefined })
  } catch {
    // Email is best-effort — the account is already provisioned. The admin can
    // tell the staff member to use "Forgot password" if the email doesn't land.
  }
}
