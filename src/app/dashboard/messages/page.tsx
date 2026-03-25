import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import SendMessageForm from './SendMessageForm'
import ParentReplyForm from './ParentReplyForm'
import BulkMessageForm from './BulkMessageForm'
import MessageThread from './MessageThread'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const isStaff = role === 'admin' || role === 'coach'
  const orgId = profile?.organisation_id || ''

  // Get messages where I'm the recipient
  const { data: inbox } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name)')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get messages I've sent
  const { data: sent } = await supabase
    .from('messages')
    .select('*, recipient:profiles!messages_recipient_id_fkey(full_name)')
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Mark unread as read
  const unreadIds = (inbox || []).filter((m) => !m.read).map((m) => m.id)
  if (unreadIds.length > 0) {
    await supabase
      .from('messages')
      .update({ read: true })
      .in('id', unreadIds)
  }

  // Get recipients for the send form
  const { data: parents } = isStaff
    ? await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'parent')
        .order('full_name')
    : { data: [] as { id: string; full_name: string }[] }

  // For parents, get staff they can message
  const { data: staffMembers } = !isStaff
    ? await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['coach', 'admin'])
        .order('full_name')
    : { data: [] as { id: string; full_name: string; role: string }[] }

  // Groups for bulk messaging
  const { data: groups } = isStaff
    ? await supabase
        .from('training_groups')
        .select('id, name')
        .order('name')
    : { data: [] as { id: string; name: string }[] }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        {unreadIds.length > 0 && (
          <span className="text-sm text-text-light">
            {unreadIds.length} message{unreadIds.length !== 1 ? 's' : ''} marked as read
          </span>
        )}
      </div>

      {/* Staff message tools */}
      {isStaff && (
        <div className="flex flex-wrap gap-2">
          <SendMessageForm parents={parents || []} autoOpen={params.add === '1'} orgId={orgId} />
          <BulkMessageForm parents={parents || []} groups={groups || []} orgId={orgId} />
        </div>
      )}

      {/* Parent reply form */}
      {!isStaff && <ParentReplyForm staffMembers={staffMembers || []} orgId={orgId} />}

      <Card title={`Inbox (${(inbox || []).length})`}>
        {(inbox || []).length === 0 ? (
          <EmptyState message="No messages yet." />
        ) : (
          <div className="divide-y divide-border">
            {(inbox || []).map((m) => (
              <MessageThread
                key={m.id}
                message={{
                  ...m,
                  sender: m.sender as unknown as { full_name: string } | null,
                }}
                currentUserId={user.id}
                isStaff={isStaff}
                orgId={orgId}
              />
            ))}
          </div>
        )}
      </Card>

      {(sent || []).length > 0 && (
        <Card title={`Sent (${(sent || []).length})`}>
          <div className="divide-y divide-border">
            {(sent || []).map((m) => (
              <MessageThread
                key={m.id}
                message={{
                  ...m,
                  recipient: m.recipient as unknown as { full_name: string } | null,
                }}
                currentUserId={user.id}
                isStaff={isStaff}
                orgId={orgId}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
