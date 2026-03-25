import { createClient } from '@/lib/supabase/server'

/**
 * Get the current user's organisation_id from their profile.
 * Used in server components to pass org_id to client forms.
 */
export async function getMyOrg(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  return data?.organisation_id || null
}
