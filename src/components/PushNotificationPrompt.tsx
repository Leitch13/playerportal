'use client'

import { useState, useEffect } from 'react'
import {
  isPushSupported,
  requestPushPermission,
  subscribeToPush,
  saveSubscription,
  hasExistingSubscription,
} from '@/lib/push'

const DISMISSED_KEY = 'push-prompt-dismissed'

export default function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Don't show if not supported, already dismissed, or already granted
    if (!isPushSupported()) return
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return
    if (Notification.permission === 'granted') {
      // Already granted — check if we have a subscription
      hasExistingSubscription().then((has) => {
        if (!has) setVisible(true)
      })
      return
    }
    if (Notification.permission === 'denied') return

    setVisible(true)
  }, [])

  const handleEnable = async () => {
    setLoading(true)
    try {
      const permission = await requestPushPermission()
      if (permission !== 'granted') {
        setVisible(false)
        return
      }

      const subscription = await subscribeToPush()
      if (subscription) {
        await saveSubscription(subscription)
      }
      setVisible(false)
    } catch (err) {
      console.error('[Push] Error enabling notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0" aria-hidden="true">
          🔔
        </span>
        <p className="text-sm text-gray-300">
          Enable notifications to stay updated on sessions, payments, and announcements.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={handleEnable}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          {loading ? 'Enabling...' : 'Enable Notifications'}
        </button>
      </div>
    </div>
  )
}
