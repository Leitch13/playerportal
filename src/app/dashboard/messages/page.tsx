import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import MessagesApp from './MessagesApp'

export default async function MessagesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id, full_name')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const orgId = profile?.organisation_id || ''

  // Fetch all messages where user is sender or recipient
  const { data: allMessages } = await supabase
    .from('messages')
    .select(
      '*, sender:profiles!messages_sender_id_fkey(id, full_name, role), recipient:profiles!messages_recipient_id_fkey(id, full_name, role)'
    )
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: true })

  // Group messages by thread_id
  type RawMessage = NonNullable<typeof allMessages>[number]
  const threadMap = new Map<
    string,
    {
      threadId: string
      messages: RawMessage[]
      otherUser: { id: string; full_name: string; role: string }
      lastMessage: RawMessage
      unreadCount: number
      subject: string | null
    }
  >()

  for (const msg of allMessages || []) {
    const threadId = msg.thread_id || msg.id
    const existing = threadMap.get(threadId)
    const sender = msg.sender as unknown as { id: string; full_name: string; role: string } | null
    const recipient = msg.recipient as unknown as { id: string; full_name: string; role: string } | null
    const otherUser =
      msg.sender_id === user.id
        ? recipient || { id: msg.recipient_id, full_name: 'Unknown', role: 'parent' }
        : sender || { id: msg.sender_id, full_name: 'Unknown', role: 'parent' }

    if (existing) {
      existing.messages!.push(msg)
      existing.lastMessage = msg
      if (msg.recipient_id === user.id && !msg.read) {
        existing.unreadCount++
      }
      if (!existing.subject && msg.subject) {
        existing.subject = msg.subject
      }
    } else {
      threadMap.set(threadId, {
        threadId,
        messages: [msg],
        otherUser,
        lastMessage: msg,
        unreadCount: msg.recipient_id === user.id && !msg.read ? 1 : 0,
        subject: msg.subject || null,
      })
    }
  }

  // Convert to array sorted by last message time (newest first)
  const threads = Array.from(threadMap.values()).sort(
    (a, b) =>
      new Date(b.lastMessage.created_at).getTime() -
      new Date(a.lastMessage.created_at).getTime()
  )

  // Fetch potential recipients based on role
  let recipients: { id: string; full_name: string; role: string }[] = []

  if (role === 'parent') {
    // Parents see coaches and admins in their org
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .in('role', ['coach', 'admin'])
      .order('full_name')
    recipients = data || []
  } else if (role === 'coach') {
    // Coaches see parents + other coaches in their org
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .in('role', ['parent', 'coach', 'admin'])
      .neq('id', user.id)
      .order('full_name')
    recipients = data || []
  } else {
    // Admins see everyone in their org
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .neq('id', user.id)
      .order('full_name')
    recipients = data || []
  }

  return (
    <MessagesApp
      currentUserId={user.id}
      currentUserName={profile?.full_name || 'You'}
      role={role}
      orgId={orgId}
      initialThreads={threads.map((t) => ({
        threadId: t.threadId,
        otherUser: t.otherUser,
        lastMessage: {
          body: t.lastMessage.body,
          created_at: t.lastMessage.created_at,
          sender_id: t.lastMessage.sender_id,
        },
        unreadCount: t.unreadCount,
        subject: t.subject,
        messages: (t.messages || []).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          sender_id: m.sender_id as string,
          recipient_id: m.recipient_id as string,
          body: m.body as string,
          subject: m.subject as string | null,
          read: m.read as boolean,
          created_at: m.created_at as string,
          thread_id: (m.thread_id as string) || (m.id as string),
          sender: m.sender as { id: string; full_name: string; role: string } | null,
          recipient: m.recipient as { id: string; full_name: string; role: string } | null,
        })),
      }))}
      recipients={recipients}
    />
  )
}
