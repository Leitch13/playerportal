/**
 * §5 Membership Management — actions, not products.
 *
 * Policy summary + 5-button action grid:
 *   • Add Another Class      → /dashboard/schedule
 *   • Add Sibling             → /dashboard/children
 *   • Upgrade Membership      → /dashboard/upgrade
 *   • Message Academy         → /dashboard/messages
 *   • Cancel Subscription     → /dashboard/payments/cancel  (validated polished flow)
 *
 * Every link points at an existing validated route. No new business logic.
 */
import Link from 'next/link'

export default function MembershipManagement({
  hasActiveSub,
  noticeDays,
  policyText,
  academyName,
}: {
  hasActiveSub: boolean
  noticeDays: number
  policyText: string | null
  academyName: string
}) {
  return (
    <section className="space-y-3" data-testid="membership-management">
      <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Membership management</h2>

      {/* Policy summary — only shown when parent has an active sub */}
      {hasActiveSub && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-1" data-testid="policy-summary">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{academyName}&apos;s cancellation policy</p>
          <p className="text-sm text-white/85">
            {noticeDays > 0 ? (
              <>This academy requires <strong className="text-white">{noticeDays} day{noticeDays === 1 ? '' : 's'}</strong> notice for cancellation.</>
            ) : (
              <>This academy has no minimum notice period — cancellations take effect at the end of your billing month.</>
            )}
          </p>
          {policyText && (
            <p className="text-xs text-white/55 leading-relaxed mt-2 border-t border-white/[0.06] pt-2 whitespace-pre-wrap">{policyText}</p>
          )}
        </div>
      )}

      {/* Action grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <ActionCard
          href="/dashboard/schedule"
          icon="🗓️"
          label="Add Another Class"
          subline="Browse the schedule"
          testId="action-add-class"
        />
        <ActionCard
          href="/dashboard/children"
          icon="👶"
          label="Add Sibling"
          subline="Register another child"
          testId="action-add-sibling"
        />
        <ActionCard
          href="/dashboard/upgrade"
          icon="⬆️"
          label="Upgrade Membership"
          subline="Move to a higher plan"
          testId="action-upgrade"
        />
        <ActionCard
          href="/dashboard/messages"
          icon="💬"
          label="Message Academy"
          subline="Reach your coach directly"
          testId="action-message"
        />
        {hasActiveSub && (
          <ActionCard
            href="/dashboard/payments/cancel"
            icon="✖️"
            label="Cancel Subscription"
            subline="With save-offer + policy"
            testId="action-cancel-sub"
            tone="danger"
          />
        )}
      </div>
    </section>
  )
}

function ActionCard({
  href,
  icon,
  label,
  subline,
  testId,
  tone = 'default',
}: {
  href: string
  icon: string
  label: string
  subline: string
  testId: string
  tone?: 'default' | 'danger'
}) {
  const isDanger = tone === 'danger'
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`block p-4 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] ${
        isDanger
          ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/10'
          : 'bg-white/[0.03] border-white/[0.08] hover:border-[#4ecde6]/30 hover:bg-white/[0.05]'
      }`}
    >
      <div className="text-2xl mb-2" aria-hidden>{icon}</div>
      <p className={`text-sm font-bold mb-0.5 ${isDanger ? 'text-rose-200' : 'text-white'}`}>{label}</p>
      <p className={`text-[11px] ${isDanger ? 'text-rose-300/70' : 'text-white/50'}`}>{subline}</p>
    </Link>
  )
}
