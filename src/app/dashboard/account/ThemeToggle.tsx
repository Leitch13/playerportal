'use client'

import { useTheme } from '@/components/ThemeProvider'
import { createClient } from '@/lib/supabase/client'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  async function handleChange(newTheme: 'light' | 'dark' | 'system') {
    setTheme(newTheme)

    // Save to profile
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', user.id)
    }
  }

  const options = [
    { value: 'light' as const, label: 'Light', icon: '☀️' },
    { value: 'dark' as const, label: 'Dark', icon: '🌙' },
    { value: 'system' as const, label: 'System', icon: '💻' },
  ]

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Theme</label>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              theme === opt.value
                ? 'bg-primary text-white dark:bg-accent dark:text-primary'
                : 'bg-surface-dark text-text-light hover:bg-border'
            }`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
