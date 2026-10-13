import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PACK_BUCKET, PACK_DOC_TYPE, PACK_OPENED_ACTION, groupPacks, packsForFamily, packPath, pathBelongsTo, type PackRow } from '@/lib/welcome-pack'

/**
 * Open a welcome pack. See src/lib/welcome-pack.ts.
 *
 * The file is private. This checks the person is entitled to it (staff of the
 * academy, or a parent with a child in one of the pack's classes), writes down
 * that a parent opened it, then hands over a link that works for one hour.
 * [id] is the pack id. Anything wrong sends them back to their packs page.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: packId } = await params
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin))
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return to('/auth/signin')
  if (!/^[0-9a-f-]{36}$/i.test(packId)) return to('/dashboard/welcome-packs')

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: rows } = await service.from('documents').select('id, organisation_id, title, description, url, folder, created_at').eq('doc_type', PACK_DOC_TYPE).like('url', `%/${packId}.pdf`)
  const pack = groupPacks((rows || []) as PackRow[])[0]
  if (!pack || !pathBelongsTo(pack.path, pack.orgId) || pack.path !== packPath(pack.orgId, packId)) return to('/dashboard/welcome-packs')

  const { data: me } = await service.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  const staff = !!me && ['admin', 'coach'].includes(me.role as string) && me.organisation_id === pack.orgId
  let entitled = staff
  if (!entitled) {
    const { data: kids } = await service.from('players').select('id').eq('parent_id', user.id).is('archived_at', null)
    const kidIds = (kids || []).map((k) => k.id as string)
    if (kidIds.length) {
      const { data: places } = await service.from('enrolments').select('organisation_id, group_id').in('player_id', kidIds).eq('status', 'active')
      entitled = packsForFamily([pack], (places || []).map((p) => ({ orgId: p.organisation_id as string, classId: p.group_id as string }))).length > 0
    }
  }
  if (!entitled) return to('/dashboard/welcome-packs')

  const { data: signed } = await service.storage.from(PACK_BUCKET).createSignedUrl(pack.path, 3600)
  if (!signed?.signedUrl) return to('/dashboard/welcome-packs?missing=1')
  if (!staff) {
    await service.from('audit_log').insert({ organisation_id: pack.orgId, user_id: user.id, action: PACK_OPENED_ACTION, entity_type: 'welcome_pack', entity_id: packId, details: { title: pack.title } })
  }
  return NextResponse.redirect(signed.signedUrl)
}
