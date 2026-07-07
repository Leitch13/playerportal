'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Participant = {
  id: string
  full_name: string
  role: string
}

export type MessageItem = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export type ConversationItem = {
  id: string
  subject: string | null
  updated_at: string
  participants: Participant[]
  lastMessage: { content: string; created_at: string; sender_id: string } | null
  unreadCount: number
}

type Props = {
  currentUserId: string
  currentUserName: string
  role: UserRole
  orgId: string
  initialConversations: ConversationItem[]
  recipients: Participant[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDateSep(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    coach: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    parent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  }
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${colors[role] || colors.parent}`}
    >
      {role}
    </span>
  )
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + '...' : str
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconEmpty() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function MessagingHub({
  currentUserId,
  currentUserName,
  role,
  orgId,
  initialConversations,
  recipients,
}: Props) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [showNewModal, setShowNewModal] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeConv = conversations.find((c) => c.id === activeConvId) || null

  // Total unread for nav badge
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  /* ---------- Scroll to bottom ---------- */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  /* ---------- Load messages when conversation changes ---------- */
  useEffect(() => {
    if (!activeConvId) {
      setMessages([])
      return
    }
    let cancelled = false
    async function load() {
      setLoadingMessages(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true })
      if (!cancelled) {
        setMessages((data as MessageItem[]) || [])
        setLoadingMessages(false)
      }
      // Mark as read
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', activeConvId)
        .eq('user_id', currentUserId)

      // Update local unread
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, unreadCount: 0 } : c))
      )
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeConvId, currentUserId])

  /* ---------- Realtime subscription ---------- */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('conv-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
        },
        (payload) => {
          const newMsg = payload.new as MessageItem
          // Only handle messages for conversations we're in
          const isInConv = conversations.some((c) => c.id === newMsg.conversation_id)
          if (!isInConv) {
            // Could be a new conversation we were just added to; refetch
            refreshConversations()
            return
          }

          // If we're viewing this conversation, add message
          if (newMsg.conversation_id === activeConvId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            // Mark as read immediately
            if (newMsg.sender_id !== currentUserId) {
              supabase
                .from('conversation_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', newMsg.conversation_id)
                .eq('user_id', currentUserId)
            }
          }

          // Update conversation list
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === newMsg.conversation_id)
            if (idx < 0) return prev
            const updated = [...prev]
            const conv = { ...updated[idx] }
            conv.lastMessage = {
              content: newMsg.content,
              created_at: newMsg.created_at,
              sender_id: newMsg.sender_id,
            }
            conv.updated_at = newMsg.created_at
            // Increment unread only if not currently viewing and not from us
            if (newMsg.conversation_id !== activeConvId && newMsg.sender_id !== currentUserId) {
              conv.unreadCount = conv.unreadCount + 1
            }
            updated.splice(idx, 1)
            return [conv, ...updated]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, currentUserId, conversations.length])

  async function refreshConversations() {
    const supabase = createClient()
    const { data: convData } = await supabase
      .from('conversations')
      .select(`
        id, subject, updated_at,
        conversation_participants(user_id, last_read_at),
        conversation_messages(id, content, created_at, sender_id)
      `)
      .eq('organisation_id', orgId)
      .order('updated_at', { ascending: false })

    if (!convData) return

    // Fetch participant profiles
    const allUserIds = new Set<string>()
    for (const c of convData) {
      for (const p of (c.conversation_participants as { user_id: string }[])) {
        allUserIds.add(p.user_id)
      }
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', Array.from(allUserIds))
    const profileMap = new Map<string, Participant>()
    for (const p of profiles || []) {
      profileMap.set(p.id, p as Participant)
    }

    const mapped: ConversationItem[] = convData
      .filter((c) =>
        (c.conversation_participants as { user_id: string }[]).some(
          (p) => p.user_id === currentUserId
        )
      )
      .map((c) => {
        const parts = (c.conversation_participants as { user_id: string; last_read_at: string }[])
        const myPart = parts.find((p) => p.user_id === currentUserId)
        const lastReadAt = myPart?.last_read_at || c.updated_at

        const msgs = (c.conversation_messages as MessageItem[]) || []
        const sorted = [...msgs].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        const lastMsg = sorted[sorted.length - 1] || null

        const unread = sorted.filter(
          (m) => m.sender_id !== currentUserId && new Date(m.created_at) > new Date(lastReadAt)
        ).length

        const participants = parts
          .map((p) => profileMap.get(p.user_id))
          .filter(Boolean) as Participant[]

        return {
          id: c.id,
          subject: c.subject,
          updated_at: c.updated_at,
          participants,
          lastMessage: lastMsg
            ? { content: lastMsg.content, created_at: lastMsg.created_at, sender_id: lastMsg.sender_id }
            : null,
          unreadCount: unread,
        }
      })

    setConversations(mapped)
  }

  /* ---------- Send message ---------- */
  async function handleSend() {
    if (!messageInput.trim() || !activeConvId || sending) return
    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: activeConvId,
        sender_id: currentUserId,
        content: messageInput.trim(),
      })
      .select()
      .single()

    if (!error && data) {
      const msg = data as MessageItem
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === activeConvId)
        if (idx < 0) return prev
        const updated = [...prev]
        const conv = { ...updated[idx] }
        conv.lastMessage = { content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id }
        conv.updated_at = msg.created_at
        updated.splice(idx, 1)
        return [conv, ...updated]
      })
      setMessageInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessageInput(e.target.value)
    // Auto-resize
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  /* ---------- Open conversation ---------- */
  function selectConversation(convId: string) {
    setActiveConvId(convId)
    setMobileView('chat')
    setShowNewModal(false)
  }

  function goBackToList() {
    setActiveConvId(null)
    setMobileView('list')
  }

  /* ---------- Get other participants' display info ---------- */
  function getOtherParticipants(conv: ConversationItem): Participant[] {
    return conv.participants.filter((p) => p.id !== currentUserId)
  }

  function getConvDisplayName(conv: ConversationItem): string {
    const others = getOtherParticipants(conv)
    if (others.length === 0) return 'You'
    return others.map((p) => p.full_name).join(', ')
  }

  /* ---------- Filter conversations ---------- */
  const filteredConversations = conversations.filter((c) => {
    if (!searchFilter) return true
    const q = searchFilter.toLowerCase()
    const name = getConvDisplayName(c).toLowerCase()
    const subj = (c.subject || '').toLowerCase()
    const lastMsg = (c.lastMessage?.content || '').toLowerCase()
    return name.includes(q) || subj.includes(q) || lastMsg.includes(q)
  })

  /* ---------- Group messages by date ---------- */
  function groupMessagesByDate(msgs: MessageItem[]): { date: string; messages: MessageItem[] }[] {
    const groups: { date: string; messages: MessageItem[] }[] = []
    let currentDate = ''
    for (const msg of msgs) {
      const d = new Date(msg.created_at).toDateString()
      if (d !== currentDate) {
        currentDate = d
        groups.push({ date: msg.created_at, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    }
    return groups
  }

  /* ---------- Get sender name for a message ---------- */
  function getSenderName(senderId: string): string {
    if (senderId === currentUserId) return currentUserName
    if (activeConv) {
      const p = activeConv.participants.find((pp) => pp.id === senderId)
      if (p) return p.full_name
    }
    return 'Unknown'
  }

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-0 min-h-screen text-white" data-unread-count={totalUnread}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 lg:px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <h1 className="text-xl font-bold text-white">Messages</h1>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-lg text-sm font-bold hover:bg-[#3dbcd5] transition-colors"
            >
              <IconPlus />
              New Message
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
          {/* ------- Conversation List ------- */}
          <div
            className={`w-full lg:w-[380px] lg:min-w-[380px] border-r border-white/[0.06] flex-shrink-0 overflow-hidden flex flex-col ${
              mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Search */}
            <div className="p-3 border-b border-white/[0.06]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                  <IconSearch />
                </span>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 transition-colors"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="w-14 h-14 bg-white/[0.05] rounded-2xl flex items-center justify-center mb-3 border border-white/[0.08]">
                    <IconEmpty />
                  </div>
                  <p className="text-white/40 text-sm">
                    {searchFilter
                      ? 'No conversations match your search'
                      : role === 'parent'
                        ? 'Start a conversation with your coach'
                        : 'Message parents directly'}
                  </p>
                  {!searchFilter && (
                    <button
                      onClick={() => setShowNewModal(true)}
                      className="mt-3 text-[#4ecde6] text-sm font-medium hover:underline"
                    >
                      Start a new conversation
                    </button>
                  )}
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const others = getOtherParticipants(conv)
                  const displayName = getConvDisplayName(conv)
                  const isActive = conv.id === activeConvId
                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={`w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${
                        isActive ? 'bg-white/[0.06]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-[#4ecde6] text-sm font-semibold">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm font-medium truncate ${conv.unreadCount > 0 ? 'text-white' : 'text-white/80'}`}>
                                {displayName}
                              </span>
                              {others[0] && roleBadge(others[0].role)}
                            </div>
                            <span className="text-[11px] text-white/30 flex-shrink-0">
                              {conv.lastMessage ? timeAgo(conv.lastMessage.created_at) : ''}
                            </span>
                          </div>
                          {conv.subject && (
                            <p className="text-xs text-white/50 truncate mt-0.5">{conv.subject}</p>
                          )}
                          <div className="flex items-center justify-between mt-0.5">
                            <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-white/60' : 'text-white/30'}`}>
                              {conv.lastMessage
                                ? (conv.lastMessage.sender_id === currentUserId ? 'You: ' : '') +
                                  truncate(conv.lastMessage.content, 50)
                                : 'No messages yet'}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="flex-shrink-0 ml-2 min-w-[20px] h-5 px-1.5 bg-[#4ecde6] text-[#0a0a0a] rounded-full text-[11px] font-bold flex items-center justify-center">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* ------- Chat View ------- */}
          <div
            className={`flex-1 flex flex-col overflow-hidden ${
              mobileView === 'list' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {activeConv ? (
              <>
                {/* Chat header */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
                  <button
                    onClick={goBackToList}
                    className="lg:hidden text-white/60 hover:text-white transition-colors"
                  >
                    <IconBack />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-[#4ecde6] text-sm font-semibold">
                    {getConvDisplayName(activeConv).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {getConvDisplayName(activeConv)}
                      </span>
                      {getOtherParticipants(activeConv)[0] &&
                        roleBadge(getOtherParticipants(activeConv)[0].role)}
                    </div>
                    {activeConv.subject && (
                      <p className="text-xs text-white/40 truncate">{activeConv.subject}</p>
                    )}
                  </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 border-2 border-[#4ecde6]/30 border-t-[#4ecde6] rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-white/30 text-sm">Send the first message</p>
                    </div>
                  ) : (
                    groupMessagesByDate(messages).map((group) => (
                      <div key={group.date}>
                        {/* Date separator */}
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-white/[0.06]" />
                          <span className="text-[11px] text-white/25 font-medium">
                            {formatDateSep(group.date)}
                          </span>
                          <div className="flex-1 h-px bg-white/[0.06]" />
                        </div>
                        {group.messages.map((msg) => {
                          const isOwn = msg.sender_id === currentUserId
                          return (
                            <div
                              key={msg.id}
                              className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className="max-w-[75%] group">
                                {!isOwn && (
                                  <p className="text-[11px] text-white/30 mb-1 ml-1">
                                    {getSenderName(msg.sender_id)}
                                  </p>
                                )}
                                <div
                                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                                    isOwn
                                      ? 'bg-[#4ecde6]/10 border border-[#4ecde6]/20 text-white'
                                      : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/90'
                                  }`}
                                >
                                  {msg.content}
                                </div>
                                <p className="text-[10px] text-white/20 mt-0.5 px-1 hover-only">
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06]">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      value={messageInput}
                      onChange={handleTextareaChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-4 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 transition-colors resize-none"
                      style={{ maxHeight: 120 }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!messageInput.trim() || sending}
                      className="flex-shrink-0 w-10 h-10 bg-[#4ecde6] text-[#0a0a0a] rounded-lg flex items-center justify-center hover:bg-[#3dbcd5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
                      ) : (
                        <IconSend />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Empty state - no conversation selected */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/[0.08]">
                    <IconEmpty />
                  </div>
                  <p className="text-white/40 text-sm">Select a conversation to start messaging</p>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="mt-4 text-[#4ecde6] text-sm font-medium hover:underline"
                  >
                    Or start a new conversation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------- New Conversation Modal ------- */}
      {showNewModal && (
        <NewConversationModal
          currentUserId={currentUserId}
          orgId={orgId}
          recipients={recipients}
          onClose={() => setShowNewModal(false)}
          onCreated={(conv) => {
            setConversations((prev) => [conv, ...prev])
            selectConversation(conv.id)
            setShowNewModal(false)
          }}
        />
      )}
    </div>
  )
}

