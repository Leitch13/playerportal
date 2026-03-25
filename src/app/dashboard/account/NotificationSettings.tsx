'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NotificationSettings({
  emailNotifications: initial,
}: {
  emailNotifications: boolean
}) {
  const [enabled, setEnabled] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    const newVal = !enabled
    setEnabled(newVal)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ email_notifications: newVal })
        .eq('id', user.id)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Email Notifications</label>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-accent' : 'bg-surface-dark'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-text-light">
          {enabled ? 'Receive email alerts for payments, messages & reviews' : 'Email notifications disabled'}
        </span>
      </div>
    </div>
  )
}
