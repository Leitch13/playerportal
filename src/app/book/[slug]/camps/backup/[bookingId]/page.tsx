import { createClient } from '@supabase/supabase-js'
import BackupContactForm from './BackupContactForm'

/**
 * Where a family who has already booked a camp adds their backup contact.
 * See src/lib/camp-backup-contact.ts. Shows the child's first name and the
 * camp so the parent knows they are in the right place, and nothing else.
 */
export const dynamic = 'force-dynamic'

export default async function CampBackupContactPage({ params }: { params: Promise<{ slug: string; bookingId: string }> }) {
  const { slug, bookingId } = await params
  let found: { child: string; camp: string; academy: string; needBackup: boolean; needDob: boolean } | null = null
  if (/^[0-9a-f-]{36}$/i.test(bookingId)) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: b } = await sb.from('camp_bookings').select('child_name, child_dob, payment_status, camp:camps(name), organisation:organisations(name, slug)').eq('id', bookingId).maybeSingle()
    const org = b?.organisation as unknown as { name: string; slug: string } | null
    if (b && org?.slug?.toLowerCase() === slug.toLowerCase() && !['cancelled', 'refunded'].includes(b.payment_status as string)) {
      const { count: backups } = await sb.from('audit_log').select('id', { count: 'exact', head: true }).eq('action', 'camp.backup_contact').eq('entity_id', bookingId)
      found = { child: ((b.child_name as string) || '').trim().split(/\s+/)[0] || 'your child', camp: (b.camp as unknown as { name: string } | null)?.name || 'the camp', academy: org.name, needBackup: !backups, needDob: !b.child_dob }
    }
  }
  return (
    <main className="min-h-screen bg-[#08111b] px-4 py-10 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-[#243652] bg-gradient-to-b from-[#132238] to-[#0d1726] p-6" data-testid="camp-backup-page">
        {found ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4ecde6]">{found.academy}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{found.needBackup ? `A backup contact for ${found.child}` : `${found.child}'s details`}</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/65">For {found.camp}. {found.needBackup ? 'If we cannot reach you during the camp, who else can we ring?' : ''}{found.needDob ? ' And their date of birth, so the coaches have their age.' : ''} It takes ten seconds.</p>
            {found.needBackup || found.needDob
              ? <BackupContactForm bookingId={bookingId} child={found.child} needBackup={found.needBackup} needDob={found.needDob} />
              : <p className="mt-5 text-sm text-white/80" data-testid="camp-backup-nothing">Thank you, we have everything we need.</p>}
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">This link is not right</h1>
            <p className="mt-2 text-sm text-white/65">We could not find that booking. Please ask your academy for a new link.</p>
          </>
        )}
      </div>
    </main>
  )
}