/* ================================================================ */
/*  New Conversation Modal                                          */
/* ================================================================ */

function NewConversationModal({
  currentUserId,
  orgId,
  recipients,
  onClose,
  onCreated,
}: {
  currentUserId: string
  orgId: string
  recipients: Participant[]
  onClose: () => void
  onCreated: (conv: ConversationItem) => void
}) {
  const [recipientSearch, setRecipientSearch] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState<Participant | null>(null)
  const [subject, setSubject] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [creating, setCreating] = useState(false)

  const filteredRecipients = recipients.filter(
    (r) =>
      r.full_name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.role.toLowerCase().includes(recipientSearch.toLowerCase())
  )

  async function handleCreate() {
    if (!selectedRecipient || !firstMessage.trim() || creating) return
    setCreating(true)

    const supabase = createClient()

    // 1. Create conversation
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        organisation_id: orgId,
        subject: subject.trim() || null,
      })
      .select()
      .single()

    if (convErr || !conv) {
      setCreating(false)
      return
    }

    // 2. Add participants
    await supabase.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: currentUserId },
      { conversation_id: conv.id, user_id: selectedRecipient.id },
    ])

    // 3. Send first message
    const { data: msg } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conv.id,
        sender_id: currentUserId,
        content: firstMessage.trim(),
      })
      .select()
      .single()

    setCreating(false)

    const newConv: ConversationItem = {
      id: conv.id,
      subject: conv.subject,
      updated_at: conv.updated_at,
      participants: [
        { id: currentUserId, full_name: 'You', role: '' },
        selectedRecipient,
      ],
      lastMessage: msg
        ? { content: msg.content, created_at: msg.created_at, sender_id: msg.sender_id }
        : { content: firstMessage.trim(), created_at: new Date().toISOString(), sender_id: currentUserId },
      unreadCount: 0,
    }
    onCreated(newConv)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
          <h2 className="text-base font-semibold text-white">New Conversation</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <IconClose />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recipient selector */}
          <div>
            <label className="text-xs font-medium text-white/50 mb-1.5 block">To</label>
            {selectedRecipient ? (
              <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-[#4ecde6] text-xs font-semibold">
                    {selectedRecipient.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-white">{selectedRecipient.full_name}</span>
                  {roleBadge(selectedRecipient.role)}
                </div>
                <button
                  onClick={() => setSelectedRecipient(null)}
                  className="text-white/30 hover:text-white transition-colors"
                >
                  <IconClose />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                    <IconSearch />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by name or role..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 transition-colors"
                    autoFocus
                  />
                </div>
                {recipientSearch && (
                  <div className="mt-1 max-h-40 overflow-y-auto bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    {filteredRecipients.length === 0 ? (
                      <p className="text-xs text-white/30 px-3 py-2">No results</p>
                    ) : (
                      filteredRecipients.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setSelectedRecipient(r)
                            setRecipientSearch('')
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#4ecde6]/10 border border-[#4ecde6]/20 flex items-center justify-center text-[#4ecde6] text-xs font-semibold">
                            {r.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-white/80">{r.full_name}</span>
                          {roleBadge(r.role)}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-white/50 mb-1.5 block">
              Subject <span className="text-white/25">(optional)</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Training schedule question"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 transition-colors"
            />
          </div>

          {/* First message */}
          <div>
            <label className="text-xs font-medium text-white/50 mb-1.5 block">Message</label>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 transition-colors resize-none"
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleCreate}
            disabled={!selectedRecipient || !firstMessage.trim() || creating}
            className="w-full py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-lg text-sm font-bold hover:bg-[#3dbcd5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {creating ? (
              <div className="w-4 h-4 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
            ) : (
              <>
                <IconSend />
                Send Message
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
