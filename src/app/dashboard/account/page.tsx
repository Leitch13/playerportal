import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import ProfileEditor from './ProfileEditor'
import ChildEditor from './ChildEditor'
import ThemeToggle from './ThemeToggle'
import NotificationSettings from './NotificationSettings'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: players } = await supabase
    .from('players')
    .select(
      'id, first_name, last_name, date_of_birth, medical_info, emergency_contact_name, emergency_contact_phone, school, kit_size'
    )
    .eq('parent_id', user.id)
    .order('first_name')

  const { data: org } = profile?.organisation_id
    ? await supabase
        .from('organisations')
        .select('name, slug')
        .eq('id', profile.organisation_id)
        .single()
    : { data: null }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Account</h1>

      <Card title="Your Details">
        <div className="mb-4 flex flex-wrap gap-2 text-sm text-text-light">
          <span className="inline-block px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium text-xs">
            {user.email}
          </span>
          <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-xs capitalize">
            {profile?.role || 'parent'}
          </span>
          {org && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium text-xs">
              {org.name}
            </span>
          )}
        </div>
        <ProfileEditor
          profile={{
            full_name: profile?.full_name || '',
            phone: profile?.phone || null,
            address: profile?.address || null,
            secondary_contact_name: profile?.secondary_contact_name || null,
            secondary_contact_phone: profile?.secondary_contact_phone || null,
          }}
        />
      </Card>

      {/* Settings */}
      <Card title="Settings">
        <div className="space-y-6">
          <ThemeToggle />
          <NotificationSettings emailNotifications={profile?.email_notifications !== false} />
        </div>
      </Card>

      {(players || []).length > 0 && (
        <Card title="Children's Details">
          <p className="text-sm text-text-light mb-4">
            Update medical info, emergency contacts, and other details for your
            children. Your coach will update training-related info like position
            and age group.
          </p>
          <div className="divide-y divide-border">
            {(players || []).map((child) => (
              <div key={child.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/dashboard/players/${child.id}`}
                      className="font-medium text-sm hover:text-accent transition-colors"
                    >
                      {child.first_name} {child.last_name}
                    </Link>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {child.date_of_birth && (
                        <span className="text-xs text-text-light">
                          DOB: {new Date(child.date_of_birth).toLocaleDateString()}
                        </span>
                      )}
                      {child.kit_size && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-dark">
                          Kit: {child.kit_size}
                        </span>
                      )}
                      {child.school && (
                        <span className="text-xs text-text-light">
                          {child.school}
                        </span>
                      )}
                    </div>
                    {child.medical_info && (
                      <p className="text-xs text-danger mt-1">
                        Medical: {child.medical_info}
                      </p>
                    )}
                    {child.emergency_contact_name && (
                      <p className="text-xs text-text-light mt-1">
                        Emergency: {child.emergency_contact_name}
                        {child.emergency_contact_phone && ` — ${child.emergency_contact_phone}`}
                      </p>
                    )}
                  </div>
                </div>
                <ChildEditor child={child} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Org invite code */}
      {org?.slug && (
        <Card title="Invite Others">
          <p className="text-sm text-text-light mb-2">
            Share this signup link so others can join your organisation:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-surface-dark rounded-lg text-sm font-mono break-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://playerportal-eight.vercel.app'}/auth/signup?org={org.slug}
            </code>
          </div>
        </Card>
      )}
    </div>
  )
}
