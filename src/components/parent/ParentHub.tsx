// ============================================================================
// ParentHub — Parent Hub MVP (child-centric parent home), flag-gated by
// PARENT_HUB_ENABLED. Server component. Pure presentation over data the
// ParentDashboard loader already fetches (+ a few read-only adds).
//
// Answers in 10 seconds: how are my kids · what do I pay · what's next ·
// what must I do. Read-only: no writes, no Stripe, no cancellation/sub logic.
// Reuses MembershipOverview (the existing membership card). See
// PARENT_HUB_MVP_PHASE0.md.
//
// Layout: 2-column masonry so the (often tall) membership rail is balanced by
// children + schedule + progress on the left — no dead space.
// ============================================================================

import Link from 'next/link'
import MembershipOverview from '@/app/dashboard/payments/MembershipOverview'
import type { ActionSignal } from '@/lib/parent-hub-metrics'
import { formatGBP } from '@/lib/parent-hub-metrics'

export interface HubChild {
  id: string
  name: string
  ageLabel: string | null
  programme: string | null
  attendancePct: number | null
  score: number | null
  hasNewReport: boolean
  photoUrl: string | null
}
export interface HubSession { name: string; dayName: string | null; time: string | null; location: string | null; childName: string | null }
export interface HubProgress { childName: string; score: number | null; delta: number | null; direction: 'up' | 'flat' | 'down' | null; latestFeedback: string | null }
export interface HubMessage { id: string; subject: string | null; senderName: string | null; when: string; read: boolean }
export interface HubAnnouncement { id: string; title: string | null; body: string | null; when: string }
// Structural shape accepted by MembershipOverview's activeSubs prop.
export type HubSub = React.ComponentProps<typeof MembershipOverview>['activeSubs'][number]

export interface ParentHubProps {
  firstName: string
  orgName: string | null
  orgLogo: string | null
  childCount: number
  monthlySpend: number
  outstanding: number
  nextSession: { label: string; name: string | null; child: string | null } | null
  kids: HubChild[]
  activeSubs: HubSub[]
  schedule: HubSession[]
  progress: HubProgress[]
  messages: HubMessage[]
  announcements: HubAnnouncement[]
  actions: ActionSignal[]
  isNewFamily: boolean
}

// KPI cell — lives inside a single hairline-divided container (the grid
// supplies gap-px dividers). Values are always white.
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="h-full bg-[#0f1a2b] p-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-[#eef2f9]">{value}</p>
      {sub && <p className="text-[11px] text-[#5b6c86]">{sub}</p>}
    </div>
  )
}

const arrow = { up: '↑', down: '↓', flat: '→' } as const
const arrowColor = { up: 'text-[#67c79a]', down: 'text-[#e0736d]', flat: 'text-[#5b6c86]' } as const

