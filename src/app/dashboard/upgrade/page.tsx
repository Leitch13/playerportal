import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import UpsellCard from '@/components/UpsellCard'

export const metadata = {
  title: 'Upgrade | Player Portal',
}

type ParentStatus = {
  hasAttendedTrial: boolean
  activeEnrolmentCount: number
  hasSubscription: boolean
  childCount: number
  firstChildName: string | null
}

async function getParentStatus(userId: string): Promise<ParentStatus> {
  const supabase = await createClient()

  const [
    { count: trialCount },
    { count: enrolmentCount },
    { count: subscriptionCount },
    { data: players },
  ] = await Promise.all([
    supabase
      .from('trial_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', userId)
      .eq('status', 'attended'),
    supabase
      .from('enrolments')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', userId)
      .eq('status', 'active'),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', userId)
      .eq('status', 'active'),
    supabase
      .from('players')
      .select('first_name')
      .eq('parent_id', userId)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  return {
    hasAttendedTrial: (trialCount || 0) > 0,
    activeEnrolmentCount: enrolmentCount || 0,
    hasSubscription: (subscriptionCount || 0) > 0,
    childCount: (players || []).length,
    firstChildName: players?.[0]?.first_name || null,
  }
}

export default async function UpgradePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'parent') redirect('/dashboard')

  const status = await getParentStatus(user.id)

  // Fetch available subscription plans for the pricing cards
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L8.854 4.854L13 5.764L10 8.646L10.708 13L7 11L3.292 13L4 8.646L1 5.764L5.146 4.854L7 1Z" fill="currentColor" />
          </svg>
          Upgrade Options
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-text">Get More from Player Portal</h1>
        <p className="text-text-light mt-2 text-sm max-w-lg mx-auto">
          Choose the plan that works best for your family. Every upgrade helps your child train consistently and improve faster.
        </p>
      </div>

      {/* Contextual upsell banners based on status */}
      <div className="space-y-3">
        {status.hasAttendedTrial && status.activeEnrolmentCount === 0 && (
          <UpsellCard
            type="trial_to_class"
            childName={status.firstChildName || undefined}
          />
        )}
        {status.activeEnrolmentCount > 0 && !status.hasSubscription && (
          <UpsellCard
            type="single_to_package"
            childName={status.firstChildName || undefined}
          />
        )}
      </div>

      {/* Pricing cards */}
      {(plans || []).length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(plans || []).map((plan: Record<string, unknown>, i: number) => {
              const amount = Number(plan.amount || 0)
              const interval = (plan.interval as string) || 'month'
              const isPopular = i === 1 && (plans || []).length >= 3

              return (
                <div
                  key={plan.id as string}
                  className={`
                    relative bg-white rounded-2xl border p-6 transition-all hover:shadow-lg
                    ${isPopular ? 'border-accent shadow-md ring-1 ring-accent/20' : 'border-border'}
                  `}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Most Popular
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-base font-bold text-text">{plan.name as string}</h3>
                    {plan.description ? (
                      <p className="text-xs text-text-light mt-1">{String(plan.description)}</p>
                    ) : null}

                    <div className="mt-4 mb-5">
                      <span className="text-3xl font-bold text-text">&pound;{amount.toFixed(2)}</span>
                      <span className="text-text-light text-sm">/{interval === 'year' ? 'yr' : 'mo'}</span>
                    </div>

                    {/* Feature list */}
                    <ul className="text-left space-y-2 mb-5">
                      <li className="flex items-center gap-2 text-xs text-text-light">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-success flex-shrink-0">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Weekly training sessions
                      </li>
                      <li className="flex items-center gap-2 text-xs text-text-light">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-success flex-shrink-0">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Progress reviews &amp; reports
                      </li>
                      <li className="flex items-center gap-2 text-xs text-text-light">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-success flex-shrink-0">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Cancel anytime — no lock-in
                      </li>
                    </ul>

                    <Link
                      href={`/dashboard/payments?tab=subscribe&plan=${plan.id as string}`}
                      className={`
                        block w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-all
                        ${isPopular
                          ? 'bg-accent text-white hover:bg-accent-dark'
                          : 'bg-primary text-white hover:bg-primary-light'
                        }
                      `}
                    >
                      Subscribe Now
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Package deals section */}
      {!status.hasSubscription && status.activeEnrolmentCount > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-2xl flex-shrink-0">
              📦
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-emerald-900">Multi-Class Packages</h3>
              <p className="text-sm text-emerald-700 mt-1">
                Buy a bundle of classes upfront and save 15%. Perfect if you prefer to pay in advance.
              </p>
              <Link
                href="/dashboard/payments"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                View packages
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Always show: sibling discount + referral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UpsellCard type="add_second_child" childName={status.firstChildName || undefined} />
        <UpsellCard type="refer_friend" />
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="text-lg font-bold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Can I cancel my subscription at any time?',
              a: 'Yes! There are no lock-in contracts. You can cancel your subscription at any time from your account settings and your access will continue until the end of the current billing period.',
            },
            {
              q: 'What happens if my child misses a session?',
              a: 'Subscription members can request a make-up session within the same month. Package holders retain their unused credits.',
            },
            {
              q: 'How does the sibling discount work?',
              a: 'When you add a second child to any plan, you automatically receive 10% off both subscriptions. The discount applies to all children enrolled after the first.',
            },
            {
              q: 'What does the referral programme offer?',
              a: 'When you refer a friend and they sign up, you both receive a free session credit. There is no limit to how many friends you can refer.',
            },
            {
              q: 'Can I switch plans later?',
              a: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
            },
          ].map((faq, i) => (
            <details key={i} className="group">
              <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium text-text hover:text-accent transition-colors">
                {faq.q}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-text-light group-open:rotate-180 transition-transform flex-shrink-0 ml-2"
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="text-xs text-text-light leading-relaxed pl-0 pb-2">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Back link */}
      <div className="text-center pb-4">
        <Link href="/dashboard" className="text-sm text-text-light hover:text-accent transition-colors">
          &larr; Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
