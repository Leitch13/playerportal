#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Cancel an academy signup (spam / fraudulent / mistaken onboarding).
//
// /api/onboard creates an organisation with platform_subscription_status='trial'
// and is_published=true, so a junk signup is immediately live and publicly
// bookable at /book/<slug> under our own domain. The /platform dashboard is
// read-only, so until now there was no way to take one down short of
// hand-written SQL.
//
// DRY RUN BY DEFAULT. Nothing is written without --apply.
//
//   # Find it first — the signup notification email is skipped silently when
//   # ADMIN_NOTIFICATION_EMAIL is unset, so the inbox is not a complete record
//   node scripts/cancel-academy-signup.mjs --search=church
//   node scripts/cancel-academy-signup.mjs --recent=20
//
//   # Look, don't touch (default)
//   node scripts/cancel-academy-signup.mjs --slug=regions-bank
//
//   # Soft cancel — reversible: unpublishes + marks cancelled, keeps every row
//   node scripts/cancel-academy-signup.mjs --slug=regions-bank --apply
//
//   # Hard delete — irreversible: removes the org, its rows and its auth users
//   node scripts/cancel-academy-signup.mjs --slug=regions-bank --purge --apply
//
// Credentials come from the environment:
//   vercel env pull /tmp/.env.prod --environment=production --yes
//   set -a; source /tmp/.env.prod; set +a
//
// Flags:
//   --search=<text> list academies matching name / slug / contact email / location
//   --recent=<n>   list the n most recent signups (default 20)
//   --slug=a,b     target academies by slug (comma-separated)
//   --id=<uuid>    target academies by organisation id (comma-separated)
//   --apply        actually write (otherwise dry run)
//   --purge        hard delete instead of soft cancel
//   --force        proceed even when the safety interlock finds real activity
//   --reason=<txt> note recorded in audit_log (default: "spam signup")
//
// This script never touches Stripe. If an academy has a platform subscription
// or a Connect account, it says so and leaves those for the Stripe dashboard.
// ─────────────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
)

const SLUGS = (args.slug || '').split(',').map((s) => s.trim()).filter(Boolean)
const IDS = (args.id || '').split(',').map((s) => s.trim()).filter(Boolean)
const APPLY = args.apply === 'true'
const PURGE = args.purge === 'true'
const FORCE = args.force === 'true'
const REASON = args.reason && args.reason !== 'true' ? args.reason : 'spam signup'

const SEARCH = args.search && args.search !== "true" ? args.search : null
const RECENT = args.recent ? Number(args.recent === "true" ? 20 : args.recent) : null
const LISTING = Boolean(SEARCH || RECENT)

if (!LISTING && !SLUGS.length && !IDS.length) {
  console.error("Nothing to do. Find an academy, then cancel it:")
  console.error("  --search=<text>   list academies matching a name, slug or contact email")
  console.error("  --recent=<n>      list the n most recent signups (default 20)")
  console.error("  --slug=<slug>     target one for cancellation")
  process.exit(1)
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.')
  console.error('  vercel env pull /tmp/.env.prod --environment=production --yes')
  console.error('  set -a; source /tmp/.env.prod; set +a')
  process.exit(1)
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function rest(path, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, ...(init.headers || {}) },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(`DB ${res.status} on ${path}: ${JSON.stringify(body).slice(0, 300)}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

async function countRows(table, orgId) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=*&organisation_id=eq.${orgId}&limit=1`, {
    headers: { ...H, Prefer: 'count=exact' },
  })
  if (!res.ok) return null // table absent or not org-scoped — never let it block
  return Number((res.headers.get('content-range') || '').split('/')[1] || 0)
}

// Tables that mean "a real human has used this academy". A junk signup has
// zero of everything; a live academy does not. This interlock is what stops a
// mistyped slug from taking down a paying customer.
const ACTIVITY_TABLES = [
  'players', 'enrolments', 'subscriptions', 'payments',
  'trial_bookings', 'camp_bookings', 'training_groups', 'leads',
]

