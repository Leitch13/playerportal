import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  // We need to await params but metadata can be async
  return params.then(({ role }) => {
    const titles: Record<string, string> = {
      admin: 'Admin Dashboard Demo',
      parent: 'Parent Dashboard Demo',
      coach: 'Coach Dashboard Demo',
    }
    return {
      title: `${titles[role] || 'Demo'} — Player Portal`,
      description: 'Explore the Player Portal dashboard in demo mode. No signup required.',
    }
  })
}

/* ── Demo Data ── */

const academy = {
  name: 'Elite FC Academy',
  slug: 'elite-fc',
  logo: 'EF',
  location: 'North London',
}

const adminStats = [
  { label: 'Total Players', value: '142', change: '+12 this month', icon: 'players', color: 'text-[#4ecde6]' },
  { label: 'Monthly Revenue', value: '\u00a312,400', change: '+8% vs last month', icon: 'revenue', color: 'text-emerald-400' },
  { label: 'Active Classes', value: '8', change: '2 waitlisted', icon: 'classes', color: 'text-amber-400' },
  { label: 'Retention Rate', value: '94%', change: '+2% this quarter', icon: 'retention', color: 'text-purple-400' },
]

const todaySchedule = [
  { time: '09:00', name: 'Mini Kickers (U6)', coach: 'Coach James', players: 14, capacity: 16, status: 'upcoming' },
  { time: '10:30', name: 'Development Squad (U9)', coach: 'Coach Sarah', players: 18, capacity: 18, status: 'full' },
  { time: '14:00', name: 'Advanced Skills (U12)', coach: 'Coach Marcus', players: 15, capacity: 20, status: 'upcoming' },
  { time: '16:00', name: 'Elite Programme (U15)', coach: 'Coach James', players: 12, capacity: 14, status: 'upcoming' },
  { time: '18:00', name: 'Ladies Session', coach: 'Coach Sarah', players: 16, capacity: 20, status: 'upcoming' },
]

const recentActivity = [
  { type: 'payment', text: 'Oliver Thompson paid \u00a365 for Development Squad (U9)', time: '12 min ago' },
  { type: 'signup', text: 'New player Amara Johnson registered for Mini Kickers', time: '34 min ago' },
  { type: 'review', text: 'Coach James submitted 6 progress reviews for U12', time: '1 hour ago' },
  { type: 'payment', text: 'Recurring payments collected: \u00a31,840 (28 players)', time: '2 hours ago' },
  { type: 'waitlist', text: 'Development Squad (U9) waitlist: 3 parents notified of space', time: '3 hours ago' },
]

const adminQuickActions = [
  { label: 'Add New Class', icon: 'plus' },
  { label: 'Send Announcement', icon: 'announce' },
  { label: 'Export Reports', icon: 'export' },
  { label: 'Manage Coaches', icon: 'coach' },
]

/* Parent data */
const parentChildren = [
  {
    name: 'Oliver Thompson',
    age: 9,
    class: 'Development Squad (U9)',
    nextSession: 'Tomorrow, 10:30 AM',
    attendance: '92%',
    rating: 4.6,
    skills: { pace: 7.2, shooting: 6.8, passing: 8.1, dribbling: 7.5, defending: 5.4, teamwork: 8.8 },
    badges: ['Top Passer', '10 Sessions Streak', 'Most Improved'],
    recentReview: 'Oliver has shown excellent progress in passing and teamwork. His vision on the pitch is developing really well.',
  },
  {
    name: 'Emma Thompson',
    age: 6,
    class: 'Mini Kickers (U6)',
    nextSession: 'Tomorrow, 09:00 AM',
    attendance: '88%',
    rating: 4.3,
    skills: { pace: 6.5, shooting: 5.2, passing: 6.8, dribbling: 7.1, defending: 4.8, teamwork: 8.2 },
    badges: ['Star Player', 'Perfect Week'],
    recentReview: 'Emma is a joy to coach. She brings incredible energy and is starting to show real technical ability with the ball.',
  },
]

const parentQuickActions = [
  { label: 'Book a Session', icon: 'book' },
  { label: 'View Payments', icon: 'payment' },
  { label: 'Message Coach', icon: 'message' },
  { label: 'Refer a Friend', icon: 'refer' },
]

/* Coach data */
const coachClasses = [
  { time: '09:00', name: 'Mini Kickers (U6)', registered: 14, capacity: 16, venue: 'Pitch A', plan: 'Ball mastery and fun games' },
  { time: '14:00', name: 'Advanced Skills (U12)', registered: 15, capacity: 20, venue: 'Pitch B', plan: '1v1 attacking drills and small-sided games' },
  { time: '16:00', name: 'Elite Programme (U15)', registered: 12, capacity: 14, venue: 'Pitch A', plan: 'Tactical shape and pressing patterns' },
  { time: '18:00', name: 'Private 1-on-1', registered: 1, capacity: 1, venue: 'Pitch C', plan: 'Finishing and shot technique' },
]

