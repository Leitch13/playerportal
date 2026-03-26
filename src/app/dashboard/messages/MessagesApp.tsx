'use client'

import { useState } from 'react'
import type { UserRole } from '@/lib/types'
import MessageList from './MessageList'
import MessageThread from './MessageThread'
import NewMessage from './NewMessage'

export type MessageData = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  subject: string | null
  read: boolean
  created_at: string
  thread_id: string
  sender: { id: string; full_name: string; role: string } | null
  recipient: { id: string; full_name: string; role: string } | null
}

export type ThreadData = {
  threadId: string
  otherUser: { id: string; full_name: string; role: string }
  lastMessage: { body: string; created_at: string; sender_id: string }
  unreadCount: number
  subject: string | null
  messages: MessageData[]
}

export default function MessagesApp({
  currentUserId,
  currentUserName,
  role,
  orgId,
  initialThreads,
  recipients,
}: {
  currentUserId: string
  currentUserName: string
  role: UserRole
  orgId: string
  initialThreads: ThreadData[]
  recipients: { id: string; full_name: string; role: string }[]
}) {
  const [threads, setThreads] = useState<ThreadData[]>(initialThreads)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list')

  const selectedThread = threads.find((t) => t.threadId === selectedThreadId) || null

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId)
    setShowNewMessage(false)
    setMobileView('thread')
  }

  function handleBack() {
    setMobileView('list')
    setSelectedThreadId(null)
  }

  function handleNewMessage() {
    setShowNewMessage(true)
    setSelectedThreadId(null)
    setMobileView('thread')
  }

  function handleMessageSent(newMsg: MessageData) {
    setThreads((prev) => {
      const existingIdx = prev.findIndex((t) => t.threadId === newMsg.thread_id)
      if (existingIdx >= 0) {
        const updated = [...prev]
        updated[existingIdx] = {
          ...updated[existingIdx],
          messages: [...updated[existingIdx].messages, newMsg],
          lastMessage: {
            body: newMsg.body,
            created_at: newMsg.created_at,
            sender_id: newMsg.sender_id,
          },
        }
        // Move to top
        const thread = updated.splice(existingIdx, 1)[0]
        return [thread, ...updated]
      } else {
        // New thread
        const newThread: ThreadData = {
          threadId: newMsg.thread_id,
          otherUser: newMsg.recipient || {
            id: newMsg.recipient_id,
            full_name: 'Unknown',
            role: 'parent',
          },
          lastMessage: {
            body: newMsg.body,
            created_at: newMsg.created_at,
            sender_id: newMsg.sender_id,
          },
          unreadCount: 0,
          subject: newMsg.subject,
          messages: [newMsg],
        }
        return [newThread, ...prev]
      }
    })
    setSelectedThreadId(newMsg.thread_id)
    setShowNewMessage(false)
    setMobileView('thread')
  }

  function handleNewRealtimeMessage(newMsg: MessageData) {
    setThreads((prev) => {
      const existingIdx = prev.findIndex((t) => t.threadId === newMsg.thread_id)
      if (existingIdx >= 0) {
        const updated = [...prev]
        // Don't add duplicates
        const alreadyExists = updated[existingIdx].messages.some((m) => m.id === newMsg.id)
        if (!alreadyExists) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            messages: [...updated[existingIdx].messages, newMsg],
            lastMessage: {
              body: newMsg.body,
              created_at: newMsg.created_at,
              sender_id: newMsg.sender_id,
            },
            unreadCount:
              newMsg.recipient_id === currentUserId
                ? updated[existingIdx].unreadCount + 1
                : updated[existingIdx].unreadCount,
          }
        }
        const thread = updated.splice(existingIdx, 1)[0]
        return [thread, ...updated]
      } else {
        const newThread: ThreadData = {
          threadId: newMsg.thread_id,
          otherUser: newMsg.sender || {
            id: newMsg.sender_id,
            full_name: 'Unknown',
            role: 'parent',
          },
          lastMessage: {
            body: newMsg.body,
            created_at: newMsg.created_at,
            sender_id: newMsg.sender_id,
          },
          unreadCount: 1,
          subject: newMsg.subject,
          messages: [newMsg],
        }
        return [newThread, ...prev]
      }
    })
  }

  function handleThreadRead(threadId: string) {
    setThreads((prev) =>
      prev.map((t) =>
        t.threadId === threadId
          ? {
              ...t,
              unreadCount: 0,
              messages: t.messages.map((m) =>
                m.recipient_id === currentUserId ? { ...m, read: true } : m
              ),
            }
          : t
      )
    )
  }

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-0 min-h-screen text-white">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 lg:px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <h1 className="text-xl font-bold text-white">Messages</h1>
            <button
              onClick={handleNewMessage}
              className="flex items-center gap-2 px-4 py-2 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-semibold hover:bg-[#4ecde6]/90 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              New Message
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
          {/* Thread list - hidden on mobile when viewing a thread */}
          <div
            className={`w-full lg:w-[380px] lg:min-w-[380px] border-r border-white/[0.06] flex-shrink-0 overflow-hidden flex flex-col ${
              mobileView === 'thread' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <MessageList
              threads={threads}
              selectedThreadId={selectedThreadId}
              currentUserId={currentUserId}
              onSelectThread={handleSelectThread}
            />
          </div>

          {/* Thread detail / New message - hidden on mobile when viewing list */}
          <div
            className={`flex-1 flex flex-col overflow-hidden ${
              mobileView === 'list' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {showNewMessage ? (
              <NewMessage
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                orgId={orgId}
                recipients={recipients}
                onMessageSent={handleMessageSent}
                onBack={() => {
                  setShowNewMessage(false)
                  setMobileView('list')
                }}
              />
            ) : selectedThread ? (
              <MessageThread
                thread={selectedThread}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                orgId={orgId}
                onBack={handleBack}
                onMessageSent={handleMessageSent}
                onNewRealtimeMessage={handleNewRealtimeMessage}
                onThreadRead={handleThreadRead}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/[0.08]">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-40"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-white/40 text-sm">Select a conversation to start messaging</p>
                  <button
                    onClick={handleNewMessage}
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
    </div>
  )
}