// Every table carrying organisation_id, ordered dependents-first. Almost none
// of these FKs specify ON DELETE CASCADE, so deleting the organisation row
// while any child survives fails with a foreign-key violation — the sweep below
// clears them first. profiles is last: it is cascade-deleted by removing the
// auth user, and is referenced by training_groups.coach_id.
const ORG_TABLES = [
  'attendance', 'progress_reviews', 'session_notes',
  'enrolment_discounts', 'enrolments',
  'camp_booking_days', 'camp_bookings', 'camp_days', 'camps',
  'announcement_reads', 'announcements',
  'conversation_messages', 'conversations', 'messages',
  'merchandise_orders', 'merchandise',
  'payment_reminders', 'cancellations', 'payments',
  'subscriptions', 'subscription_plans',
  'waitlist', 'trial_bookings', 'review_prompts', 'leads',
  'players', 'training_groups', 'training_plans', 'session_plans',
  'documents', 'drills', 'terms', 'holidays',
  'skill_levels', 'scoring_categories',
  'coach_certifications', 'cpd_hours',
  'academy_awards', 'academy_terms_acceptances',
  'audit_log', 'stripe_events',
  'profiles',
]

const banner = (s) => console.log(`\n${'─'.repeat(74)}\n${s}\n${'─'.repeat(74)}`)

async function resolveOrgs() {
  const found = []
  for (const slug of SLUGS) {
    const rows = await rest(`organisations?select=*&slug=eq.${encodeURIComponent(slug)}`)
    if (!rows.length) console.warn(`⚠️  no academy with slug "${slug}" — skipping`)
    else found.push(rows[0])
  }
  for (const id of IDS) {
    const rows = await rest(`organisations?select=*&id=eq.${encodeURIComponent(id)}`)
    if (!rows.length) console.warn(`⚠️  no academy with id "${id}" — skipping`)
    else found.push(rows[0])
  }
  return found
}

