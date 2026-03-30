import { createClient } from '@/lib/supabase/client'

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Request permission for push notifications.
 * Returns the permission state: 'granted', 'denied', or 'default'.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied'
  return Notification.requestPermission()
}

/**
 * Subscribe to push notifications via the service worker.
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY to be set.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured — skipping push subscription.')
    return null
  }

  const registration = await navigator.serviceWorker.ready

  // Check for existing subscription
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  })

  return subscription
}

/**
 * Save a push subscription to the database via our API route.
 */
export async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })
    return res.ok
  } catch (err) {
    console.error('[Push] Failed to save subscription:', err)
    return false
  }
}

/**
 * Check if the current user already has a push subscription saved.
 */
export async function hasExistingSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}
