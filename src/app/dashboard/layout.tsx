import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navigation from '@/components/Navigation'
import ThemeProvider from '@/components/ThemeProvider'
import BrandProvider from '@/components/BrandProvider'
import ResendVerificationButton from '@/components/ResendVerificationButton'
import type { UserRole } from '@/lib/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, theme, organisation_id, is_super_admin')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const userName = profile?.full_name || user.email || 'User'
  const theme = (profile?.theme || 'light') as 'light' | 'dark' | 'system'

  // Fetch org branding for white-label
  let orgBrand: { primary_color: string | null; logo_url: string | null; name: string } | null = null
  if (profile?.organisation_id) {
    const { data } = await supabase
      .from('organisations')
      .select('primary_color, logo_url, name')
      .eq('id', profile.organisation_id)
      .single()
    orgBrand = data
  }

  // Count unread messages
  const { count: unreadCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('read', false)

  // Count unread notifications from the notifications table
  const { count: notifCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .eq('read', false)
  const notificationCount = notifCount || 0

  return (
    <ThemeProvider initialTheme={theme}>
      <BrandProvider
        primaryColor={orgBrand?.primary_color}
        logoUrl={orgBrand?.logo_url}
        orgName={orgBrand?.name}
      >
      <div className="min-h-screen bg-[#0a0a0a] has-bottom-nav lg:pb-0">
        <Navigation
          role={role}
          userName={userName}
          userId={user.id}
          unreadCount={unreadCount || 0}
          notificationCount={notificationCount}
          orgName={orgBrand?.name || undefined}
          logoUrl={orgBrand?.logo_url || undefined}
          isSuperAdmin={profile?.is_super_admin || false}
        />
        <main className="lg:ml-64 min-h-[calc(100vh-3.5rem)]">
          {!user.email_confirmed_at && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
                <p className="text-sm text-amber-200">
                  <strong>Verify your email</strong> — Check your inbox for a confirmation link from Player Portal.
                </p>
                <ResendVerificationButton email={user.email || ''} />
              </div>
            </div>
          )}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6 animate-page-in text-white">{children}</div>
        </main>
      </div>
    </BrandProvider>
    </ThemeProvider>
  )
}
