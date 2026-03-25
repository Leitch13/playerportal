import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmptyState from '@/components/EmptyState'
import type { UserRole } from '@/lib/types'
import PhotoUploader from './PhotoUploader'
import GalleryGrid from './GalleryGrid'

export default async function GalleryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'parent') as UserRole
  const isStaff = role === 'admin' || role === 'coach'
  const orgId = profile?.organisation_id || ''

  // Fetch photos - parents only see visible_to_parents = true
  let query = supabase
    .from('gallery_photos')
    .select('*, group:training_groups(name)')
    .order('created_at', { ascending: false })

  if (!isStaff) {
    query = query.eq('visible_to_parents', true)
  }

  const { data: photos } = await query

  // Fetch groups for uploader
  const { data: groups } = isStaff
    ? await supabase.from('training_groups').select('id, name').order('name')
    : { data: [] }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Photo Gallery</h1>

      {isStaff && (
        <PhotoUploader
          groups={groups || []}
          userId={user.id}
          orgId={orgId}
        />
      )}

      {(photos || []).length === 0 ? (
        <EmptyState message="No photos yet." />
      ) : (
        <GalleryGrid photos={photos || []} isStaff={isStaff} />
      )}
    </div>
  )
}
