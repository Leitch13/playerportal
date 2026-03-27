'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ThreadData, MessageData } from './MessagesApp'

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return time
  if (diffDays === 1) return `Yesterday ${time}`
  if (diffDays < 7)
    return `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`
}

function shouldShowDateSeparator(current: string, previous: string | null): boolean {
  if (!previous) return true
  const a = new Date(current).toDateString()
  const b = new Date(previous).toDateString()
  return a !== b
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function MessageThread({
  thread,
  currentUserId,
  currentUserName,
  orgId,
  onBack,
  onMessageSent,
  onNewRealtimeMessage,
  onThreadRead,
}: {
  thread: ThreadData
  currentUserId: string
  currentUserName: string
  orgId: string
  onBack: () => void
  onMessageSent: (msg: MessageData) => void
  onNewRealtimeMessage: (msg: MessageData) => void
  onThreadRead: (threadId: string) => void
}) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [thread.messages.length, scrollToBottom])

  // Mark unread messages as read
  useEffect(() => {
    if (thread.unreadCount === 0) return

    const unreadIds = thread.messages
      .filter((m) => m.recipient_id === currentUserId && !m.read)
      .map((m) => m.id)

    if (unreadIds.length === 0) return

    const supabase = createClient()
    supabase
      .from('messages')
      .update({ read: true })
      .in('id', unreadIds)
      .then(() => {
        onThreadRead(thread.threadId)
      })
  }, [thread.threadId, thread.unreadCount, thread.messages, currentUserId, onThreadRead])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${thread.threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${thread.threadId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Record<string, unknown>
          // Skip messages we sent (already in state)
          if (newMsg.sender_id === currentUserId) return

          // Fetch sender info
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('id', newMsg.sender_id as string)
            .single()

          const messageData: MessageData = {
            id: newMsg.id as string,
            sender_id: newMsg.sender_id as string,
            recipient_id: newMsg.recipient_id as string,
            body: newMsg.body as string,
            subject: newMsg.subject as string | null,
            read: false,
            created_at: newMsg.created_at as string,
            thread_id: newMsg.thread_id as string,
            sender: senderProfile || null,
            recipient: null,
          }

          onNewRealtimeMessage(messageData)

          // Auto mark as read since we're viewing this thread
          await supabase
            .from('messages')
            .update({ read: true })
            .eq('id', newMsg.id as string)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [thread.threadId, currentUserId, onNewRealtimeMessage])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || sending) return

    setSending(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('messages')
      .insert({
        organisation_id: orgId,
        sender_id: currentUserId,
        recipient_id: thread.otherUser.id,
        subject: thread.subject || null,
        body: body.trim(),
        thread_id: thread.threadId,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed to send message:', error.message)
    } else if (data) {
      const msgData: MessageData = {
        id: data.id,
        sender_id: data.sender_id,
        recipient_id: data.recipient_id,
        body: data.body,
        subject: data.subject,
        read: false,
        created_at: data.created_at,
        thread_id: data.thread_id || data.id,
        sender: { id: currentUserId, full_name: currentUserName, role: 'parent' },
        recipient: thread.otherUser,
      }
      onMessageSent(msgData)
      setBody('')
      inputRef.current?.focus()
    }

    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const initial = thread.otherUser.full_name.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#1e1e1e] bg-[#0e0e0e]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] text-white/60 transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              thread.otherUser.role === 'coach'
                ? 'bg-[#4ecde6]/15 text-[#4ecde6] border border-[#4ecde6]/20'
                : thread.otherUser.role === 'admin'
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                  : 'bg-white/10 text-white/70 border border-white/10'
            }`}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {thread.otherUser.full_name}
            </p>
            <p className="text-[11px] text-white/40 capitalize">{thread.otherUser.role}</p>
          </div>
          {thread.subject && (
            <div className="ml-auto hidden sm:block">
              <span className="text-xs text-white/30 bg-[#1a1a1a] px-2.5 py-1 rounded-lg border border-[#1e1e1e]">
                {thread.subject}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {thread.messages.map((msg, idx) => {
          const isMe = msg.sender_id === currentUserId
          const prevMsg = idx > 0 ? thread.messages[idx - 1] : null
          const showDate = shouldShowDateSeparator(
            msg.created_at,
            prevMsg?.created_at || null
          )
          // Group sequential messages from same sender
          const sameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id && !showDate

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDate && (
                <div className="flex items-center justify-center my-4">
                  <span className="text-[11px] text-white/25 bg-[#141414] px-3 py-1 rounded-full">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${
                  sameSenderAsPrev ? 'mt-0.5' : 'mt-3'
                }`}
              >
                <div className={`max-w-[80%] lg:max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-2.5 text-sm leading-relaxed ${
                      isMe
                        ? `bg-[#4ecde6] text-[#0a0a0a] ${
                            sameSenderAsPrev
                              ? 'rounded-2xl rounded-tr-lg'
                              : 'rounded-2xl rounded-br-lg'
                          }`
                        : `bg-[#1a1a1a] text-white/90 border border-[#1e1e1e] ${
                            sameSenderAsPrev
                              ? 'rounded-2xl rounded-tl-lg'
                              : 'rounded-2xl rounded-bl-lg'
                          }`
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  </div>
                  {/* Timestamp - show on last in group or if next is different sender */}
                  {(idx === thread.messages.length - 1 ||
                    thread.messages[idx + 1]?.sender_id !== msg.sender_id) && (
                    <p
                      className={`text-[10px] text-white/20 mt-1 ${
                        isMe ? 'text-right mr-1' : 'ml-1'
                      }`}
                    >
                      {formatMessageTime(msg.created_at)}
                      {isMe && msg.read && (
                        <span className="ml-1.5 text-[#4ecde6]/60">Read</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="flex-shrink-0 p-3 border-t border-[#1e1e1e] bg-[#0e0e0e]">
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/40 focus:ring-1 focus:ring-[#4ecde6]/20 resize-none transition-colors"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="w-10 h-10 flex items-center justify-center bg-[#4ecde6] rounded-xl text-[#0a0a0a] hover:bg-[#4ecde6]/90 disabled:opacity-30 disabled:hover:bg-[#4ecde6] transition-all flex-shrink-0"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
