import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { findPending, linkExpired, datePassed } from '@/lib/trial-email-confirm'
import ConfirmTrialButton from './ConfirmTrialButton'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * Opened from the "Confirm my trial" email. Opening it changes nothing: email
 * scanners open links too. Only the button confirms. See src/lib/trial-email-confirm.ts.
 */
export default async function ConfirmTrialPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const pending = await findPending(sb, token)
  const { data: org } = await sb.from('organisations').select('name, primary_color').ilike('slug', slug).maybeSingle()
  const color = (org?.primary_color as string | null) || '#4ecde6'
  const academy = (org?.name as string | null) || pending?.trial.orgName || 'the academy'
  const bookUrl = `/book/${encodeURIComponent(slug)}`

  const t = pending?.trial
  const dateLabel = t?.sessionDate
    ? new Date(t.sessionDate + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  let initial: 'ready' | 'already' | 'expired' | 'date_passed' | 'not_found' = 'ready'
  if (!pending) initial = 'not_found'
  else if (pending.confirmedTrialId) initial = 'already'
  else if (linkExpired(pending.createdAt)) initial = 'expired'
  else if (datePassed(t!.sessionDate)) initial = 'date_passed'

  return (
    <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white/[0.04] border border-white/[0.08] rounded-2xl p-7 sm:p-8">
        <p className="text-xs uppercase tracking-wider text-white/40 mb-2">{academy}</p>
        {t && (
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold mb-1">{t.childName}&apos;s free trial</h1>
            <p className="text-white/60 text-sm">
              {t.className ? <>{t.className}</> : 'Free trial session'}
              {dateLabel ? <> · {dateLabel}</> : null}
            </p>
            <p className="text-white/40 text-xs mt-1">Booked by {t.parentName} · {t.email}</p>
          </div>
        )}
        <ConfirmTrialButton token={token} color={color} initial={initial} bookUrl={bookUrl} childName={t?.childName ?? ''} academy={academy} />
        <p className="text-white/30 text-xs mt-6">
          Didn&apos;t book this? Close this page and nothing happens. <Link href={bookUrl} className="underline">Booking page</Link>
        </p>
      </div>
    </div>
  )
}
