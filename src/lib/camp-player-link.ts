import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Turn a PAID camp booking into a real player.
 *
 * Why this exists
 * ---------------
 * A camp booking is free text — child_name, child_dob, parent_email — with
 * no players row and no parent account behind it. That is fine for taking
 * the money and useless for everything after: a progress report is keyed on
 * progress_reviews.player_id and emailed through players.parent_id →
 * profiles.email, so a camp-only child cannot be written a report and has
 * nobody to send it to. Academies are promising camp reports in their
 * marketing. This is what makes that promise deliverable.
 *
 * What it does, in order
 * ----------------------
 *   1. Parent  — find the profile by email. If there isn't one, create the
 *                account (same path the admin add-player route uses) and
 *                send a set-password email so the parent can actually get
 *                in to read the report. Account creation is opt-in per call
 *                site: the backfill script never creates accounts.
 *   2. Player  — find an existing child under that parent at this academy
 *                by name and date of birth. Only insert if none matches.
 *                Duplicate player rows cost one academy a fortnight of
 *                reconciliation this month; this must not add to that.
 *   3. Link    — write camp_bookings.player_id (migration 112).
 *
 * What it never does
 * ------------------
 *   • Run for a pending booking. The caller is responsible for that; every
 *     call site sits after payment_status = 'paid'. An abandoned checkout
 *     must not manufacture a roster entry.
 *   • Throw. Every failure is logged and returned as `skipped`. The booking
 *     is already paid and the confirmation email already queued — nothing
 *     here may roll that back or fail the webhook.
 *   • Look up auth users by paging listUsers(perPage: 200). That stops
 *     finding anyone past the 200th account and there are over a thousand.
 *     Profiles carry the email; that is the lookup.
 */

export interface CampBookingForLink {
  id: string
  organisation_id: string
  parent_name: string | null
  parent_email: string
  parent_phone?: string | null
  child_name: string
  child_dob?: string | null
  medical_info?: string | null
  photo_consent?: boolean | null
  player_id?: string | null
}

export interface LinkResult {
  playerId: string | null
  playerCreated: boolean
  parentCreated: boolean
  skipped?: string
}

interface LinkOptions {
  /** Create a parent account when none exists. Default true for live bookings; the backfill passes false. */
  createParentAccount?: boolean
  /** Used in the welcome email so the parent knows which camp this is about. */
  campName?: string | null
}

const PLACEHOLDER_EMAIL_DOMAIN = '@theplayerportal.net'

/** "Lucas Mazs" → ["Lucas", "Mazs"]; "Matthew" → ["Matthew", <parent surname or ''>]. */
function splitChildName(childName: string, parentName: string | null): [string, string] {
  const parts = childName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return [parts.slice(0, -1).join(' '), parts[parts.length - 1]]
  const parentParts = (parentName || '').trim().split(/\s+/).filter(Boolean)
  const surname = parentParts.length >= 2 ? parentParts[parentParts.length - 1] : ''
  return [parts[0] || 'Unnamed', surname]
}

