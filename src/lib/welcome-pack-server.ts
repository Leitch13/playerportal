/**
 * Reading welcome packs from the database. The rules live in ./welcome-pack.ts.
 * Takes a service-role client: every caller has already decided who is asking.
 */
import { PACK_DOC_TYPE, PACK_OPENED_ACTION, PACK_EMAILED_ACTION, PACK_EMAILED_TO_ACTION, groupPacks, packsForFamily, packEmailRecipients, type Pack, type PackRow } from './welcome-pack'
import { sendEmailBatch } from './email'
import { welcomePackEmail } from './email-templates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any
const ROW = 'id, organisation_id, title, description, url, folder, created_at'

/** The packs a parent should see (from their children's class places), and which they have opened. */
export async function loadFamilyPacks(service: Supabase, parentId: string): Promise<{ packs: Pack[]; opened: Set<string> }> {
  const { data: kids } = await service.from('players').select('id').eq('parent_id', parentId).is('archived_at', null)
  const kidIds = ((kids || []) as { id: string }[]).map((k) => k.id)
  if (kidIds.length === 0) return { packs: [], opened: new Set() }
  const { data: places } = await service.from('enrolments').select('organisation_id, group_id').in('player_id', kidIds).eq('status', 'active')
  const mine = ((places || []) as { organisation_id: string; group_id: string }[]).map((p) => ({ orgId: p.organisation_id, classId: p.group_id }))
  const orgIds = [...new Set(mine.map((m) => m.orgId))]
  if (orgIds.length === 0) return { packs: [], opened: new Set() }
  const { data: rows } = await service.from('documents').select(ROW).eq('doc_type', PACK_DOC_TYPE).in('organisation_id', orgIds)
  const packs = packsForFamily(groupPacks((rows || []) as PackRow[]), mine)
  if (packs.length === 0) return { packs, opened: new Set() }
  const { data: opens } = await service.from('audit_log').select('entity_id').eq('action', PACK_OPENED_ACTION).eq('user_id', parentId).in('entity_id', packs.map((p) => p.packId))
  return { packs, opened: new Set(((opens || []) as { entity_id: string }[]).map((o) => o.entity_id)) }
}

/** For the welcome email: the address of the parent's packs page, or nothing if they have no pack. Never throws. */
export async function welcomePackLink(service: Supabase, parentId: string | null | undefined, appUrl: string): Promise<string | undefined> {
  if (!parentId) return undefined
  try {
    const { packs } = await loadFamilyPacks(service, parentId)
    if (packs.length === 0) return undefined
    // The welcome email is about to carry the button, so the morning job must not email these packs again.
    await service.from('audit_log').insert(packs.map((p) => ({ organisation_id: p.orgId, user_id: parentId, action: PACK_EMAILED_TO_ACTION, entity_type: 'welcome_pack', entity_id: p.packId, details: { via: 'welcome_email' } })))
    return `${appUrl}/dashboard/welcome-packs`
  } catch { return undefined }
}

/** An academy's packs. */
export async function loadAcademyPacks(service: Supabase, orgId: string): Promise<Pack[]> {
  const { data: rows } = await service.from('documents').select(ROW).eq('doc_type', PACK_DOC_TYPE).eq('organisation_id', orgId)
  return groupPacks((rows || []) as PackRow[])
}

export type PackSendMode = 'on_save' | 'new_joiners' | 'button'

/**
 * Email one pack. See packEmailRecipients() for who gets it.
 *   on_save      everyone in the pack's classes the system has not already emailed
 *   new_joiners  the same, but only families whose class place began after the pack was added
 *   button       everyone who has not opened it, whether or not they were emailed before
 * `dryRun` sends nothing and returns the count. Never throws.
 */
export async function emailPack(service: Supabase, pack: Pack, opts: { mode: PackSendMode; actorId?: string | null; dryRun?: boolean; limit?: number }): Promise<{ asked: number; sent: number; notSent: number; parents: number }> {
  const none = { asked: 0, sent: 0, notSent: 0, parents: 0 }
  try {
    let q = service.from('enrolments').select('group_id, enrolled_at, player:players(parent_id, archived_at)').eq('organisation_id', pack.orgId).eq('status', 'active')
    if (!pack.everyClass) q = q.in('group_id', pack.classIds)
    const { data: seatRows } = await q
    let seats = ((seatRows || []) as { enrolled_at: string | null; player: { parent_id: string | null; archived_at: string | null } | null }[]).filter((s) => s.player?.parent_id && !s.player.archived_at)
    if (opts.mode === 'new_joiners') seats = seats.filter((s) => !!s.enrolled_at && !!pack.createdAt && s.enrolled_at >= pack.createdAt)
    const parentIds = [...new Set(seats.map((s) => s.player!.parent_id as string))]
    if (parentIds.length === 0) return none
    const [{ data: parents }, { data: marks }, { data: org }] = await Promise.all([
      service.from('profiles').select('id, full_name, email').in('id', parentIds),
      service.from('audit_log').select('user_id, action').in('action', [PACK_OPENED_ACTION, PACK_EMAILED_TO_ACTION]).eq('organisation_id', pack.orgId).eq('entity_id', pack.packId),
      service.from('organisations').select('name, contact_email').eq('id', pack.orgId).single(),
    ])
    const rows = (marks || []) as { user_id: string; action: string }[]
    const opened = rows.filter((r) => r.action === PACK_OPENED_ACTION).map((r) => r.user_id)
    const emailed = opts.mode === 'button' ? [] : rows.filter((r) => r.action === PACK_EMAILED_TO_ACTION).map((r) => r.user_id)
    const to = packEmailRecipients((parents || []) as { id: string; full_name: string | null; email: string | null }[], opened, emailed).slice(0, opts.limit ?? 500)
    if (opts.dryRun || to.length === 0) return { asked: to.length, sent: 0, notSent: 0, parents: parentIds.length }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net'
    const academyName = (org?.name as string) || 'Your academy'
    const result = await sendEmailBatch(to.map((p) => ({ to: p.email as string, ...welcomePackEmail({ parentName: p.full_name, academyName, title: pack.title, message: pack.message, packUrl: `${appUrl}/dashboard/welcome-packs` }), fromName: academyName, replyTo: (org?.contact_email as string | null) || undefined })))
    if (result.sent > 0) {
      await service.from('audit_log').insert(to.map((p) => ({ organisation_id: pack.orgId, user_id: p.id, action: PACK_EMAILED_TO_ACTION, entity_type: 'welcome_pack', entity_id: pack.packId, details: { via: opts.mode } })))
    }
    await service.from('audit_log').insert({ organisation_id: pack.orgId, user_id: opts.actorId ?? null, action: PACK_EMAILED_ACTION, entity_type: 'welcome_pack', entity_id: pack.packId, details: { title: pack.title, mode: opts.mode, asked: to.length, sent: result.sent, failed: result.failed, skipped: result.skipped } })
    return { asked: to.length, sent: result.sent, notSent: result.failed + result.skipped, parents: parentIds.length }
  } catch (err) {
    console.error('[welcome_pack_email_failed]', { pack: pack.packId, mode: opts.mode, error: err instanceof Error ? err.message : String(err) })
    return none
  }
}

/** Every pack on the platform, for the morning job. */
export async function loadAllPacks(service: Supabase): Promise<Pack[]> {
  const { data: rows } = await service.from('documents').select(ROW).eq('doc_type', PACK_DOC_TYPE)
  return groupPacks((rows || []) as PackRow[])
}
