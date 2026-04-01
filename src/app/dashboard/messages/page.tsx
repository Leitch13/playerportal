import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'
import MessagingHub from './MessagingHub'
import type { ConversationItem, Participant } from './MessagingHub'

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
  const fullName = profile?.full_name || 'You'

  // ---------- Fetch conversations the user is part of ----------
  const { data: convData } = await supabase
    .from('conversations')
    .select(
      `
      id, subject, updated_at,
      conversation_participants(user_id, last_read_at),
      conversation_messages(id, content, created_at, sender_id)
    `
    )
    .eq('organisation_id', orgId)
    .order('updated_at', { ascending: false })

  // Build profile map for all participants
  const allUserIds = new Set<string>()
  for (const c of convData || []) {
    for (const p of (c.conversation_participants as { user_id: string }[])) {
      allUserIds.add(p.user_id)
    }
  }

  let profileMap = new Map<string, { id: string; full_name: string; role: string }>()
  if (allUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', Array.from(allUserIds))
    for (const p of profiles || []) {
      profileMap.set(p.id, p)
    }
  }

  // Map conversations, only include ones the current user participates in
  const conversations: ConversationItem[] = (convData || [])
    .filter((c) =>
      (c.conversation_participants as { user_id: string }[]).some(
        (p) => p.user_id === user.id
      )
    )
    .map((c) => {
      const parts = c.conversation_participants as {
        user_id: string
        last_read_at: string
      }[]
      const myPart = parts.find((p) => p.user_id === user.id)
      const lastReadAt = myPart?.last_read_at || c.updated_at

      const msgs = (c.conversation_messages as {
        id: string
        content: string
        created_at: string
        sender_id: string
      }[]) || []
      const sorted = [...msgs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      const lastMsg = sorted[sorted.length - 1] || null

      const unreadCount = sorted.filter(
        (m) =>
          m.sender_id !== user.id &&
          new Date(m.created_at) > new Date(lastReadAt)
      ).length

      const participants: Participant[] = parts
        .map((p) => profileMap.get(p.user_id))
        .filter(Boolean) as Participant[]

      return {
        id: c.id as string,
        subject: c.subject as string | null,
        updated_at: c.updated_at as string,
        participants,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              created_at: lastMsg.created_at,
              sender_id: lastMsg.sender_id,
            }
          : null,
        unreadCount,
      }
    })

  // ---------- Fetch potential recipients based on role ----------
  let recipients: Participant[] = []

  if (role === 'parent') {
    // Parents see coaches and admins in their org
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .in('role', ['coach', 'admin'])
      .order('full_name')
    recipients = (data || []) as Participant[]
  } else if (role === 'coach') {
    // Coaches see parents + other coaches + admins in their org
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .in('role', ['parent', 'coach', 'admin'])
      .neq('id', user.id)
      .order('full_name')
    recipients = (data || []) as Participant[]
  } else {
    // Admins see everyone in their org
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organisation_id', orgId)
      .neq('id', user.id)
      .order('full_name')
    recipients = (data || []) as Participant[]
  }

  return (
    <MessagingHub
      currentUserId={user.id}
      currentUserName={fullName}
      role={role}
      orgId={orgId}
      initialConversations={conversations}
      recipients={recipients}
    />
  )
}