export async function linkCampBookingToPlayer(
  admin: SupabaseClient,
  booking: CampBookingForLink,
  opts: LinkOptions = {},
): Promise<LinkResult> {
  const createParentAccount = opts.createParentAccount !== false
  const none = (why: string): LinkResult => ({ playerId: null, playerCreated: false, parentCreated: false, skipped: why })

  try {
    if (booking.player_id) return { playerId: booking.player_id, playerCreated: false, parentCreated: false, skipped: 'already linked' }

    const email = (booking.parent_email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) return none('no parent email')
    // Admin-added campers with no real parent email get a synthetic address.
    // That is not a person and must not become an account.
    if (email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)) return none('placeholder email')

    // ── 1. Parent ──────────────────────────────────────────────────────
    // ilike with no wildcard is a case-insensitive equality match.
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, organisation_id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    let parentId: string | null = (existingProfile as { id: string } | null)?.id || null
    let parentCreated = false

    if (!parentId) {
      if (!createParentAccount) return none('no parent account')

      const { data: orgRow } = await admin
        .from('organisations')
        .select('slug, name, contact_email')
        .eq('id', booking.organisation_id)
        .maybeSingle()
      const orgSlug = (orgRow as { slug?: string } | null)?.slug
      if (!orgSlug) return none('org slug not found')

      const fullName = (booking.parent_name || '').trim() || email.split('@')[0]
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-6) + 'A1!'
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone: booking.parent_phone || null, role: 'parent', org_slug: orgSlug },
      })

      if (createErr) {
        // Most likely the auth user exists but the profile row does not, or
        // two webhooks raced. Re-check the profile rather than page listUsers.
        const { data: retry } = await admin.from('profiles').select('id').ilike('email', email).limit(1).maybeSingle()
        parentId = (retry as { id: string } | null)?.id || null
        if (!parentId) {
          console.error('[camp-player-link] parent account not created', booking.id, createErr.message)
          return none(`parent create failed: ${createErr.message}`)
        }
      } else {
        parentId = created?.user?.id || null
        if (!parentId) return none('parent create returned no id')
        parentCreated = true
      }

      // Guarantee the profile carries org + role + name even if the
      // handle_new_user trigger did not fill them in.
      const { error: profileErr } = await admin.from('profiles').upsert(
        { id: parentId, email, full_name: fullName, phone: booking.parent_phone || null, role: 'parent', organisation_id: booking.organisation_id },
        { onConflict: 'id' },
      )
      if (profileErr) console.error('[camp-player-link] profile upsert failed', booking.id, profileErr.message)

      if (parentCreated) {
        await sendParentWelcome(admin, {
          email,
          parentName: fullName,
          childName: booking.child_name,
          campName: opts.campName || null,
          academyName: (orgRow as { name?: string } | null)?.name || 'your academy',
          academyEmail: (orgRow as { contact_email?: string | null } | null)?.contact_email || null,
        })
      }
    }

    // ── 2. Player ──────────────────────────────────────────────────────
    const [firstName, lastName] = splitChildName(booking.child_name, booking.parent_name)
    const dob = booking.child_dob || null

    const { data: candidates } = await admin
      .from('players')
      .select('id, date_of_birth')
      .eq('parent_id', parentId)
      .eq('organisation_id', booking.organisation_id)
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .is('archived_at', null)
      .limit(5)

    const match = ((candidates || []) as { id: string; date_of_birth: string | null }[]).find(
      (c) => !dob || !c.date_of_birth || c.date_of_birth === dob,
    )

    let playerId: string | null = match?.id || null
    let playerCreated = false

    // Same child under a DIFFERENT parent account at this academy — mum booked
    // the class, dad booked the camp. Exact name and exact DOB, both present.
    // Link to the row that exists rather than mint a second one; two rows for
    // one child is what cost an academy a fortnight of reconciliation this
    // month. The report goes to whichever parent is on the player record —
    // same household.
    if (!playerId && dob) {
      const { data: elsewhere } = await admin
        .from('players')
        .select('id, parent_id')
        .eq('organisation_id', booking.organisation_id)
        .ilike('first_name', firstName)
        .ilike('last_name', lastName)
        .eq('date_of_birth', dob)
        .is('archived_at', null)
        .neq('parent_id', parentId)
        .limit(1)
      const other = ((elsewhere || []) as { id: string; parent_id: string }[])[0]
      if (other) {
        playerId = other.id
        console.warn('[camp-player-link] child already exists under another parent; linked rather than duplicated', booking.id, other.id)
      }
    }

    if (!playerId) {
      const { data: inserted, error: insErr } = await admin
        .from('players')
        .insert({
          organisation_id: booking.organisation_id,
          parent_id: parentId,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dob,
          medical_info: booking.medical_info || null,
          playing_level: 'development',
          // The camp form asks photo consent and it is mandatory there, so a
          // paid booking always carries an answer. Carry it onto the child
          // so the register's NO PHOTOS pill sees it.
          ...(booking.photo_consent === true || booking.photo_consent === false
            ? { photo_consent: booking.photo_consent, photo_consent_at: new Date().toISOString(), photo_consent_source: 'camp_booking' }
            : {}),
        })
        .select('id')
        .single()
      if (insErr || !inserted) {
        console.error('[camp-player-link] player insert failed', booking.id, insErr?.message)
        return { playerId: null, playerCreated: false, parentCreated, skipped: `player insert failed: ${insErr?.message}` }
      }
      playerId = (inserted as { id: string }).id
      playerCreated = true
    }

    // ── 3. Link ────────────────────────────────────────────────────────
    const { error: linkErr } = await admin.from('camp_bookings').update({ player_id: playerId }).eq('id', booking.id)
    if (linkErr) console.error('[camp-player-link] booking link failed', booking.id, linkErr.message)

    return { playerId, playerCreated, parentCreated }
  } catch (err) {
    console.error('[camp-player-link] unexpected', booking.id, err instanceof Error ? err.message : err)
    return none('unexpected error')
  }
}

/**
 * Tell a newly created parent they have an account, with a direct
 * set-password link. Same token_hash → /auth/confirm bridge the staff invite
 * uses; the default Supabase action_link lands PKCE users with no session.
 * Best-effort: the account exists regardless, and "Forgot password" on the
 * sign-in page always works as a fallback.
 */
async function sendParentWelcome(
  admin: SupabaseClient,
  p: { email: string; parentName: string; childName: string; campName: string | null; academyName: string; academyEmail: string | null },
) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
    let actionLink: string | null = null
    try {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: p.email,
        options: { redirectTo: `${appUrl}/auth/reset-password` },
      })
      const props = linkData?.properties as { hashed_token?: string } | undefined
      actionLink = props?.hashed_token
        ? `${appUrl}/auth/confirm?token_hash=${props.hashed_token}&type=recovery&next=${encodeURIComponent('/auth/reset-password')}`
        : null
    } catch { /* fall back to Forgot-password instructions in the template */ }

    const [{ sendEmail }, { campParentAccountEmail }] = await Promise.all([
      import('@/lib/email'),
      import('@/lib/email-templates'),
    ])
    const tpl = campParentAccountEmail({
      parentName: p.parentName.split(' ')[0] || 'there',
      childName: p.childName,
      campName: p.campName,
      academyName: p.academyName,
      actionLink,
      signinUrl: `${appUrl}/auth/signin`,
      supportEmail: p.academyEmail || 'support@theplayerportal.net',
    })
    await sendEmail({ to: p.email, subject: tpl.subject, html: tpl.html, fromName: p.academyName, replyTo: p.academyEmail || undefined })
  } catch (err) {
    console.error('[camp-player-link] welcome email failed', p.email, err instanceof Error ? err.message : err)
  }
}
