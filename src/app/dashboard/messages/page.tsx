/**
 * /dashboard/messages — Day 1 rewrite.
 *
 * Before today, this page queried the unused `conversations` +
 * `conversation_messages` tables (0 production rows) which meant the
 * Messages page rendered EMPTY even when the academy owner had sent
 * messages — those messages went to the legacy `messages` table which
 * was the silent active surface.
 *
 * After today, the page reads the SAME `messages` table the rest of
 * the app writes to (NewMessage, BulkMessageForm, SendMessageForm,
 * ParentReplyForm — all now route through /api/messages/send). What
 * the academy sent is what the academy sees.
 *
 * Behaviour:
 *   • Threads grouped by `thread_id` (or the message id when null)
 *   • Sender + recipient profile resolved per thread
 *   • Unread counts use `read=false` for messages where current user is recipient
 *   • Empty state is accurate ("No messages yet")
 *   • BulkMessageForm continues to mount at the top when `?recipients=`
 *     is present (Phase 2.3b deep-link contract preserved)
 *
 * Out of scope today: the conversation system's threaded reply UX
 * (MessagingHub). MessagingHub.tsx is left in place for archaeology
 * but is no longer imported.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import type { UserRole } from '@/lib/types'
import BulkMessageForm from './BulkMessageForm'
import MessagesList from './MessagesList'
import ComposeButton from './ComposeButton'
import { deriveThreads, type MessageRow, type ProfileLite } from '@/lib/messages-derive'
import { validateRecipientsParam } from '@/lib/recipients-validate'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ recipients?: string; to?: string }>
}) {
  const params = (await searchParams) || {}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('messaging')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const orgId = profile?.organisation_id || ''

  // ── 1. Pull the user's messages (sent OR received) for this org. ──
  // The org-scoping defence-in-depth + the sender/recipient OR clause
  // together ensure cross-tenant data cannot leak even if RLS were
  // misconfigured.
  // Day 1: Select legacy columns + optional delivery columns. PostgREST
  // returns NULL for columns that don't exist yet (pre-migration-074),
  // so the page still renders cleanly during the rollout window.
  const { data: msgs, error: msgsError } = await supabase
    .from('messages')
    .select('id, thread_id, sender_id, recipient_id, subject, body, read, created_at, channel, delivery_status, delivery_failure_reason')
    .eq('organisation_id', orgId)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  // If delivery columns don't exist (migration not applied yet), the SELECT
  // above will fail with 42703. Fall back to legacy-only select.
  let rows: MessageRow[]
  if (msgsError && msgsError.code === '42703') {
    const fallback = await supabase
      .from('messages')
      .select('id, thread_id, sender_id, recipient_id, subject, body, read, created_at')
      .eq('organisation_id', orgId)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    rows = (fallback.data || []) as unknown as MessageRow[]
  } else {
    rows = (msgs || []) as unknown as MessageRow[]
  }

  // ── 2. Resolve every participant profile once. ──
  const userIds = new Set<string>()
  for (const m of rows) {
    userIds.add(m.sender_id)
    userIds.add(m.recipient_id)
  }
  let profileMap = new Map<string, ProfileLite>()
  if (userIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', [...userIds])
    for (const p of (profs || [])) {
      profileMap.set(p.id as string, { id: p.id as string, full_name: (p as { full_name?: string | null }).full_name ?? null, role: (p as { role?: string | null }).role ?? null })
    }
  }

  // ── 3. Group by thread_id (or message id when null). ──
  // Pure derive — testable in isolation, see scripts/_unit_tests_messages_derive.mjs
  const threads = deriveThreads(rows, profileMap, user.id)

  // ── 4. Build the recipient allow-list for the deep-link `?recipients=` cohort. ──
  let recipients: { id: string; full_name: string; role: string }[] = []
  if (role === 'parent') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .in('role', ['coach', 'admin'])
      .order('full_name')
    recipients = (data || []) as typeof recipients
  } else if (role === 'coach') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .in('role', ['parent', 'coach', 'admin'])
      .neq('id', user.id)
      .order('full_name')
    recipients = (data || []) as typeof recipients
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .neq('id', user.id)
      .order('full_name')
    recipients = (data || []) as typeof recipients
  }

  const validation = validateRecipientsParam(params.recipients, recipients)
  const showBulkPanel = validation.ids.length > 0

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-[11px] text-white/40 mt-1">
          Each message you send via Player Portal also reaches the parent by email.
        </p>
      </div>

      {showBulkPanel ? (
        <BulkMessageForm
          orgId={orgId}
          customRecipientIds={validation.ids}
          customRecipientLabels={validation.labels}
          autoOpen
        />
      ) : (
        <ComposeButton recipients={recipients} />
      )}

      <MessagesList currentUserId={user.id} threads={threads} />
    </div>
  )
}