const pendingReviews = [
  { player: 'Oliver Thompson', class: 'Development Squad (U9)', lastReview: '3 weeks ago', due: 'Overdue' },
  { player: 'Kai Williams', class: 'Elite Programme (U15)', lastReview: '2 weeks ago', due: 'Due this week' },
  { player: 'Amara Johnson', class: 'Mini Kickers (U6)', lastReview: 'Never', due: 'First review' },
  { player: 'Leo Martinez', class: 'Advanced Skills (U12)', lastReview: '4 weeks ago', due: 'Overdue' },
]

const coachQuickActions = [
  { label: 'Start Session', icon: 'start' },
  { label: 'Write Review', icon: 'review' },
  { label: 'Session Plan', icon: 'plan' },
  { label: 'Mark Attendance', icon: 'attendance' },
]

/* ── Helper Components ── */

function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-[#4ecde6]/20 via-[#4ecde6]/10 to-[#4ecde6]/20 border-b border-[#4ecde6]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 bg-[#4ecde6] text-[#0a0a0a] text-[11px] font-bold rounded-full uppercase tracking-wider">
            Demo Mode
          </span>
          <span className="text-sm text-white/60 hidden sm:inline">
            You&apos;re viewing sample data for {academy.name}
          </span>
        </div>
        <Link
          href="/onboard"
          className="px-4 py-1.5 bg-[#4ecde6] text-[#0a0a0a] rounded-full text-xs font-bold hover:bg-[#7dddf0] transition-colors"
        >
          Sign Up Free
        </Link>
      </div>
    </div>
  )
}

function DemoWatermark() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden opacity-[0.03]">
      <div className="text-[200px] font-black text-white tracking-[0.2em] rotate-[-15deg] select-none whitespace-nowrap">
        DEMO
      </div>
    </div>
  )
}

function StatCard({ label, value, change, color }: { label: string; value: string; change: string; color: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition-all">
      <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className={`text-3xl font-extrabold tracking-tight mb-1 ${color}`}>{value}</p>
      <p className="text-xs text-white/30">{change}</p>
    </div>
  )
}

function DemoToastLink({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`cursor-pointer ${className}`}
      title="Sign up to access this feature"
    >
      {children}
    </span>
  )
}

function QuickAction({ label }: { label: string }) {
  return (
    <DemoToastLink>
      <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] hover:border-[#4ecde6]/20 transition-all cursor-pointer">
        <div className="w-9 h-9 rounded-lg bg-[#4ecde6]/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#4ecde6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <span className="text-sm font-medium text-white/60">{label}</span>
      </div>
    </DemoToastLink>
  )
}

function SkillBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/40 w-20 shrink-0">{name}</span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#4ecde6] to-[#2ba8c3]"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="text-xs text-white/50 font-semibold w-8 text-right">{value}</span>
    </div>
  )
}

/* ── Role Dashboards ── */

