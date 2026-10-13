import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PACK_BUCKET, PACK_DOC_TYPE, packFolder, packPath, packIdOfPath, pathBelongsTo, packProblem, groupPacks, type PackRow } from '@/lib/welcome-pack'
import { emailPack } from '@/lib/welcome-pack-server'

/**
 * Academy admin: add or remove a welcome pack. See src/lib/welcome-pack.ts.
 *
 * Adding is two calls, because a pack PDF is too big to pass through the app:
 *   { action: 'upload-url' }  → a one-off link the browser sends the file to
 *   { action: 'save', … }     → records the pack against its classes
 * Every path is checked to sit inside the caller's own academy.
 */
async function admin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 }) }
  const { data: me } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (!me || me.role !== 'admin' || !me.organisation_id) return { error: NextResponse.json({ ok: false, error: 'Only an academy admin can change welcome packs.' }, { status: 403 }) }
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  return { user, orgId: me.organisation_id as string, service }
}

export async function POST(req: NextRequest) {
  const a = await admin(); if (a.error) return a.error
  const { user, orgId, service } = a
  const body = await req.json().catch(() => ({})) as { action?: string; title?: string; message?: string; path?: string; everyClass?: boolean; classIds?: string[]; packId?: string; dryRun?: boolean; emailNow?: boolean }

  if (body.action === 'upload-url') {
    const path = packPath(orgId, randomUUID())
    const { data, error } = await service.storage.from(PACK_BUCKET).createSignedUploadUrl(path)
    if (error || !data) return NextResponse.json({ ok: false, error: 'Could not start the upload. Please try again.' }, { status: 500 })
    return NextResponse.json({ ok: true, path, token: data.token })
  }

  if (body.action === 'save') {
    const classIds = [...new Set((body.classIds || []).filter((c) => typeof c === 'string'))]
    const problem = packProblem({ title: body.title, everyClass: !!body.everyClass, classIds })
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
    const path = body.path || ''
    if (!pathBelongsTo(path, orgId)) return NextResponse.json({ ok: false, error: 'That file could not be found. Please upload it again.' }, { status: 400 })
    const { data: files } = await service.storage.from(PACK_BUCKET).list(orgId, { search: `${packIdOfPath(path)}.pdf` })
    if (!files || files.length === 0) return NextResponse.json({ ok: false, error: 'The file did not finish uploading. Please try again.' }, { status: 400 })
    // Only this academy's own classes.
    let own: string[] = []
    if (!body.everyClass) {
      const { data: groups } = await service.from('training_groups').select('id').eq('organisation_id', orgId).in('id', classIds)
      own = (groups || []).map((g) => g.id as string)
      if (own.length === 0) return NextResponse.json({ ok: false, error: 'Choose which classes this pack is for, or tick "Every class".' }, { status: 400 })
    }
    const base = { organisation_id: orgId, title: (body.title || '').trim().slice(0, 120), description: (body.message || '').trim().slice(0, 600) || null, url: path, doc_type: PACK_DOC_TYPE, uploaded_by: user.id }
    const rows = body.everyClass ? [{ ...base, folder: packFolder(null) }] : own.map((c) => ({ ...base, folder: packFolder(c) }))
    const { error } = await service.from('documents').insert(rows)
    if (error) return NextResponse.json({ ok: false, error: 'The pack could not be saved. Please try again.' }, { status: 500 })
    await service.from('audit_log').insert({ organisation_id: orgId, user_id: user.id, action: 'welcome_pack.added', entity_type: 'welcome_pack', entity_id: packIdOfPath(path), details: { title: base.title, every_class: !!body.everyClass, classes: own.length } })
    // Sent automatically to the families already in those classes, unless the academy unticked the box.
    let emailed = 0
    if (body.emailNow !== false) {
      const { data: saved } = await service.from('documents').select('id, organisation_id, title, description, url, folder, created_at').eq('organisation_id', orgId).eq('doc_type', PACK_DOC_TYPE).eq('url', path)
      const pack = groupPacks((saved || []) as PackRow[])[0]
      if (pack) emailed = (await emailPack(service, pack, { mode: 'on_save', actorId: user.id })).sent
    }
    return NextResponse.json({ ok: true, emailed })
  }
  // "Email again": every parent in the pack's classes who has not opened it yet, whether or not
  // they were emailed before. dryRun returns the count.
  if (body.action === 'email') {
    const path = packPath(orgId, body.packId || '')
    if (!pathBelongsTo(path, orgId)) return NextResponse.json({ ok: false, error: 'That pack could not be found.' }, { status: 404 })
    const { data: rows } = await service.from('documents').select('id, organisation_id, title, description, url, folder, created_at').eq('organisation_id', orgId).eq('doc_type', PACK_DOC_TYPE).eq('url', path)
    const pack = groupPacks((rows || []) as PackRow[])[0]
    if (!pack) return NextResponse.json({ ok: false, error: 'That pack could not be found.' }, { status: 404 })
    const r = await emailPack(service, pack, { mode: 'button', actorId: user.id, dryRun: !!body.dryRun })
    if (body.dryRun) return NextResponse.json({ ok: true, wouldEmail: r.asked, parents: r.parents })
    if (r.asked === 0) return NextResponse.json({ ok: false, error: 'There is nobody to email: every parent in those classes has already opened it, or has no email address.' }, { status: 400 })
    if (r.sent === 0) return NextResponse.json({ ok: false, error: 'None of the emails could be sent. Please try again.' }, { status: 502 })
    return NextResponse.json({ ok: true, sent: r.sent, notSent: r.notSent })
  }
  return NextResponse.json({ ok: false, error: 'Unknown request.' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const a = await admin(); if (a.error) return a.error
  const { user, orgId, service } = a
  const packId = req.nextUrl.searchParams.get('pack') || ''
  const path = packPath(orgId, packId)
  if (!pathBelongsTo(path, orgId)) return NextResponse.json({ ok: false, error: 'That pack could not be found.' }, { status: 404 })
  const { data: gone, error } = await service.from('documents').delete().eq('organisation_id', orgId).eq('doc_type', PACK_DOC_TYPE).eq('url', path).select('id')
  if (error) return NextResponse.json({ ok: false, error: 'The pack could not be removed. Please try again.' }, { status: 500 })
  if (!gone || gone.length === 0) return NextResponse.json({ ok: false, error: 'That pack could not be found.' }, { status: 404 })
  await service.storage.from(PACK_BUCKET).remove([path])
  await service.from('audit_log').insert({ organisation_id: orgId, user_id: user.id, action: 'welcome_pack.removed', entity_type: 'welcome_pack', entity_id: packId, details: {} })
  return NextResponse.json({ ok: true })
}
