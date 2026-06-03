/**
 * Thread view — opened when an academy owner / parent clicks a row on
 * /dashboard/messages.
 *
 * • Server-rendered: pulls all messages for the thread (org-scoped)
 *   straight from the legacy `messages` table (the active surface).
 * • Auth: the viewer MUST be either the sender or recipient on at least
 *   one message in the thread (defence-in-depth, on top of RLS).
 * • Marks unread → read for messages where the current user is recipient.
 * • Renders ThreadView (presentation) + ThreadReplyForm (composer →
 *   /api/messages/send with the existing threadId).
 *
 * No coupling to the older MessagingHub / conversations-table system.
 */
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireFeature } from '@/lib/features'
import ThreadView from '../ThreadView'
import ThreadReplyForm from '../ThreadReplyForm'

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>
}) {
  const { threadId } = await params
  if (!threadId) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('messaging')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organisation_id || ''
  if (!orgId) notFound()

  // ── Pull the thread's messages (org-scoped) ──
  // Try the post-074 SELECT first; fall back to legacy on 42703.
  const fullSelect = 'id, thread_id, sender_id, recipient_id, subject, body, read, created_at, channel, delivery_status, delivery_failure_reason'
  const legacySelect = 'id, thread_id, sender_id, recipient_id, subject, body, read, created_at'

  let msgs: Array<Record<string, unknown>> = []
  const first = await supabase
    .from('messages')
    .select(fullSelect)
    .eq('organisation_id', orgId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (first.error && first.error.code === '42703') {
    const fallback = await supabase
      .from('messages')
      .select(legacySelect)
      .eq('organisation_id', orgId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    msgs = (fallback.data || []) as Array<Record<string, unknown>>
  } else if (!first.error) {
    msgs = (first.data || []) as Array<Record<string, unknown>>
  }

  if (msgs.length === 0) notFound()

  // ── Auth: viewer must be a participant in at least one message ──
  const viewerIsParticipant = msgs.some(m =>
    m.sender_id === user.id || m.recipient_id === user.id,
  )
  if (!viewerIsParticipant) notFound()

  // ── Resolve participant profiles ──
  const userIds = new Set<string>()
  for (const m of msgs) {
    userIds.add(m.sender_id as string)
    userIds.add(m.recipient_id as string)
  }
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, full_name, role, email')
    .in('id', [...userIds])
  const profMap = new Map<string, { id: string; full_name: string | null; role: string | null; email: string | null }>()
  for (const p of profs || []) {
    profMap.set(p.id as string, {
      id: p.id as string,
      full_name: (p as { full_name?: string | null }).full_name ?? null,
      role: (p as { role?: string | null }).role ?? null,
      email: (p as { email?: string | null }).email ?? null,
    })
  }

  // ── Determine "the other party" for the composer's recipient ──
  // Two-party thread is the dominant pattern. If somehow more than 2 users
  // appear in the thread (e.g. cohort broadcast hitting the same thread_id)
  // we pick the first non-self participant as a sensible default.
  const otherIds = [...userIds].filter(id => id !== user.id)
  const otherProfile = otherIds.length > 0 ? profMap.get(otherIds[0]) : null

  // ── Side-effect: mark unread → read for messages we received ──
  // Best-effort. Run via service-role so RLS doesn't get in the way of
  // the read-receipt UX. Cross-tenant impossible — we already verified org.
  try {
    const unreadIds = msgs
      .filter(m => m.recipient_id === user.id && !m.read)
      .map(m => m.id as string)
    if (unreadIds.length > 0) {
      const service = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      await service.from('messages').update({ read: true }).in('id', unreadIds)
    }
  } catch {/* read-receipt is best-effort */}

  const subject = (msgs.find(m => typeof m.subject === 'string' && (m.subject as string).trim().length > 0)?.subject as string | undefined) ?? null

  return (
    <div className="space-y-6 p-6 lg:p-8 max-w-3xl mx-auto">
      <div>
        <Link href="/dashboard/messages" className="text-xs text-white/50 hover:text-white/80 inline-flex items-center gap-1">
          <span aria-hidden>←</span>
          <span>Back to all messages</span>
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {subject || 'Conversation'}
            </h1>
            {otherProfile && (
              <p className="text-[11px] text-white/50 mt-1">
                with <span className="text-white/80 font-medium">{otherProfile.full_name || 'Unknown'}</span>
                {otherProfile.role && <span className="text-white/40"> · {otherProfile.role}</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      <ThreadView
        currentUserId={user.id}
        messages={msgs as unknown as Parameters<typeof ThreadView>[0]['messages']}
        profileMap={profMap}
      />

      {otherProfile ? (
        <ThreadReplyForm
          threadId={threadId}
          recipientId={otherProfile.id}
          recipientName={otherProfile.full_name || 'Unknown'}
          subject={subject}
        />
      ) : (
        <p className="text-xs text-white/50 italic">
          The other participant in this thread could not be resolved, so replies are disabled.
        </p>
      )}
    </div>
  )
}
