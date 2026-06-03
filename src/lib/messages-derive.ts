/**
 * messages-derive — pure thread-grouping derive (no I/O).
 *
 * Mirrors the Phase 2.4–2.9 loader→derive→presentation pattern:
 * the page (/dashboard/messages) hands raw `messages` rows + profile
 * lookups to deriveThreads(), which returns the conversation list the
 * UI renders. No Supabase / fetch / DOM here — everything testable in
 * isolation, no live DB needed.
 *
 * Decisions encoded here:
 *   • A "thread" is grouped by thread_id; messages with thread_id=null
 *     stand alone (keyed by their own id).
 *   • The lastMessage is the newest by created_at. Rows MAY arrive
 *     unsorted — deriveThreads sorts internally.
 *   • unreadCount = messages in the thread where read=false AND
 *     recipient_id === currentUserId. The sender's own messages don't
 *     contribute to their unread count.
 *   • The thread's subject inherits from the first message (chronologically)
 *     that has one. Empty/null subjects don't overwrite real ones.
 *   • Output is sorted newest-first by lastMessage.created_at.
 *
 * Day 1 scope: the messaging system has TWO schemas in flight (the
 * legacy `messages` table — active — and the unused `conversations`
 * tables). This derive only knows about the legacy shape; the conversations
 * system is left for a future migration.
 */

export interface MessageRow {
  id: string
  thread_id: string | null
  sender_id: string
  recipient_id: string
  subject: string | null
  body: string
  read: boolean
  created_at: string  // ISO string, sortable lexically
  channel?: string | null
  delivery_status?: string | null
  delivery_failure_reason?: string | null
}

export interface ProfileLite {
  id: string
  full_name: string | null
  role: string | null
}

export interface Thread {
  threadId: string
  subject: string | null
  participants: ProfileLite[]
  lastMessage: MessageRow
  unreadCount: number
  totalMessages: number
}

export function deriveThreads(
  rows: MessageRow[],
  profileMap: Map<string, ProfileLite>,
  currentUserId: string,
): Thread[] {
  if (!Array.isArray(rows) || rows.length === 0) return []

  interface Agg {
    threadId: string
    subject: string | null
    participantIds: Set<string>
    messages: MessageRow[]
  }
  const byThread = new Map<string, Agg>()

  for (const m of rows) {
    if (!m || !m.id || !m.sender_id || !m.recipient_id) continue
    const tid = m.thread_id || m.id
    let agg = byThread.get(tid)
    if (!agg) {
      agg = { threadId: tid, subject: null, participantIds: new Set<string>(), messages: [] }
      byThread.set(tid, agg)
    }
    agg.participantIds.add(m.sender_id)
    agg.participantIds.add(m.recipient_id)
    agg.messages.push(m)
  }

  const threads: Thread[] = []
  for (const agg of byThread.values()) {
    // Sort messages oldest-first so we can take subject from the first
    // message that has one (real-world: subject is usually set on the
    // opening message; replies leave it blank).
    agg.messages.sort((a, b) => a.created_at.localeCompare(b.created_at))
    for (const m of agg.messages) {
      if (m.subject && m.subject.trim().length > 0) {
        agg.subject = m.subject
        break
      }
    }
    const lastMessage = agg.messages[agg.messages.length - 1]
    const unreadCount = agg.messages.filter(
      m => !m.read && m.recipient_id === currentUserId,
    ).length
    const participants: ProfileLite[] = []
    for (const id of agg.participantIds) {
      const p = profileMap.get(id)
      if (p) participants.push(p)
      else participants.push({ id, full_name: null, role: null })  // skeleton for missing profile
    }
    threads.push({
      threadId: agg.threadId,
      subject: agg.subject,
      participants,
      lastMessage,
      unreadCount,
      totalMessages: agg.messages.length,
    })
  }

  threads.sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at))
  return threads
}
