import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ContactsClient, { type Contact } from './ContactsClient'

// Contacts — a read-only "address book" that unions three existing sources:
//   • players (+ active enrolments)  → Members / Enrolled
//   • camp_bookings (paid)           → Camp
//   • trial_bookings                 → Trial
// deduped by (child name + parent email), precedence member > camp > trial.
// NOTHING is written here. A contact only becomes a real player via the
// Add-to-class promote action. Admin-only.

const norm = (s: string | null | undefined) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const keyOf = (name: string | null, email: string | null) => `${norm(name)}·${norm(email)}`

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')
  const orgId = profile.organisation_id as string

  // ── sources ──
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, parent_id, archived_at, parent:profiles!players_parent_id_fkey(full_name, email)')
    .eq('organisation_id', orgId)

  const activePlayerIds = new Set<string>()
  const pids = (players || []).filter(p => !p.archived_at).map(p => p.id)
  for (let i = 0; i < pids.length; i += 300) {
    const { data: en } = await supabase
      .from('enrolments').select('player_id').in('player_id', pids.slice(i, i + 300)).eq('status', 'active')
    ;(en || []).forEach(e => activePlayerIds.add(e.player_id as string))
  }

  // Camp bookings + their camp dates, so each camp contact carries which camp
  // and whether it's PAST (a re-engagement target) or UPCOMING (live logistics).
  const { data: campRows } = await supabase
    .from('camp_bookings')
    .select('child_name, parent_name, parent_email, camp_id')
    .eq('organisation_id', orgId).eq('payment_status', 'paid')
  const { data: campDefs } = await supabase
    .from('camps').select('id, name, start_date, end_date').eq('organisation_id', orgId)
  const campById = new Map((campDefs || []).map(c => [c.id as string, c]))
  const today = new Date().toISOString().slice(0, 10)
  const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  // Aggregate camp bookings per contact: keep the most recent camp + upcoming flag.
  type CampAgg = { name: string; parentName: string | null; parentEmail: string | null; latest: { name: string; start_date: string | null; end_date: string | null } | null; hasUpcoming: boolean }
  const campByKey = new Map<string, CampAgg>()
  for (const c of campRows || []) {
    if (!(c.child_name || '').trim()) continue
    const k = keyOf(c.child_name, c.parent_email)
    const camp = (campById.get(c.camp_id as string) as { name: string; start_date: string | null; end_date: string | null } | undefined) || null
    const g = campByKey.get(k) || { name: c.child_name.trim(), parentName: c.parent_name, parentEmail: c.parent_email, latest: null, hasUpcoming: false }
    if (camp) {
      const end = camp.end_date || camp.start_date
      if (end && end >= today) g.hasUpcoming = true
      const latestEnd = g.latest ? (g.latest.end_date || g.latest.start_date || '') : ''
      if (!g.latest || (end || '') > latestEnd) g.latest = camp
    }
    campByKey.set(k, g)
  }

  let trials: Array<{ child_name: string; parent_name: string | null; parent_email: string | null; created_at: string }> = []
  {
    const { data } = await supabase
      .from('trial_bookings').select('child_name, parent_name, parent_email, created_at').eq('organisation_id', orgId)
    trials = (data as typeof trials) || []
  }

  // ── union + dedup ──
  const byKey = new Map<string, Contact>()
  for (const p of players || []) {
    if (p.archived_at) continue
    const par = p.parent as unknown as { full_name: string | null; email: string | null } | null
    const name = `${p.first_name} ${p.last_name}`.trim()
    byKey.set(keyOf(name, par?.email || null), {
      name, parentName: par?.full_name || null, parentEmail: par?.email || null,
      source: 'member', enrolled: activePlayerIds.has(p.id), playerId: p.id,
    })
  }
  for (const [k, g] of campByKey) {
    if (byKey.has(k)) continue
    const end = g.latest ? (g.latest.end_date || g.latest.start_date) : null
    byKey.set(k, {
      name: g.name, parentName: g.parentName, parentEmail: g.parentEmail, source: 'camp', enrolled: false,
      campLabel: g.latest?.name || null, campDate: fmtDate(end), timing: g.hasUpcoming ? 'upcoming' : 'past',
    })
  }
  for (const t of trials) {
    const k = keyOf(t.child_name, t.parent_email)
    if (!(t.child_name || '').trim() || byKey.has(k)) continue
    byKey.set(k, { name: t.child_name.trim(), parentName: t.parent_name, parentEmail: t.parent_email, source: 'trial', enrolled: false })
  }

  const contacts = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  return <ContactsClient contacts={contacts} orgSlug="" />
}
