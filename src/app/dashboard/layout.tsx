import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navigation from '@/components/Navigation'
import ThemeProvider from '@/components/ThemeProvider'
import BrandProvider from '@/components/BrandProvider'
import ResendVerificationButton from '@/components/ResendVerificationButton'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import GlobalSearch from '@/components/GlobalSearch'
import TrialExpiredLock from '@/components/TrialExpiredLock'
import { getOrgFeatures, featuresToArray } from '@/lib/features'
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

  // Fetch org branding for white-label + platform trial status
  let orgBrand: { primary_color: string | null; logo_url: string | null; name: string } | null = null
  let orgTrial: {
    pilot: boolean | null
    platform_subscription_status: string | null
    platform_trial_ends_at: string | null
    platform_stripe_subscription_id: string | null
    is_published: boolean | null
  } | null = null
  if (profile?.organisation_id) {
    const { data } = await supabase
      .from('organisations')
      .select('primary_color, logo_url, name, pilot, platform_subscription_status, platform_trial_ends_at, platform_stripe_subscription_id, is_published')
      .eq('id', profile.organisation_id)
      .single()
    orgBrand = data
    orgTrial = data
  }

  // ─── Platform access gate (academy admins only) ───
  // Lock the admin dashboard behind a "choose a plan" screen when the academy
  // has no valid platform access: trial expired, OR a previously-paid plan that
  // lapsed (cancelled / past_due). Parents/coaches and the public booking page
  // are unaffected. Pilot orgs + super-admins always bypass.
  const status = orgTrial?.platform_subscription_status || 'trial'
  const trialEndsMs = orgTrial?.platform_trial_ends_at ? Date.parse(orgTrial.platform_trial_ends_at) : null
  const onTrial = status === 'trial'
  const isPilotOrg = !!orgTrial?.pilot
  const hasActiveAccess = status === 'active' || isPilotOrg
  const msLeft = trialEndsMs != null ? trialEndsMs - Date.now() : null
  const trialDaysLeft = msLeft != null ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : null
  const isAdminGateable = role === 'admin' && !profile?.is_super_admin && !isPilotOrg && !hasActiveAccess
  // Trial ran out with no plan, OR they were paying and the plan lapsed.
  const trialExpired = isAdminGateable && onTrial && msLeft != null && msLeft <= 0
  const planLapsed = isAdminGateable && (status === 'cancelled' || status === 'past_due')
  const dashboardLocked = trialExpired || planLapsed
  const showTrialCountdown = isAdminGateable && onTrial && trialDaysLeft != null && trialDaysLeft > 0 && trialDaysLeft <= 3
  const hasPaidPlatform = hasActiveAccess
  // Hybrid go-live: admins of an unpublished, non-pilot org see a persistent
  // "go live" prompt (their booking page is in preview until they subscribe).
  const showGoLive =
    role === 'admin' &&
    !profile?.is_super_admin &&
    !isPilotOrg &&
    !hasPaidPlatform &&
    orgTrial?.is_published === false

  // Load feature gating context for this org
  const featureCtx = profile?.organisation_id
    ? await getOrgFeatures(profile.organisation_id)
    : null
  const availableFeatures = featureCtx ? featuresToArray(featureCtx) : []
  const isPilot = featureCtx?.pilot || false
  const planSlug = featureCtx?.planSlug || null

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

  // For coaches: find next session link for mobile tab bar
  let nextSessionHref: string | undefined
  if (role === 'coach') {
    const todayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
    const { data: coachGroups } = await supabase
      .from('training_groups')
      .select('id, time_slot')
      .eq('coach_id', user.id)
      .eq('day_of_week', todayName)
      .order('time_slot', { ascending: true })
    if (coachGroups && coachGroups.length > 0) {
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
      const next = coachGroups.find((g) => {
        if (!g.time_slot) return true
        const m12 = g.time_slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
        const m24 = g.time_slot.trim().match(/^(\d{1,2}):(\d{2})$/)
        let h = 0, m = 0
        if (m12) { h = parseInt(m12[1]); m = parseInt(m12[2]); if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12; if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0; }
        else if (m24) { h = parseInt(m24[1]); m = parseInt(m24[2]); }
        else return true
        return h * 60 + m >= nowMins - 60
      }) || coachGroups[coachGroups.length - 1]
      nextSessionHref = `/dashboard/session/${next.id}/live`
    }
  }

  // No valid platform access (trial expired or plan lapsed) → lock the admin
  // dashboard behind the plan-chooser screen.
  if (dashboardLocked) {
    return (
      <ThemeProvider initialTheme={theme}>
        <TrialExpiredLock
          orgName={orgBrand?.name || 'your academy'}
          primaryColor={orgBrand?.primary_color || '#4ecde6'}
          reason={planLapsed ? 'lapsed' : 'trial_ended'}
        />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider initialTheme={theme}>
      <BrandProvider
        primaryColor={orgBrand?.primary_color}
        logoUrl={orgBrand?.logo_url}
        orgName={orgBrand?.name}
      >
      <GlobalSearch />
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
          nextSessionHref={nextSessionHref}
          availableFeatures={availableFeatures}
          isPilot={isPilot}
          planSlug={planSlug}
        />
        <main className="lg:ml-64 min-h-[calc(100vh-3.5rem)]">
          {showGoLive && (
            <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-3">
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-sm text-sky-200">
                  <strong>Your booking page is in preview.</strong>{' '}
                  Set everything up free — then go live to start taking bookings from parents.
                </p>
                <a
                  href="/dashboard/billing"
                  className="shrink-0 inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-400 text-[#0a0a0a] hover:bg-sky-300 transition-colors"
                >
                  Go live →
                </a>
              </div>
            </div>
          )}
          {showTrialCountdown && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-sm text-amber-200">
                  <strong>Your free trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}.</strong>{' '}
                  Choose a plan now to keep your dashboard live — your booking page and parents stay live throughout.
                </p>
                <a
                  href="/dashboard/billing"
                  className="shrink-0 inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-[#0a0a0a] hover:bg-amber-300 transition-colors"
                >
                  Choose a plan →
                </a>
              </div>
            </div>
          )}
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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
            <PushNotificationPrompt />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6 animate-page-in text-white">{children}</div>
        </main>
      </div>
    </BrandProvider>
    </ThemeProvider>
  )
}
