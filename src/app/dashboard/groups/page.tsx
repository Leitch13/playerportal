import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import GroupForm from './GroupForm'
import GroupCard from './GroupCard'
// Classes Revenue Intelligence Phase 1A — read-only Revenue & Capacity strip.
// Flag-gated; OFF ⇒ no extra reads, byte-identical page.
import {
  CLASSES_REVOPS_ENABLED,
  monthlyAmount,
  buildClassIntel,
  type ClassIntel,
  type ClassesRollup,
} from '@/lib/classes-revops'
import ClassesRevenueStrip from '@/components/classes/ClassesRevenueStrip'

// Mirrors the Waitlist page's column-duality handling (task #248/#249).
const WAITLIST_SCHEMA_FIX_ON = process.env.WAITLIST_SCHEMA_FIX_ENABLED === 'true'

export default async function GroupsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>
}) {
  const q = ((await searchParams)?.q || '').trim().toLowerCase()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organisation_id || ''
  const role = profile?.role || 'parent'
  const isAdmin = role === 'admin'

  // Get org slug for shareable class links
  const { data: org } = await supabase
    .from('organisations')
    .select('slug')
    .eq('id', orgId)
    .single()
  const orgSlug = org?.slug || ''

  const { data: groups } = await supabase
    .from('training_groups')
    .select('*, coach:profiles!training_groups_coach_id_fkey(full_name)')
    .eq('organisation_id', orgId)
    .order('name')

  const { data: coaches } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('organisation_id', orgId)
    .in('role', ['admin', 'coach'])
    .order('full_name')

  // Phase 1B — load active+upcoming terms so the class form can offer them
  // in its Term dropdown. Read-only; absent term column is fine (defaults []).
  const { data: termsForDropdown } = await supabase
    .from('terms')
    .select('id, name, start_date, end_date')
    .eq('organisation_id', orgId)
    .order('start_date', { ascending: true })

  // Get enrolment counts per group
  const groupIds = (groups || []).map((g) => g.id)
  const { data: enrolments } = groupIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active')
    : { data: [] as { group_id: string }[] }

  const countByGroup = new Map<string, number>()
  for (const e of enrolments || []) {
    countByGroup.set(e.group_id, (countByGroup.get(e.group_id) || 0) + 1)
  }

  // ?q= filters by name / venue / coach / age group — server-side so it
  // works without JS and survives refresh/share.
  const visibleGroups = q
    ? (groups || []).filter((g) => {
        const coach = (g.coach as unknown as { full_name?: string } | null)?.full_name || ''
        const hay = `${g.name || ''} ${g.location || ''} ${coach} ${(g as unknown as { age_group?: string | null }).age_group || ''}`.toLowerCase()
        return hay.includes(q)
      })
    : (groups || [])

  // Sort by day of week
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedGroups = [...visibleGroups].sort((a, b) => {
    const dayA = DAY_ORDER.indexOf(a.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  // Group by day
  const groupsByDay = new Map<string, typeof sortedGroups>()
  for (const g of sortedGroups) {
    const day = g.day_of_week || 'Unscheduled'
    const list = groupsByDay.get(day) || []
    list.push(g)
    groupsByDay.set(day, list)
  }

  // Stats
  const totalClasses = (groups || []).length
  const totalEnrolled = Array.from(countByGroup.values()).reduce((a, b) => a + b, 0)
  const totalCapacity = (groups || []).reduce((sum, g) => sum + ((g.max_capacity as number) || 20), 0)
  const fillRate = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0

  // ── Classes Revenue Intelligence Phase 1A — read-only Revenue & Capacity strip.
  // Built only when the flag is ON, from three flag-gated reads (canonical seat
  // counts via get_group_seat_counts, org subscription plans, waitlist counts).
  // Flag OFF ⇒ none of this runs, no extra queries, byte-identical page. ──
  let classRollup: ClassesRollup | null = null
  let classNeedsAttention: ClassIntel[] = []
  if (CLASSES_REVOPS_ENABLED && (groups || []).length > 0) {
    // Canonical occupancy (active+pending), read-only RPC.
    const { data: seatRows } = await supabase.rpc('get_group_seat_counts', { p_org_id: orgId })
    const seatByGroup = new Map<string, number>()
    for (const r of (seatRows || []) as Array<{ group_id: string; seat_count: number | string }>) {
      seatByGroup.set(r.group_id, Number(r.seat_count) || 0)
    }
    // Per-class monthly price: match subscription_plans by class_type, prefer the
    // 'month' plan, interval-normalised. Read-only.
    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('class_type, amount, interval')
      .eq('organisation_id', orgId)
    const monthlyByClassType = new Map<string, number>()
    for (const p of (plans || []) as Array<{ class_type: string | null; amount: number | string | null; interval: string | null }>) {
      if (!p.class_type) continue
      const m = monthlyAmount(p)
      if (m <= 0) continue
      const existing = monthlyByClassType.get(p.class_type)
      // 'month' interval is the headline price; otherwise keep the first seen.
      if (existing == null || (p.interval || '').toLowerCase() === 'month') monthlyByClassType.set(p.class_type, m)
    }
    // Waitlist demand per class (waiting + offered), read-only.
    const wlCol = WAITLIST_SCHEMA_FIX_ON ? 'group_id' : 'training_group_id'
    const { data: wl } = await supabase
      .from('waitlist')
      .select(`${wlCol}, status`)
      .eq('organisation_id', orgId)
      .in('status', ['waiting', 'offered'])
    const waitingByGroup = new Map<string, number>()
    for (const w of (wl || []) as Array<Record<string, unknown>>) {
      const gid = w[wlCol] as string | null
      if (gid) waitingByGroup.set(gid, (waitingByGroup.get(gid) || 0) + 1)
    }
    const intel = buildClassIntel(
      (groups || []) as Array<{ id: string; name: string; day_of_week?: string | null; time_slot?: string | null; max_capacity?: number | null; class_type?: string | null }>,
      seatByGroup,
      waitingByGroup,
      monthlyByClassType,
    )
    classRollup = intel.rollup
    classNeedsAttention = intel.needsAttention
  }

  return (
    <div className="bg-[#080e18] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      {/* Header — counts live here as one quiet line, not a band of stat tiles */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Classes</h1>
          <p className="mt-1 text-[13px] text-white/40">
            {totalClasses} class{totalClasses === 1 ? '' : 'es'} · {totalEnrolled} enrolled · {totalCapacity} capacity · {fillRate}% full
          </p>
        </div>
        <form method="GET" className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search classes, venues, coaches…"
            className="w-64 rounded-xl border border-[#1d2c42] bg-[#0f1a2b] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#4ecde6]/50 sm:w-72"
          />
        </form>
      </div>

      {CLASSES_REVOPS_ENABLED && classRollup && (
        <ClassesRevenueStrip rollup={classRollup} needsAttention={classNeedsAttention} />
      )}

      {/* Create new class (admin only) */}
      {isAdmin && <GroupForm coaches={coaches || []} orgId={orgId} terms={termsForDropdown || []} />}

      {/* Classes by day */}
      {(groups || []).length === 0 ? (
        <div className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-12 text-center">
          <svg className="mx-auto mb-4 h-10 w-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
          </svg>
          <h3 className="mb-1 text-lg font-bold text-white">No classes yet</h3>
          <p className="text-sm text-white/50">Create your first class to start enrolling players</p>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-10 text-center">
          <p className="text-sm text-white/60">Nothing matches <span className="font-semibold text-white">&ldquo;{q}&rdquo;</span></p>
          <a href="/dashboard/groups" className="mt-2 inline-block text-xs font-semibold text-[#4ecde6] hover:underline">Clear search</a>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groupsByDay.entries()).map(([day, dayGroups]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-white">{day}</h2>
                <div className="h-px flex-1 bg-white/[0.07]" />
                <span className="text-xs text-white/60 font-medium">{dayGroups.length} class{dayGroups.length !== 1 ? 'es' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dayGroups.map((g) => {
                  const enrolled = countByGroup.get(g.id) || 0
                  const capacity = (g.max_capacity as number) || 20
                  const coach = g.coach as unknown as { full_name: string } | null

                  return (
                    <GroupCard
                      key={g.id}
                      group={{
                        id: g.id,
                        name: g.name,
                        day_of_week: g.day_of_week,
                        time_slot: g.time_slot,
                        location: g.location,
                        coach_id: g.coach_id,
                        max_capacity: capacity,
                        age_group: (g as unknown as { age_group: string | null }).age_group,
                        description: (g as unknown as { description: string | null }).description,
                        price_per_session: (g as unknown as { price_per_session: number | null }).price_per_session,
                        end_time: null,
                        class_type: (g as unknown as { class_type: string | null }).class_type,
                        short_description: (g as unknown as { short_description: string | null }).short_description,
                        long_description: (g as unknown as { long_description: string | null }).long_description,
                        benefits: (g as unknown as { benefits: string[] | null }).benefits,
                        suitable_for: (g as unknown as { suitable_for: string | null }).suitable_for,
                        what_to_bring: (g as unknown as { what_to_bring: string | null }).what_to_bring,
                        image_url: (g as unknown as { image_url: string | null }).image_url,
                        is_featured: (g as unknown as { is_featured: boolean | null }).is_featured,
                        // Phase 1B — passed through so GroupForm's edit mode preselects the term.
                        term_id: (g as unknown as { term_id: string | null }).term_id ?? null,
                        // Migration 103 — publish state (absent/true => visible).
                        is_published: (g as unknown as { is_published: boolean | null }).is_published ?? true,
                      }}
                      coachName={coach?.full_name || null}
                      enrolled={enrolled}
                      isAdmin={isAdmin}
                      coaches={coaches || []}
                      orgId={orgId}
                      orgSlug={orgSlug}
                      terms={termsForDropdown || []}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
