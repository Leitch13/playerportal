import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { loadAcademyPacks, loadFamilyPacks } from '@/lib/welcome-pack-server'
import { PACK_OPENED_ACTION, PACK_EMAILED_ACTION, packCoverage, packEmailRecipients } from '@/lib/welcome-pack'
import { classOptionLabel } from '@/lib/report-class-filter'
import WelcomePackManager from './WelcomePackManager'

/**
 * Welcome packs. See src/lib/welcome-pack.ts.
 * An academy admin adds packs and sees who has opened them. A parent sees the
 * packs for their children's classes. A coach can read the academy's packs.
 */
export default async function WelcomePacksPage({ searchParams }: { searchParams?: Promise<{ missing?: string }> }) {
  const sp = (await searchParams) || {}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  const role = (profile?.role as string) || 'parent'
  const orgId = (profile?.organisation_id as string) || ''
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })

  if (role === 'parent') {
    const { packs, opened } = await loadFamilyPacks(service, user.id)
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome pack</h1>
          <p className="mt-1 text-sm text-white/50">Everything your academy wants you to know before you start.</p>
        </div>
        {sp.missing && <p className="rounded-2xl border border-[#243652] bg-[#0f1a2b] px-4 py-3 text-sm text-white/70">That pack could not be opened just now. Please try again, or ask your academy.</p>}
        {packs.length === 0 ? (
          <div className="rounded-3xl border border-[#243652] bg-[#0f1a2b] p-8 text-center" data-testid="welcome-packs-none">
            <p className="text-sm text-white/60">There is no welcome pack for your classes yet.</p>
          </div>
        ) : (
          <ul className="space-y-3" data-testid="welcome-packs-parent">
            {packs.map((p) => (
              <li key={p.packId} className="relative overflow-hidden rounded-3xl border border-[#243652] bg-gradient-to-b from-[#132238] to-[#0d1726] p-5">
                <p className="text-[17px] font-bold leading-tight text-white">{p.title}</p>
                {p.message && <p className="mt-1.5 text-sm leading-relaxed text-white/65">{p.message}</p>}
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/55"><span className={`h-1.5 w-1.5 rounded-full ${opened.has(p.packId) ? 'bg-[#4ecde6]' : 'bg-white/25'}`} />{opened.has(p.packId) ? 'You have opened this' : 'Not opened yet'}</p>
                <a href={`/api/welcome-pack/${p.packId}`} target="_blank" rel="noopener noreferrer" className="mt-4 block w-full rounded-xl bg-[#4ecde6] px-4 py-3 text-center text-sm font-bold text-[#06121c] transition-opacity hover:opacity-90">Open the pack</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // Staff
  const packs = await loadAcademyPacks(service, orgId)
  const [{ data: classRows }, { data: places }] = await Promise.all([
    service.from('training_groups').select('id, name, day_of_week').eq('organisation_id', orgId).order('name'),
    service.from('enrolments').select('group_id, player:players(parent_id, archived_at)').eq('organisation_id', orgId).eq('status', 'active'),
  ])
  const classes = ((classRows || []) as { id: string; name: string; day_of_week: string | null }[]).map((c) => ({ id: c.id, label: classOptionLabel(c) }))
  const seats = ((places || []) as unknown as { group_id: string; player: { parent_id: string | null; archived_at: string | null } | null }[]).filter((s) => s.player?.parent_id && !s.player.archived_at)
  const { data: opens } = packs.length
    ? await service.from('audit_log').select('entity_id, user_id, created_at').eq('action', PACK_OPENED_ACTION).eq('organisation_id', orgId).in('entity_id', packs.map((p) => p.packId))
    : { data: [] }
  const parentIds = [...new Set(seats.map((s) => s.player!.parent_id as string))]
  const { data: parents } = parentIds.length ? await service.from('profiles').select('id, full_name, email').in('id', parentIds) : { data: [] }
  const { data: sends } = packs.length
    ? await service.from('audit_log').select('entity_id, created_at, details').eq('action', PACK_EMAILED_ACTION).eq('organisation_id', orgId).in('entity_id', packs.map((p) => p.packId)).order('created_at', { ascending: true })
    : { data: [] }
  const nameOf = new Map(((parents || []) as { id: string; full_name: string | null }[]).map((p) => [p.id, (p.full_name || '').trim() || 'A parent']))

  const view = packs.map((p) => {
    const entitled = seats.filter((s) => p.everyClass || p.classIds.includes(s.group_id)).map((s) => s.player!.parent_id as string)
    const openedBy = ((opens || []) as { entity_id: string; user_id: string }[]).filter((o) => o.entity_id === p.packId).map((o) => o.user_id)
    const cov = packCoverage(entitled, openedBy)
    const lastSend = ((sends || []) as { entity_id: string; created_at: string; details: { sent?: number } | null }[]).filter((x) => x.entity_id === p.packId).at(-1)
    return {
      packId: p.packId, title: p.title, message: p.message, added: p.createdAt ? shortDate(p.createdAt) : '',
      forWhom: p.everyClass ? 'Every class' : p.classIds.map((c) => classes.find((x) => x.id === c)?.label || 'A class that no longer exists').join(', '),
      canEmail: packEmailRecipients(((parents || []) as { id: string; email: string | null }[]).filter((x) => entitled.includes(x.id)), openedBy).length,
      lastEmailed: lastSend ? { on: shortDate(lastSend.created_at), sent: lastSend.details?.sent ?? 0 } : null,
      total: cov.total, opened: cov.opened, notOpened: cov.notOpened.map((id) => nameOf.get(id) || 'A parent').sort((a, b) => a.localeCompare(b)),
    }
  })

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome packs</h1>
        <p className="mt-1 text-sm text-white/50">Upload the PDF you give new families. Parents in the classes you choose are emailed it, and anyone who joins later gets it automatically.</p>
      </div>
      <WelcomePackManager packs={view} classes={classes} canEdit={role === 'admin'} />
    </div>
  )
}