function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Welcome back, <span className="gradient-text">Admin</span>
        </h1>
        <p className="text-white/40 mt-1">Here&apos;s what&apos;s happening at {academy.name} today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {adminStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5">Today&apos;s Schedule</h2>
          <div className="space-y-3">
            {todaySchedule.map((session) => (
              <div key={session.time + session.name} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">
                <div className="text-center shrink-0 w-14">
                  <div className="text-sm font-bold text-[#4ecde6]">{session.time}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{session.name}</div>
                  <div className="text-xs text-white/30">{session.coach}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">
                    {session.players}/{session.capacity}
                  </div>
                  <div className={`text-[10px] font-medium uppercase tracking-wider ${session.status === 'full' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {session.status === 'full' ? 'Full' : 'Open'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  activity.type === 'payment' ? 'bg-emerald-400' :
                  activity.type === 'signup' ? 'bg-[#4ecde6]' :
                  activity.type === 'review' ? 'bg-purple-400' :
                  'bg-amber-400'
                }`} />
                <div>
                  <p className="text-xs text-white/50 leading-relaxed">{activity.text}</p>
                  <p className="text-[10px] text-white/20 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Revenue Overview</h2>
          <div className="flex gap-2">
            {['6M', '1Y', 'All'].map((range) => (
              <button key={range} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${range === '6M' ? 'bg-[#4ecde6]/10 text-[#4ecde6]' : 'text-white/30 hover:text-white/50'}`}>
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2 h-40">
          {[65, 72, 58, 80, 75, 92, 88, 95, 82, 98, 90, 105].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-[#4ecde6]/30 to-[#4ecde6]/10 hover:from-[#4ecde6]/50 hover:to-[#4ecde6]/20 transition-colors"
                style={{ height: `${(h / 105) * 100}%` }}
              />
              <span className="text-[9px] text-white/20">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]?.slice(0,1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {adminQuickActions.map((action) => (
            <QuickAction key={action.label} label={action.label} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ParentDashboard() {
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-[#4ecde6]/10 to-transparent border border-[#4ecde6]/20 rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
          Welcome back, <span className="gradient-text">Sarah</span>
        </h1>
        <p className="text-white/40">
          Your children are doing great at {academy.name}. Here&apos;s their latest progress.
        </p>
      </div>

      {/* Children Cards */}
      <div className="space-y-6">
        {parentChildren.map((child) => (
          <div key={child.name} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4ecde6]/20 to-[#4ecde6]/5 flex items-center justify-center">
                    <span className="text-lg font-bold text-[#4ecde6]">{child.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{child.name}</h3>
                    <p className="text-xs text-white/30">Age {child.age} &middot; {child.class}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/30 mb-1">Next Session</div>
                  <div className="text-sm font-semibold text-[#4ecde6]">{child.nextSession}</div>
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Skills */}
              <div>
                <h4 className="text-sm font-semibold text-white/60 mb-4">Skills Overview</h4>
                <div className="space-y-3">
                  {Object.entries(child.skills).map(([skill, value]) => (
                    <SkillBar key={skill} name={skill.charAt(0).toUpperCase() + skill.slice(1)} value={value} />
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-xl p-4 text-center">
                    <div className="text-2xl font-extrabold text-[#4ecde6]">{child.attendance}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Attendance</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-4 text-center">
                    <div className="text-2xl font-extrabold text-amber-400">{child.rating}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Coach Rating</div>
                  </div>
                </div>

                {/* Badges */}
                <div>
                  <h4 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Achievements</h4>
                  <div className="flex flex-wrap gap-2">
                    {child.badges.map((badge) => (
                      <span key={badge} className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-[11px] text-amber-400 font-medium">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Latest Review */}
                <div className="bg-white/[0.03] rounded-xl p-4">
                  <h4 className="text-xs text-white/40 uppercase tracking-wider font-medium mb-2">Latest Coach Review</h4>
                  <p className="text-sm text-white/50 leading-relaxed italic">&ldquo;{child.recentReview}&rdquo;</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {parentQuickActions.map((action) => (
            <QuickAction key={action.label} label={action.label} />
          ))}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4">Payment Summary</h2>
        <div className="space-y-3">
          {[
            { desc: 'Development Squad (U9) - Monthly', amount: '\u00a365', date: 'Mar 1, 2026', status: 'Paid' },
            { desc: 'Mini Kickers (U6) - Monthly', amount: '\u00a345', date: 'Mar 1, 2026', status: 'Paid' },
            { desc: 'Development Squad (U9) - Monthly', amount: '\u00a365', date: 'Feb 1, 2026', status: 'Paid' },
          ].map((payment, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div>
                <div className="text-sm font-medium">{payment.desc}</div>
                <div className="text-xs text-white/30">{payment.date}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{payment.amount}</div>
                <div className="text-[10px] text-emerald-400 font-medium uppercase">{payment.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CoachDashboard() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Welcome back, <span className="gradient-text">Coach James</span>
        </h1>
        <p className="text-white/40 mt-1">You have {coachClasses.length} sessions scheduled today.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Sessions" value="4" change="Next: 09:00 AM" color="text-[#4ecde6]" />
        <StatCard label="Players Today" value="42" change="Across all sessions" color="text-emerald-400" />
        <StatCard label="Pending Reviews" value="4" change="2 overdue" color="text-amber-400" />
        <StatCard label="Avg. Rating" value="4.8" change="From 86 parent reviews" color="text-purple-400" />
      </div>

      {/* Today's Classes */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-5">Today&apos;s Classes</h2>
        <div className="space-y-4">
          {coachClasses.map((cls) => (
            <div key={cls.time + cls.name} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="text-center shrink-0 w-14">
                  <div className="text-sm font-bold text-[#4ecde6]">{cls.time}</div>
                  <div className="text-[10px] text-white/20">{cls.venue}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{cls.name}</div>
                  <div className="text-xs text-white/30 mt-0.5">{cls.plan}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-white/50">
                  {cls.registered}/{cls.capacity} players
                </div>
                <DemoToastLink>
                  <div className="px-3 py-1.5 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold hover:bg-[#4ecde6]/20 transition-colors cursor-pointer">
                    Start Session
                  </div>
                </DemoToastLink>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Reviews */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5">Pending Reviews</h2>
          <div className="space-y-3">
            {pendingReviews.map((review) => (
              <div key={review.player} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <div className="font-semibold text-sm">{review.player}</div>
                  <div className="text-xs text-white/30">{review.class} &middot; Last: {review.lastReview}</div>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  review.due === 'Overdue' ? 'bg-red-500/10 text-red-400' :
                  review.due === 'First review' ? 'bg-[#4ecde6]/10 text-[#4ecde6]' :
                  'bg-amber-400/10 text-amber-400'
                }`}>
                  {review.due}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Plan Template */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5">Latest Session Plan</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Advanced Skills (U12)</h3>
                <span className="text-[10px] text-white/30">Created 2 days ago</span>
              </div>
              <div className="space-y-2">
                {[
                  { phase: 'Warm Up', duration: '10 min', detail: 'Dynamic stretches + rondo' },
                  { phase: 'Technical', duration: '15 min', detail: '1v1 attacking moves' },
                  { phase: 'Skill Game', duration: '15 min', detail: '4v4 small-sided games' },
                  { phase: 'Match Play', duration: '15 min', detail: '7v7 with conditions' },
                  { phase: 'Cool Down', duration: '5 min', detail: 'Stretches and review' },
                ].map((phase) => (
                  <div key={phase.phase} className="flex items-center gap-3 text-xs">
                    <span className="text-[#4ecde6] font-semibold w-16 shrink-0">{phase.duration}</span>
                    <span className="text-white/60 font-medium w-20 shrink-0">{phase.phase}</span>
                    <span className="text-white/30">{phase.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {coachQuickActions.map((action) => (
            <QuickAction key={action.label} label={action.label} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Page ── */

const validRoles = ['admin', 'parent', 'coach'] as const

export default async function DemoRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params

  if (!validRoles.includes(role as typeof validRoles[number])) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <DemoWatermark />
      <DemoBanner />

      {/* Sidebar + Content Layout */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-[calc(100vh-44px)] bg-white/[0.01] border-r border-white/[0.06] p-4">
          {/* Academy Logo */}
          <div className="flex items-center gap-3 px-3 py-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4ecde6] to-[#2ba8c3] flex items-center justify-center shadow-lg">
              <span className="text-white font-extrabold text-xs">{academy.logo}</span>
            </div>
            <div>
              <div className="font-bold text-sm">{academy.name}</div>
              <div className="text-[10px] text-white/30">{academy.location}</div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1 flex-1">
            {(role === 'admin' ? [
              { label: 'Dashboard', active: true },
              { label: 'Players', active: false },
              { label: 'Classes', active: false },
              { label: 'Payments', active: false },
              { label: 'Coaches', active: false },
              { label: 'Reviews', active: false },
              { label: 'Reports', active: false },
              { label: 'Settings', active: false },
            ] : role === 'parent' ? [
              { label: 'Dashboard', active: true },
              { label: 'My Children', active: false },
              { label: 'Sessions', active: false },
              { label: 'Payments', active: false },
              { label: 'Progress', active: false },
              { label: 'Gallery', active: false },
              { label: 'Refer a Friend', active: false },
            ] : [
              { label: 'Dashboard', active: true },
              { label: 'My Classes', active: false },
              { label: 'Session Plans', active: false },
              { label: 'Player Reviews', active: false },
              { label: 'Attendance', active: false },
              { label: 'Drill Library', active: false },
            ]).map((item) => (
              <DemoToastLink key={item.label}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  item.active
                    ? 'bg-[#4ecde6]/10 text-[#4ecde6] border border-[#4ecde6]/20'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                }`}>
                  {item.label}
                </div>
              </DemoToastLink>
            ))}
          </nav>

          {/* Role Switcher */}
          <div className="border-t border-white/[0.06] pt-4 mt-4">
            <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium px-3 mb-2">Switch View</p>
            <div className="space-y-1">
              {validRoles.map((r) => (
                <Link
                  key={r}
                  href={`/demo/${r}`}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    r === role
                      ? 'bg-white/[0.05] text-white'
                      : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Mobile role tabs */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/[0.06]">
          <div className="flex">
            {validRoles.map((r) => (
              <Link
                key={r}
                href={`/demo/${r}`}
                className={`flex-1 text-center py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  r === role ? 'text-[#4ecde6] bg-[#4ecde6]/5' : 'text-white/30'
                }`}
              >
                {r}
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-6 sm:p-8 lg:p-10 pb-24 lg:pb-10">
          <div className="max-w-5xl">
            {role === 'admin' && <AdminDashboard />}
            {role === 'parent' && <ParentDashboard />}
            {role === 'coach' && <CoachDashboard />}
          </div>
        </main>
      </div>
    </div>
  )
}