export default function ParentHub(props: ParentHubProps) {
  const {
    firstName, orgName, orgLogo, childCount, monthlySpend, outstanding, nextSession,
    kids, activeSubs, schedule, progress, messages, announcements, actions, isNewFamily,
  } = props

  const ScheduleCard = (
    <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Schedule</p>
        <Link href="/dashboard/schedule" className="text-xs font-medium text-[#4ecde6] hover:underline">Full schedule →</Link>
      </div>
      {schedule.length === 0 ? <p className="text-sm text-[#5b6c86]">No upcoming sessions.</p> : (
        <ul className="divide-y divide-[#1d2c42]">
          {schedule.slice(0, 4).map((s, i) => (
            <li key={i} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#eef2f9]">{s.name}</p>
                <p className="text-[11px] text-[#5b6c86]">{[s.dayName, s.time, s.location, s.childName].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#1d2c42] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#93a2ba]"><span aria-hidden className="h-[5px] w-[5px] rounded-full bg-[#67c79a]" />Booked</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const ProgressCard = (
    <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Progress</p>
        <Link href="/dashboard/feedback" className="text-xs font-medium text-[#4ecde6] hover:underline">View reports →</Link>
      </div>
      {progress.length === 0 ? <p className="text-sm text-[#5b6c86]">No reports yet — they&apos;ll appear after the first coach review.</p> : (
        <ul className="space-y-3">
          {progress.map((p, i) => (
            <li key={i} className="text-sm">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{p.childName}</span>
                <span className="font-bold">
                  {p.score != null ? `${p.score}/10` : '—'}
                  {p.direction && <span className={`ml-1 text-xs ${arrowColor[p.direction]}`}>{arrow[p.direction]}{p.delta != null && p.delta !== 0 ? ` ${Math.abs(p.delta)}` : ''}</span>}
                </span>
              </div>
              {p.latestFeedback && <p className="mt-0.5 line-clamp-2 text-xs italic text-[#93a2ba]">“{p.latestFeedback}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const ActionCentreCard = (
    <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
      <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Action Centre</p>
      <ul className="divide-y divide-[#1d2c42]">
        {actions.map((a) => {
          const dot = a.tone === 'bad' ? 'bg-[#e0736d]' : a.tone === 'warn' ? 'bg-[#d8a95a]' : a.tone === 'good' ? 'bg-[#67c79a]' : 'bg-[#5b6c86]'
          const body = (
            <div className="flex items-center gap-3 py-2.5">
              <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#eef2f9]">{a.label}</p>
                <p className="text-[11px] text-[#5b6c86]">{a.detail}</p>
              </div>
            </div>
          )
          return <li key={a.key}>{a.href !== '#' ? <Link href={a.href} className="block">{body}</Link> : body}</li>
        })}
      </ul>
    </section>
  )

  return (
    <div className="min-h-screen -m-6 bg-[#080e18] p-6 text-white lg:-m-8 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── Hero ── */}
        <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#93a2ba]">Welcome back,</p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{firstName}</h1>
            </div>
            {(orgLogo || orgName) && (
              <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-[#1d2c42] bg-[#142236] px-3 py-2">
                {orgLogo
                  ? <img src={orgLogo} alt={orgName || 'Academy'} className="h-9 w-9 rounded-lg object-cover" />
                  : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#142236] border border-[#293b58] text-sm font-bold text-[#93a2ba]">{(orgName || 'A')[0]}</div>}
                {orgName && <span className="hidden text-sm font-semibold text-[#eef2f9] sm:block">{orgName}</span>}
              </div>
            )}
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#1d2c42]">
            <div className="grid grid-cols-2 gap-px bg-[#1d2c42] sm:grid-cols-4">
              <Stat label="Children" value={String(childCount)} />
              <Stat label="Monthly Spend" value={formatGBP(monthlySpend)} sub="/month" />
              <Stat label="Outstanding" value={formatGBP(outstanding)} sub={outstanding > 0 ? 'tap Payments →' : 'all paid'} />
              <div className="h-full bg-[#0f1a2b] p-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Next Session</p>
                {nextSession ? (
                  <>
                    <p className="mt-1 text-base font-bold text-[#eef2f9]">{nextSession.label}</p>
                    {nextSession.name && <p className="truncate text-xs text-[#93a2ba]">{nextSession.name}</p>}
                    {nextSession.child && <p className="truncate text-[11px] text-[#5b6c86]">{nextSession.child}</p>}
                  </>
                ) : <p className="mt-1 text-xl font-bold text-[#eef2f9]">—</p>}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/dashboard/schedule" className="rounded-xl bg-[#4ecde6] px-4 py-2 text-sm font-semibold text-[#04141a] hover:opacity-90">View Schedule</Link>
            <Link href="/dashboard/payments" className="rounded-xl border border-[#293b58] bg-transparent px-4 py-2 text-sm font-medium text-[#93a2ba] hover:border-[#3a4f6e] hover:text-white">Manage Membership</Link>
            <Link href="/dashboard/messages" className="rounded-xl border border-[#293b58] bg-transparent px-4 py-2 text-sm font-medium text-[#93a2ba] hover:border-[#3a4f6e] hover:text-white">Message Academy</Link>
          </div>
        </section>

        {isNewFamily && (
          <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
            <h2 className="text-lg font-bold">Let&apos;s get started</h2>
            <p className="mt-1 text-sm text-[#93a2ba]">Book your child&apos;s first session to begin — you&apos;ll see their progress, schedule and payments here.</p>
            <Link href="/dashboard/schedule" className="mt-3 inline-block rounded-xl bg-[#4ecde6] px-4 py-2 text-sm font-semibold text-[#04141a] hover:opacity-90">Browse classes →</Link>
          </section>
        )}

        {/* ── A2: Action Centre raised above the fold ("what must I do") ── */}
        {ActionCentreCard}

        {/* ── 2-column masonry: left (children · schedule · progress) · right (membership) ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section>
              <h2 className="mb-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">My Children</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {kids.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#142236] border border-[#293b58] text-sm font-bold text-[#93a2ba]">
                        {c.photoUrl ? <img src={c.photoUrl} alt="" className="h-full w-full object-cover" /> : (c.name[0] || '?')}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="truncate text-xs text-[#5b6c86]">{[c.ageLabel, c.programme].filter(Boolean).join(' · ') || 'No active programme'}</p>
                      </div>
                      {c.hasNewReport && <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#1d2c42] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#93a2ba]"><span aria-hidden className="h-[5px] w-[5px] rounded-full bg-[#67c79a]" />New report</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-6 text-sm">
                      <div><span className="text-[#5b6c86] font-mono text-[10px] uppercase tracking-[0.15em]">Attendance</span><p className="font-bold">{c.attendancePct != null ? `${c.attendancePct}%` : '—'}</p></div>
                      <div><span className="text-[#5b6c86] font-mono text-[10px] uppercase tracking-[0.15em]">Coach Score</span><p className="font-bold">{c.score != null ? `${c.score}/10` : '—'}</p></div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/dashboard/players/${c.id}/report`} className="flex-1 rounded-xl border border-[#293b58] bg-transparent py-1.5 text-center text-xs font-medium text-[#93a2ba] hover:border-[#3a4f6e] hover:text-white">View Progress</Link>
                      <Link href="/dashboard/schedule" className="flex-1 rounded-xl border border-[#293b58] bg-transparent py-1.5 text-center text-xs font-medium text-[#93a2ba] hover:border-[#3a4f6e] hover:text-white">View Schedule</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {ScheduleCard}
            {ProgressCard}
          </div>

          <div className="space-y-6 lg:col-span-1">
            {/* Reused membership card (Protected #8 testid preserved) */}
            <MembershipOverview activeSubs={activeSubs} outstanding={outstanding} />
          </div>
        </div>

        {/* ── Messages · Announcements (full width) ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Messages</p>
              <Link href="/dashboard/messages" className="text-xs font-medium text-[#4ecde6] hover:underline">View all →</Link>
            </div>
            {messages.length === 0 ? <p className="text-sm text-[#5b6c86]">No messages.</p> : (
              <ul className="divide-y divide-[#1d2c42]">
                {messages.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-medium">{m.subject || '(no subject)'}</span>
                      {!m.read && <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-[#4ecde6]" />}
                    </div>
                    <p className="text-xs text-[#5b6c86]">{[m.senderName, m.when].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Academy Announcements</p>
              <Link href="/dashboard/announcements" className="text-xs font-medium text-[#4ecde6] hover:underline">View all →</Link>
            </div>
            {announcements.length === 0 ? <p className="text-sm text-[#5b6c86]">No announcements.</p> : (
              <ul className="space-y-2">
                {announcements.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="font-medium">{a.title || 'Announcement'}</p>
                    {a.body && <p className="line-clamp-1 text-xs text-[#5b6c86]">{a.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Quick Actions ── */}
        <section className="rounded-2xl border border-[#1d2c42] bg-[#0f1a2b] p-5">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#5b6c86]">Quick Actions</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { label: 'Add Child', href: '/dashboard/children' },
              { label: 'Book Session', href: '/dashboard/schedule' },
              { label: 'Refer a Friend', href: '/dashboard/referrals' },
              { label: 'Contact', href: '/dashboard/messages' },
              { label: 'Gallery', href: '/dashboard/gallery' },
              { label: 'Shop', href: '/dashboard/shop' },
            ].map((q) => (
              <Link key={q.label} href={q.href} className="rounded-xl border border-[#293b58] bg-transparent px-2 py-3 text-center text-xs font-medium text-[#93a2ba] hover:border-[#3a4f6e] hover:text-white">{q.label}</Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
