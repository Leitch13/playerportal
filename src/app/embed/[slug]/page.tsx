import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CLASS_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  group: { label: 'Group', color: '#3b82f6' },
  small_group: { label: 'Small Group', color: '#a855f7' },
  '1-2-1': { label: '1-2-1', color: '#f59e0b' },
  '2-1': { label: '2-1 Pair', color: '#f97316' },
  gk: { label: 'Goalkeeper', color: '#eab308' },
  soccer_tots: { label: 'Soccer Tots', color: '#ec4899' },
  academy: { label: 'Academy', color: '#6366f1' },
  accelerator: { label: 'Accelerator', color: '#f43f5e' },
  elite: { label: 'Elite', color: '#8b5cf6' },
  camp: { label: 'Camp', color: '#22c55e' },
  trial: { label: 'Trial', color: '#06b6d4' },
  girls: { label: 'Girls Only', color: '#d946ef' },
  adults: { label: 'Adults', color: '#64748b' },
  intensity: { label: 'Intensity', color: '#ef4444' },
}

export default async function EmbedBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { slug } = await params
  const { theme } = await searchParams
  const isDark = theme === 'dark'
  const supabase = createPublicClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .ilike('slug', slug)
    .single()

  if (!org) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Academy Not Found</h1>
        <p style={{ color: '#888' }}>This booking page doesn&apos;t exist.</p>
      </div>
    )
  }

  const { data: groups } = await supabase
    .from('training_groups')
    .select('id, name, day_of_week, time_slot, location, max_capacity, coach:profiles!training_groups_coach_id_fkey(full_name), class_type, is_featured, price_per_session, age_group, short_description, image_url')
    .eq('organisation_id', org.id)
    .order('name')

  const groupIds = (groups || []).map((g) => g.id)
  const { data: enrolments } = groupIds.length > 0
    ? await supabase
        .from('enrolments')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active')
    : { data: [] as { group_id: string }[] }

  const countByGroup = new Map<string, number>()
  for (const e of enrolments || []) {
    countByGroup.set(e.group_id, (countByGroup.get(e.group_id) || 0) + 1)
  }

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const sortedGroups = [...(groups || [])].sort((a, b) => {
    const aFeat = (a.is_featured as boolean) ? 0 : 1
    const bFeat = (b.is_featured as boolean) ? 0 : 1
    if (aFeat !== bFeat) return aFeat - bFeat
    const dayA = DAY_ORDER.indexOf(a.day_of_week || '')
    const dayB = DAY_ORDER.indexOf(b.day_of_week || '')
    return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
  })

  const primaryColor = org.primary_color || '#4ecde6'
  const baseUrl = 'https://theplayerportal.net'

  // Theme colours
  const bg = isDark ? '#0a0a0a' : '#ffffff'
  const cardBg = isDark ? '#141414' : '#f9fafb'
  const cardBorder = isDark ? '#1e1e1e' : '#e5e7eb'
  const textPrimary = isDark ? '#ffffff' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#6b7280'
  const textMuted = isDark ? '#6b7280' : '#9ca3af'
  const barBg = isDark ? '#1e1e1e' : '#e5e7eb'

  return (
    <div style={{ backgroundColor: bg, color: textPrimary, fontFamily: 'system-ui, -apple-system, sans-serif', padding: '16px' }}>
      {/* Academy header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {org.logo_url && (
          <div style={{ marginBottom: 12 }}>
            <img src={org.logo_url} alt={`${org.name} logo`} style={{ height: 48, width: 'auto', objectFit: 'contain', borderRadius: 12, display: 'inline-block' }} />
          </div>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: textPrimary }}>{org.name}</h1>
        {org.description && (
          <p style={{ fontSize: 14, color: textSecondary, margin: 0 }}>{org.description}</p>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={`${baseUrl}/book/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 999, fontSize: 14, fontWeight: 700, backgroundColor: primaryColor, color: '#fff', textDecoration: 'none' }}
          >
            View Full Page
          </a>
          <a
            href={`${baseUrl}/book/${slug}/trial/quick`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 999, fontSize: 14, fontWeight: 700, border: `2px solid ${primaryColor}`, color: primaryColor, textDecoration: 'none', backgroundColor: 'transparent' }}
          >
            Free Trial
          </a>
        </div>
      </div>

      {/* Classes */}
      {sortedGroups.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 16, color: textPrimary }}>Weekly Classes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {sortedGroups.map((group) => {
              const count = countByGroup.get(group.id) || 0
              const capacity = (group as unknown as { max_capacity: number }).max_capacity || 20
              const spotsLeft = capacity - count
              const isFull = spotsLeft <= 0
              const coach = group.coach as unknown as { full_name: string } | null
              const classType = (group.class_type as string) || 'group'
              const typeConfig = CLASS_TYPE_CONFIG[classType] || CLASS_TYPE_CONFIG.group
              const price = group.price_per_session as number | null
              const ageGroup = group.age_group as string | null
              const shortDesc = group.short_description as string | null
              const coverImage = group.image_url as string | null

              return (
                <div key={group.id} style={{ borderRadius: 16, border: `1px solid ${cardBorder}`, backgroundColor: cardBg, overflow: 'hidden' }}>
                  {coverImage && (
                    <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
                      <img src={coverImage} alt={group.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ padding: 16 }}>
                    {/* Tags row */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}>{typeConfig.label}</span>
                      {ageGroup && <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: `${primaryColor}20`, color: primaryColor }}>{ageGroup}</span>}
                    </div>

                    {/* Name + price */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: textPrimary }}>{group.name}</h3>
                      {price != null && Number(price) > 0 && (
                        <span style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', color: primaryColor }}>&pound;{Number(price).toFixed(0)}<span style={{ fontSize: 11, fontWeight: 500, color: textMuted }}>/session</span></span>
                      )}
                    </div>

                    {shortDesc && <p style={{ fontSize: 12, color: textSecondary, margin: '4px 0 8px' }}>{shortDesc}</p>}

                    {/* Details */}
                    <div style={{ fontSize: 13, color: textSecondary, marginBottom: 12 }}>
                      <div style={{ marginBottom: 2 }}>
                        <strong style={{ color: primaryColor }}>{group.day_of_week || 'TBA'}</strong>
                        {group.time_slot && <span style={{ marginLeft: 6 }}>{group.time_slot}</span>}
                      </div>
                      {group.location && <div style={{ marginBottom: 2 }}>{group.location}</div>}
                      {coach?.full_name && <div>Coach {coach.full_name}</div>}
                    </div>

                    {/* Capacity bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                        {isFull ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>Class Full</span>
                        ) : spotsLeft <= 3 ? (
                          <span style={{ color: '#f97316', fontWeight: 700 }}>Only {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left!</span>
                        ) : (
                          <span style={{ color: textMuted }}>{spotsLeft} spots available</span>
                        )}
                        <span style={{ color: textMuted }}>{count}/{capacity}</span>
                      </div>
                      <div style={{ width: '100%', backgroundColor: barBg, borderRadius: 999, height: 5 }}>
                        <div style={{ height: 5, borderRadius: 999, width: `${Math.min(100, (count / capacity) * 100)}%`, backgroundColor: isFull ? '#ef4444' : spotsLeft <= 3 ? '#f97316' : primaryColor }} />
                      </div>
                    </div>

                    {/* CTA */}
                    <a
                      href={`${baseUrl}/book/${slug}/class/${group.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'center',
                        padding: '12px 0',
                        borderRadius: 12,
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        backgroundColor: isFull ? barBg : primaryColor,
                        color: isFull ? textMuted : '#fff',
                        boxSizing: 'border-box',
                      }}
                    >
                      {isFull ? 'Join Waitlist' : 'Book Now'} &rarr;
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: textMuted }}>
        Powered by{' '}
        <a href={baseUrl} target="_blank" rel="noopener noreferrer" style={{ color: primaryColor, textDecoration: 'none' }}>
          Player Portal
        </a>
      </div>
    </div>
  )
}
