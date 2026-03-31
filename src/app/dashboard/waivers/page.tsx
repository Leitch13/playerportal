import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import StatusBadge from '@/components/StatusBadge'
import type { UserRole } from '@/lib/types'
import WaiverManager from './WaiverManager'
import SignWaiver from './SignWaiver'

export default async function WaiversPage() {
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

  // Fetch active waivers
  const { data: waivers } = await supabase
    .from('waivers')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (isStaff) {
    // Admin/Coach view: show all waivers with signature stats
    const { data: allSignatures } = await supabase
      .from('waiver_signatures')
      .select('*, parent:profiles!waiver_signatures_parent_id_fkey(full_name), player:players(first_name, last_name)')

    const { data: allParents } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'parent')

    return (
      <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Waivers & Consent Forms</h1>

        <WaiverManager orgId={orgId} />

        {(waivers || []).length === 0 ? (
          <EmptyState message="No waivers created yet." />
        ) : (
          <div className="space-y-4">
            {(waivers || []).map((waiver) => {
              const sigs = (allSignatures || []).filter(
                (s) => s.waiver_id === waiver.id
              )
              const signedParentIds = new Set(sigs.map((s) => s.parent_id as string))
              const unsignedParents = (allParents || []).filter(
                (p) => !signedParentIds.has(p.id)
              )

              return (
                <Card key={waiver.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{waiver.title}</h3>
                        {waiver.required ? (
                          <StatusBadge status="overdue" />
                        ) : (
                          <StatusBadge status="waived" />
                        )}
                        <span className="text-xs text-white/40">v{waiver.version}</span>
                      </div>
                      <p className="text-sm text-white/60 line-clamp-2 mb-3">{waiver.content}</p>

                      {/* Signature stats */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="text-cyan-400 font-medium">
                          {sigs.length} signed
                        </span>
                        <span className="text-yellow-400 font-medium">
                          {unsignedParents.length} unsigned
                        </span>
                      </div>

                      {/* Signed list */}
                      {sigs.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-white/60 mb-1">Signed by:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sigs.map((sig) => (
                              <span
                                key={sig.id}
                                className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/15 text-cyan-400"
                              >
                                {(sig.parent as unknown as { full_name: string })?.full_name || 'Unknown'}
                                {' - '}
                                {(sig.player as unknown as { first_name: string; last_name: string })?.first_name}{' '}
                                {(sig.player as unknown as { first_name: string; last_name: string })?.last_name}
                                {' ('}
                                {new Date(sig.signed_at).toLocaleDateString()}
                                {')'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Unsigned list */}
                      {unsignedParents.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-white/60 mb-1">Not yet signed:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {unsignedParents.map((p) => (
                              <span
                                key={p.id}
                                className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-400"
                              >
                                {p.full_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
      </div>
    )
  }

  // Parent view: show waivers to sign
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)
    .order('first_name')

  const { data: mySignatures } = await supabase
    .from('waiver_signatures')
    .select('id, waiver_id, player_id, signed_at')
    .eq('parent_id', user.id)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen text-white">
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Waivers & Consent Forms</h1>

      {(waivers || []).length === 0 ? (
        <EmptyState message="No waivers to sign." />
      ) : (
        <SignWaiver
          waivers={(waivers || []).map((w) => ({
            id: w.id as string,
            title: w.title as string,
            content: w.content as string,
            required: w.required as boolean,
            version: w.version as number,
          }))}
          signatures={(mySignatures || []).map((s) => ({
            id: s.id as string,
            waiver_id: s.waiver_id as string,
            player_id: s.player_id as string,
            signed_at: s.signed_at as string,
          }))}
          players={(players || []).map((p) => ({
            id: p.id as string,
            first_name: p.first_name as string,
            last_name: p.last_name as string,
          }))}
          userId={user.id}
          orgId={orgId}
        />
      )}
    </div>
    </div>
  )
}
