import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

/**
 * Success screen shown after Stripe Checkout completes a migration.
 * We don't depend on the webhook having run yet — this is a friendly holding
 * page that surfaces the parent's next step (sign in / set password).
 */
export default async function MigrationSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sub } = await admin
    .from('subscriptions')
    .select(`
      status,
      parent:profiles!subscriptions_parent_id_fkey(email, full_name),
      player:players(first_name),
      org:organisations(name, slug, primary_color)
    `)
    .eq('invite_token', token)
    .maybeSingle()

  const parent = sub?.parent as unknown as { email: string; full_name: string | null } | null
  const player = sub?.player as unknown as { first_name: string } | null
  const org = sub?.org as unknown as { name: string; slug: string; primary_color: string | null } | null

  const primary = org?.primary_color || '#4ecde6'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden">
        <div className="p-6 text-center" style={{ background: `linear-gradient(135deg, ${primary}20 0%, transparent 100%)` }}>
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-1">You&apos;re all set!</h1>
          <p className="text-sm text-white/60">
            {player?.first_name ? `${player.first_name}'s subscription is confirmed.` : 'Subscription confirmed.'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Payment saved</p>
                <p className="text-xs text-white/50 mt-0.5">Your card is set up for monthly renewal.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Place secured</p>
                <p className="text-xs text-white/50 mt-0.5">Same class, same time, same coach.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Dashboard ready</p>
                <p className="text-xs text-white/50 mt-0.5">Track progress, view photos, message coaches — all in one place.</p>
              </div>
            </div>
          </div>

          <div className="pt-3">
            <Link
              href={`/auth/signin?email=${encodeURIComponent(parent?.email || '')}`}
              className="block w-full py-3 rounded-full font-bold text-sm text-center transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: primary, color: '#0a0a0a' }}
            >
              Sign in to your dashboard →
            </Link>
            <p className="text-[11px] text-white/30 text-center mt-3">
              First time signing in? You&apos;ll be asked to set a password.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
