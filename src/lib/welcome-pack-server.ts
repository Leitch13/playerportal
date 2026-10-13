/**
 * Reading welcome packs from the database. The rules live in ./welcome-pack.ts.
 * Takes a service-role client: every caller has already decided who is asking.
 */
import { PACK_DOC_TYPE, PACK_OPENED_ACTION, groupPacks, packsForFamily, type Pack, type PackRow } from './welcome-pack'

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
  try { return (await loadFamilyPacks(service, parentId)).packs.length > 0 ? `${appUrl}/dashboard/welcome-packs` : undefined } catch { return undefined }
}

/** An academy's packs. */
export async function loadAcademyPacks(service: Supabase, orgId: string): Promise<Pack[]> {
  const { data: rows } = await service.from('documents').select(ROW).eq('doc_type', PACK_DOC_TYPE).eq('organisation_id', orgId)
  return groupPacks((rows || []) as PackRow[])
}
