import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CertificateView from './CertificateView'

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: award } = await supabase
    .from('academy_awards')
    .select(`
      *,
      player:players(id, first_name, last_name),
      term:terms(name),
      awarder:profiles!academy_awards_profile_id_fkey(full_name)
    `)
    .eq('id', id)
    .single()

  if (!award) notFound()

  const { data: org } = await supabase
    .from('organisations')
    .select('name, logo_url, primary_color')
    .eq('id', award.organisation_id)
    .single()

  const awardLabels: Record<string, string> = {
    player_of_term: 'Player of the Term',
    most_improved: 'Most Improved',
    best_attendance: 'Best Attendance',
    coaches_award: "Coach's Award",
    golden_boot: 'Golden Boot',
    team_player: 'Team Player',
    rising_star: 'Rising Star',
    custom: 'Special Award',
  }

  const awardIcons: Record<string, string> = {
    player_of_term: '\u{1F3C6}',
    most_improved: '\u{1F31F}',
    best_attendance: '\u{2B50}',
    coaches_award: '\u{1F451}',
    golden_boot: '\u{26BD}',
    team_player: '\u{1F91D}',
    rising_star: '\u{1F525}',
    custom: '\u{1F3C5}',
  }

  const player = award.player as { first_name: string; last_name: string } | null
  const term = award.term as { name: string } | null
  const awarder = award.awarder as { full_name: string } | null

  return (
    <CertificateView
      awardId={award.id}
      playerName={player ? `${player.first_name} ${player.last_name}` : 'Unknown'}
      awardLabel={award.award_type === 'custom' ? (award.custom_title || 'Special Award') : awardLabels[award.award_type]}
      awardIcon={awardIcons[award.award_type] || '\u{1F3C6}'}
      notes={award.notes}
      termName={term?.name || null}
      date={award.created_at}
      orgName={org?.name || 'Academy'}
      orgLogoUrl={org?.logo_url || null}
      orgColor={org?.primary_color || '#d4af37'}
      awarderName={awarder?.full_name || null}
    />
  )
}