// Delete org-scoped rows, retrying across passes so that FK violations resolve
// as their dependencies clear. Returns the tables that never came clean.
async function sweepChildRows(orgId) {
  let remaining = [...ORG_TABLES]
  for (let pass = 0; pass < 4 && remaining.length; pass++) {
    const stuck = []
    for (const table of remaining) {
      try {
        await rest(`${table}?organisation_id=eq.${orgId}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        })
      } catch (e) {
        // 404/400 = table or column doesn't exist here; anything else is a real
        // blocker (usually an FK) worth retrying on the next pass.
        if (e.status !== 404 && e.status !== 400) stuck.push(table)
      }
    }
    if (stuck.length === remaining.length) return stuck // no progress — stop
    remaining = stuck
  }
  return remaining
}

async function listAcademies() {
  let path
  if (SEARCH) {
    const q = encodeURIComponent(`*${SEARCH}*`)
    path = `organisations?select=*&or=(name.ilike.${q},slug.ilike.${q},contact_email.ilike.${q},location.ilike.${q})&order=created_at.desc`
  } else {
    path = `organisations?select=*&order=created_at.desc&limit=${RECENT}`
  }
  const rows = await rest(path)
  banner(SEARCH ? `Academies matching "${SEARCH}" — ${rows.length} found` : `${rows.length} most recent academies`)
  if (!rows.length) {
    console.log("Nothing matched.")
    return
  }
  for (const o of rows) {
    console.log(`\n${o.name}`)
    console.log(`  slug         ${o.slug}`)
    console.log(`  id           ${o.id}`)
    console.log(`  created      ${o.created_at}`)
    console.log(`  contact      ${o.contact_email || "—"}  ${o.contact_phone || ""}`)
    console.log(`  location     ${o.location || "—"}`)
    console.log(`  platform     ${o.platform_subscription_status}${o.is_published ? " · published" : " · not published"}`)
    console.log(`  cancel with  --slug=${o.slug}`)
  }
  banner("Read-only listing — nothing was changed.")
}

async function main() {
  if (LISTING) return listAcademies()

  banner(
    `Cancel academy signup — ${APPLY ? 'APPLY' : 'DRY RUN'} · ${PURGE ? 'HARD DELETE (purge)' : 'soft cancel'}`
  )
  if (!APPLY) console.log('No writes will be made. Re-run with --apply to execute.')

  const orgs = await resolveOrgs()
  if (!orgs.length) {
    console.error('\nNo matching academies. Nothing to do.')
    process.exit(1)
  }

  for (const org of orgs) {
    console.log(`\n▸ ${org.name}  (${org.slug})`)
    console.log(`  id             ${org.id}`)
    console.log(`  contact        ${org.contact_email || '—'}  ${org.contact_phone || ''}`)
    console.log(`  location       ${org.location || '—'}`)
    console.log(`  created        ${org.created_at}`)
    console.log(`  platform sub   ${org.platform_subscription_status}`)
    console.log(`  published      ${org.is_published}`)
    console.log(`  booking page   ${org.is_published ? `https://www.theplayerportal.net/book/${org.slug}` : 'not live'}`)

    // ── safety interlock ──
    const activity = {}
    for (const t of ACTIVITY_TABLES) {
      const n = await countRows(t, org.id)
      if (n) activity[t] = n
    }
    const people = await rest(`profiles?select=id,email,full_name,role&organisation_id=eq.${org.id}`)
    console.log(
      `  profiles       ${people.length}${people.length ? ` (${people.map((a) => `${a.email}:${a.role}`).join(', ')})` : ''}`
    )

    if (Object.keys(activity).length) {
      console.log(`  activity       ${Object.entries(activity).map(([k, v]) => `${k}=${v}`).join(', ')}`)
      console.log(`\n  ⛔ This academy has real activity — that is not what a spam signup looks like.`)
      if (!FORCE) {
        console.log(`     Refusing to touch it. Re-run with --force if you are certain.`)
        continue
      }
      console.log(`     --force given — proceeding anyway.`)
    } else {
      console.log(`  activity       none (no players, enrolments, bookings or payments)`)
    }

    if (org.platform_stripe_subscription_id || org.stripe_account_id) {
      const bits = [
        org.platform_stripe_subscription_id && `platform sub ${org.platform_stripe_subscription_id}`,
        org.stripe_account_id && `Connect account ${org.stripe_account_id}`,
      ].filter(Boolean)
      console.log(`\n  ⚠️  Stripe objects attached: ${bits.join(', ')}`)
      console.log(`     This script does NOT touch Stripe — handle those in the Stripe dashboard.`)
    }

    if (PURGE) {
      console.log(`\n  → PURGE: delete ${people.length} auth user(s), clear org-scoped rows, delete the organisation.`)
      console.log(`     This cannot be undone.`)
      if (APPLY) {
        for (const p of people) {
          const res = await fetch(`${URL}/auth/v1/admin/users/${p.id}`, { method: 'DELETE', headers: H })
          console.log(`     ${res.ok ? '✓ deleted' : `✗ failed (${res.status})`} auth user ${p.email}`)
        }
        const stuck = await sweepChildRows(org.id)
        if (stuck.length) {
          console.log(`     ✗ could not clear: ${stuck.join(', ')}`)
          console.log(`       Organisation row left in place — resolve these, then re-run.`)
          continue
        }
        await rest(`organisations?id=eq.${org.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
        console.log(`     ✓ deleted organisation ${org.slug}`)
      }
    } else {
      console.log(`\n  → SOFT CANCEL: is_published=false, platform_subscription_status='cancelled'.`)
      console.log(`     Booking page goes dark immediately. Every row kept. Reversible.`)
      if (APPLY) {
        await rest(`organisations?id=eq.${org.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            is_published: false,
            platform_subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          }),
        })
        console.log(`     ✓ cancelled + unpublished ${org.slug}`)

        // Audit only on soft cancel — a purge deletes audit_log rows for the org
        // and drops the FK target, so there is nowhere consistent to record it.
        try {
          await rest('audit_log', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              organisation_id: org.id,
              action: 'academy.cancelled',
              entity_type: 'organisation',
              entity_id: org.id,
              details: { slug: org.slug, name: org.name, reason: REASON, forced: FORCE },
            }),
          })
        } catch (e) {
          console.log(`     (audit_log write skipped: ${e.message.slice(0, 80)})`)
        }
      }
    }
  }

  banner(APPLY ? 'Done.' : 'Dry run complete — nothing was changed.')
}

main().catch((e) => {
  console.error(`\nFAILED: ${e.message}`)
  process.exit(1)
})
