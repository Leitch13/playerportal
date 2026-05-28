import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'
import PoliciesForm from './PoliciesForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single()

  // Team = staff only (admins + coaches). Parents are customers, not team
  // members, so they must never appear in this list.
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('organisation_id', orgId)
    .in('role', ['admin', 'coach'])
    .order('role')

  // Usage stats
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)

  const { count: coachCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)
    .eq('role', 'coach')

  const { count: classCount } = await supabase
    .from('training_groups')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', orgId)

  return (
    <div className="space-y-6">
    <SettingsForm
      org={org ? {
        id: org.id,
        name: org.name || '',
        slug: org.slug || '',
        description: org.description || '',
        contact_email: org.contact_email || '',
        contact_phone: org.contact_phone || '',
        location: org.location || '',
        primary_color: org.primary_color || '#4ecde6',
        logo_url: org.logo_url || '',
        hero_image_url: org.hero_image_url || '',
        google_review_url: org.google_review_url || '',
        sibling_discount_enabled: !!org.sibling_discount_enabled,
        sibling_discount_percent: Number(org.sibling_discount_percent ?? 10),
        quarterly_billing_enabled: org.quarterly_billing_enabled !== false,
        quarterly_discount_percent: Number(org.quarterly_discount_percent ?? 10),
        retention_offer_enabled: org.retention_offer_enabled !== false,
        retention_offer_percent: Number(org.retention_offer_percent ?? 25),
        retention_offer_months: org.retention_offer_months == null ? null : Number(org.retention_offer_months),
      } : null}
      team={(teamMembers || []).map(m => ({
        id: m.id,
        name: m.full_name || '',
        email: m.email || '',
        role: m.role || 'parent',
        joinedAt: m.created_at,
      }))}
      usage={{
        players: playerCount || 0,
        coaches: coachCount || 0,
        classes: classCount || 0,
      }}
    />
    {org && (
      <PoliciesForm
        orgId={org.id}
        initial={{
          cancellation_notice_days: Number(org.cancellation_notice_days ?? 0),
          refund_policy: (org.refund_policy as string) || '',
          late_payment_grace_days: Number(org.late_payment_grace_days ?? 0),
          terms_text: (org.terms_text as string) || '',
        }}
      />
    )}
    </div>
  )
}
