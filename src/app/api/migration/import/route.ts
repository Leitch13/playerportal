import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'
// Migration Safety Phase 1 — give the route headroom to process up to a 10-row
// chunk safely without timing out on cold starts + auth signup latency. Chunking
// in the client (10 rows / call) keeps each call well under this ceiling; the
// 300s budget is the safety net, not the design.
export const maxDuration = 300

/**
 * Bulk migration wizard import. Creates players + parents + enrolments + pending
 * subscriptions with invitation tokens for parents.
 *
 * Migration Safety Phase 1 changes:
 *   • Cross-academy collision detection — if a parent email already belongs
 *     to a DIFFERENT organisation, the row is rejected as a `conflict` and
 *     no profile/player/enrolment/subscription writes occur. Previously this
 *     path silently overwrote profiles.organisation_id (same bug pattern as
 *     the booking write path hotfix 4ba6ed6).
 *   • Returns conflicts[] in the summary so the wizard can show admin which
 *     rows need manual handling.
 *   • Returns invitations[] in the summary so the wizard can drive email
 *     sending separately (after admin reviews conflicts).
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

interface Invitation {
  email: string
  parentName: string
  childName: string
  token: string
  planAmount: number
  planName: string
}

interface ConflictRow {
  row: number
  email: string
  existingAcademyId: string
  existingAcademyName: string
  reason: string
}

// Migration Safety Phase 1.1 — DOB mismatch on an otherwise-matching player.
// Rather than silently reuse the existing player (could be a typo on the old
// system OR a genuinely different child with the same name), we surface it
// to the admin and write nothing for this row.
interface WarningRow {
  row: number
  email: string
  childName: string
  existingPlayerId: string
  existingDOB: string | null
  csvDOB: string | null
  reason: string
}

interface ImportSummary {
  imported: number
  skipped: number
  conflicts: ConflictRow[]
  warnings: WarningRow[]
  errors: { row: number; email?: string; error: string }[]
  invitations: Invitation[]
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

  let body: { rows?: ImportRow[]; classMap?: Record<string, ClassMapping>; billingStartsAt?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = body.rows || []
  const classMap = body.classMap || {}

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

  const summary: ImportSummary = {
    imported: 0,
    skipped: 0,
    conflicts: [],
    warnings: [],
    errors: [],
    invitations: [],
  }

  const parentByEmail = new Map<string, string>()

  // Resolve plan details for email copy
  const planIds = Array.from(new Set(
    Object.values(classMap).map((m) => m.planId).filter((v): v is string => !!v)
  ))
  const { data: planRows } = planIds.length > 0
    ? await admin.from('subscription_plans').select('id, name, amount').in('id', planIds)
    : { data: [] as { id: string; name: string; amount: number }[] }
  const planById = new Map((planRows || []).map((p) => [p.id as string, { name: p.name as string, amount: Number(p.amount) }]))

  // Cache of org-name lookups for conflict error copy
  const orgNameById = new Map<string, string>()
  async function getOrgName(id: string): Promise<string> {
    const cached = orgNameById.get(id)
    if (cached) return cached
    const { data } = await admin.from('organisations').select('name').eq('id', id).maybeSingle()
    const name = (data as { name?: string } | null)?.name || 'another academy'
    orgNameById.set(id, name)
    return name
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    try {
      const email = (r.parent_email || '').trim().toLowerCase()
      if (!email) {
        summary.skipped++
        continue
      }

      const mapping = classMap[r.group_name] || { groupId: null, planId: null }

      // ─── Cross-academy collision detection (Migration Safety Phase 1) ───
      // Lookup the existing profile WITH its organisation_id. The previous code
      // SELECTed only the id and then UPDATEed organisation_id unconditionally,
      // silently moving Jamie Allan / JSL parents to the importing academy.
      // Now: same-org match is OK to reuse; different-org match is a hard stop.
      let parentId = parentByEmail.get(email) || null
      if (!parentId) {
        const { data: existing } = await admin
          .from('profiles')
          .select('id, organisation_id, full_name, phone')
          .eq('email', email)
          .maybeSingle()

        if (existing?.id) {
          const existingOrgId = (existing as { organisation_id?: string | null }).organisation_id ?? null
          if (existingOrgId && existingOrgId !== orgId) {
            const academyName = await getOrgName(existingOrgId)
            summary.conflicts.push({
              row: i + 1,
              email,
              existingAcademyId: existingOrgId,
              existingAcademyName: academyName,
              reason: `Parent email already exists in ${academyName}. Migrate manually or ask support.`,
            })
            // CRITICAL: skip ALL writes for this row — no profile update, no
            // player, no enrolment, no subscription. The conflict is reported
            // to the admin who can handle it via /dashboard/migrate-member
            // (single-family flow) or contact support.
            continue
          }

          // Same-org match (or NULL org): safe to reuse. Only update
          // contact fields if the importing CSV provides better data. Do
          // NOT overwrite organisation_id (the import CSV doesn't carry it
          // and same-org reuse means it's already correct).
          parentId = existing.id
          const updates: Record<string, unknown> = { role: 'parent' }
          if (r.parent_name && !(existing as { full_name?: string | null }).full_name) {
            updates.full_name = r.parent_name
          }
          if (r.parent_phone && !(existing as { phone?: string | null }).phone) {
            updates.phone = r.parent_phone
          }
          // Only fill organisation_id if it was null (orphan profile)
          if (!existingOrgId) {
            updates.organisation_id = orgId
          }
          await admin.from('profiles').update(updates).eq('id', parentId)
        } else {
          // No profile at all — create auth user. handle_new_user trigger
          // (if present) creates the profile row; we upsert manually as fallback.
          const { data: authResult, error: authErr } = await admin.auth.admin.createUser({
            email,
            email_confirm: false, // parent confirms via magic link / signin later
            user_metadata: { full_name: r.parent_name || '', imported: true, source: 'classforkids' },
          })
          if (authErr || !authResult?.user) {
            summary.errors.push({ row: i + 1, email, error: `Parent auth: ${authErr?.message || 'unknown'}` })
            continue
          }
          parentId = authResult.user.id

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

      // ─── Find-or-create player (Migration Safety Phase 1.1) ───
      // Match on org+parent+first_name+last_name (case-insensitive). When BOTH
      // the existing player and the CSV row carry a DOB and those DOBs differ,
      // emit a warning and SKIP all writes for this row — could be a same-name
      // sibling, a corrected DOB on the existing record, or a typo in either
      // source. Admin reviews each warning manually rather than silently
      // merging two distinct children into one record.
      const { data: existingPlayer } = await admin
        .from('players')
        .select('id, date_of_birth')
        .eq('organisation_id', orgId)
        .eq('parent_id', parentId)
        .ilike('first_name', r.first_name)
        .ilike('last_name', r.last_name || '')
        .maybeSingle()

      let playerId: string | undefined = (existingPlayer as { id?: string } | null)?.id

      if (existingPlayer && playerId) {
        const existingDOB = (existingPlayer as { date_of_birth?: string | null }).date_of_birth ?? null
        const csvDOB = r.date_of_birth ? r.date_of_birth.trim() : ''
        // Compare only when BOTH sides carry a DOB. Either-side-missing falls
        // back to status-quo name match (no signal to validate against).
        if (existingDOB && csvDOB && normalizeDOB(existingDOB) !== normalizeDOB(csvDOB)) {
          summary.warnings.push({
            row: i + 1,
            email,
            childName: `${r.first_name} ${r.last_name || ''}`.trim(),
            existingPlayerId: playerId,
            existingDOB,
            csvDOB,
            reason: `A player named "${r.first_name} ${r.last_name || ''}".trim() already exists under this parent with a different DOB (existing: ${existingDOB}, CSV: ${csvDOB}). Review manually.`,
          })
          // Skip player creation AND downstream enrolment/subscription writes
          // for this row — we can't safely tell which child the CSV row refers
          // to. Admin handles it via Migrate Member (single-family flow) once
          // they've verified the correct DOB.
          continue
        }
      }

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
          summary.errors.push({ row: i + 1, email, error: `Player: ${playerErr?.message || 'unknown'}` })
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
          .select('id, status, invite_token')
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
            summary.errors.push({ row: i + 1, email, error: `Subscription: ${subErr.message}` })
          } else {
            const planInfo = planById.get(mapping.planId)
            summary.invitations.push({
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
      summary.errors.push({ row: i + 1, email: (r.parent_email || '').trim().toLowerCase() || undefined, error: message })
    }
  }

  // NOTE: Email sending is NOT triggered here any more. The previous
  // fire-and-forget pattern made conflicts invisible to the parent (they'd
  // already receive an email mentioning the wrong academy). Migration Safety
  // Phase 1 returns invitations[] in the summary; the wizard sends them in a
  // separate, explicitly-staged step after the admin has reviewed conflicts.
  return NextResponse.json({ ok: true, summary })
}

// Normalise a DOB string for comparison. Accepts ISO (YYYY-MM-DD) and a few
// common UK formats (DD/MM/YYYY, DD-MM-YYYY). Returns YYYY-MM-DD or '' if it
// can't parse — '' compares unequal to any normalised date, which keeps the
// safer "treat as mismatch" behaviour for unparseable inputs.
function normalizeDOB(input: string): string {
  if (!input) return ''
  const trimmed = input.trim()
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  // DD/MM/YYYY or DD-MM-YYYY
  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return ''
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
