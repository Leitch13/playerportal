import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { academyPaymentsReady } from '@/lib/one-to-one/checkout'
import Tabs from './Tabs'

// 1-2-1 Slots · academy pages. Admin only. Same tab set for every academy;
// the pages are simply empty until the academy adds a coach with hours.
export default async function OneToOneLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  const { data: profile } = await supabase.from('profiles').select('role, organisation_id').eq('id', user.id).single()
  if (profile?.role !== 'admin') notFound()
  // Parents pay by card, so nothing here can take money until Stripe is connected. Say so up front, on every tab.
  const ready = profile.organisation_id ? await academyPaymentsReady(profile.organisation_id as string) : true

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">1-2-1s</h1>
          <p className="mt-1 text-sm text-white/55">Regulars keep their slot and it rolls on. Free time goes on sale. Anything that needs you lands here.</p>
        </div>
      </div>
      {!ready && (
        <div role="status" className="rounded-xl border border-[#d8a95a]/40 bg-[#d8a95a]/10 px-4 py-3 text-sm leading-relaxed text-[#ecc98a]">
          <strong className="font-semibold text-[#f5dcae]">Connect Stripe before you take bookings.</strong>{' '}
          You can set up venues, hours and regulars now, but no pay link reaches a parent and nobody can book online until Stripe is connected.
          Once it is, press <em className="not-italic font-semibold">Resend link</em> on any regular still awaiting payment.{' '}
          <Link href="/dashboard/settings" className="font-semibold text-white underline underline-offset-2">Open Settings</Link>
        </div>
      )}
      <Tabs />
      {children}
    </div>
  )
}
