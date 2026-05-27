'use client'

import { useState } from 'react'

type Audience = 'academy' | 'parent'

interface Feature {
  icon: string
  title: string
  desc: string
  highlight?: boolean // bigger card with a hint of the actual UI
}

/**
 * Audience-toggled features section for the homepage. Two distinct grids:
 *  - "For academies": owner-facing tools (MRR, analytics, automations, branding…)
 *  - "For parents": parent-facing experience (dashboard, progress, photos…)
 *
 * Toggle matches the hero audience selector's "white-pill + brand glow" pattern.
 */
export default function FeaturesByAudience() {
  const [audience, setAudience] = useState<Audience>('academy')

  const academyFeatures: Feature[] = [
    { icon: '📈', title: 'MRR & Revenue Forecasting', desc: 'Live monthly recurring revenue, ARR projections, at-risk subscriptions. Know exactly where your business stands at all times.', highlight: true },
    { icon: '💳', title: 'Stripe Connect Payments', desc: 'Money flows direct to your bank account. We never touch it. Automatic billing, sibling discounts, quarterly options.', highlight: true },
    { icon: '🎯', title: 'Churn Prediction', desc: 'Parent engagement scoring identifies at-risk parents before they cancel. Win-back campaigns fire automatically.', highlight: true },
    { icon: '📊', title: 'Coach Activity Dashboard', desc: 'See which coaches drive attendance, complete reviews, and hold retention. Spot rockstars and underperformers at a glance.' },
    { icon: '🔥', title: 'Class Fill-Rate Heatmap', desc: 'Day × time-slot grid showing where you\'re packed vs empty. Reschedule decisions in seconds, not spreadsheets.' },
    { icon: '📉', title: 'Funnel Analytics', desc: 'Track booking-page visits → signups → subscriptions. Find leaks. Fix conversion. Real data, not gut feel.' },
    { icon: '📅', title: 'Cohort Retention Tables', desc: 'Classic SaaS-style retention triangle. See which months retain best and learn from your top cohorts.' },
    { icon: '⚙️', title: 'Smart Scheduling', desc: 'Per-class capacity caps, waitlists, sessions-per-week enforcement. Parents can\'t over-book; you can\'t over-promise.' },
    { icon: '📝', title: 'Progress Reviews + Custom Scoring', desc: 'Per-class-type scoring (Soccer Tots vs 1-2-1 vs Group). Radar charts, progress-over-time, parent-friendly summaries.' },
    { icon: '🏷️', title: 'Branded Booking Page', desc: 'Your logo, your colours, your terms. Public booking page parents can sign up + pay through. No setup fee.' },
    { icon: '🛡️', title: 'Policies & T&Cs', desc: 'Set cancellation notice period, refund policy, late-payment grace. Parents tick + accept legally tracked on signup.' },
    { icon: '🤖', title: 'Automation Engine', desc: 'Session reminders, post-session digests, payment chase emails, birthday wishes, win-backs — all on autopilot.' },
    { icon: '🎁', title: 'Referral Tracking', desc: 'Unique codes per parent, attribution + rewards. Turn happy parents into your growth engine.' },
    { icon: '📸', title: 'Photo Gallery', desc: 'Coaches upload session photos. Parents see their kid in action. Single biggest retention lift in coaching apps.' },
    { icon: '⚡', title: 'Camps & Events', desc: 'One-off events, holiday camps, ticketed sessions. Sells alongside your recurring subscriptions.' },
    { icon: '🎓', title: 'Coach + Admin Roles', desc: 'Invite your team with role-based access. Coaches see their classes; admins see everything. Audit logs on Enterprise.' },
  ]

  const parentFeatures: Feature[] = [
    { icon: '👀', title: 'Live Schedule', desc: 'See every class your child is in, what\'s next, what\'s today. Beautiful branded view, never out of date.', highlight: true },
    { icon: '🎯', title: 'Skills Radar & Progress', desc: 'Watch your child improve session by session. Skill scores, trend chart, coach feedback in plain English.', highlight: true },
    { icon: '🔥', title: 'Attendance Streaks', desc: 'Gamified streak badges (🔥 → 🚀 → 💎) celebrate consistency. Kids love them. Parents do too.', highlight: true },
    { icon: '🏆', title: 'Achievements & Badges', desc: 'Coaches award badges for special moments. Top Passer, Most Improved, Perfect Week. All visible to you.' },
    { icon: '📸', title: 'Session Photos', desc: 'Coaches share action shots from training. Secure gallery, only families enrolled in that class can see.' },
    { icon: '📚', title: 'Book Classes in Seconds', desc: 'Subscribe to weekly classes, book trials, switch plans. Sibling discounts auto-apply.' },
    { icon: '💸', title: 'One Place for Billing', desc: 'See past payments, manage subscriptions, cancel anytime. No hunting through emails for receipts.' },
    { icon: '🎂', title: 'Birthday Wishes', desc: 'Your child gets a personalised birthday message from the academy. Small touch, huge impact.' },
    { icon: '💬', title: 'Messages from Coach', desc: 'Direct coach-to-parent messaging. Faster than WhatsApp. Stays organised by child.' },
    { icon: '📧', title: 'Weekly Digest', desc: 'Sunday-night email recapping the week\'s sessions, progress notes, and what\'s coming up.' },
    { icon: '📱', title: 'Works Like an App', desc: 'Add Player Portal to your home screen — works offline, opens instantly, notifies you of class reminders.' },
    { icon: '🛡️', title: 'Cancel Anytime', desc: 'Honest cancellation flow. See exactly when your subscription ends. No phone calls, no chasing.' },
  ]

  const features = audience === 'academy' ? academyFeatures : parentFeatures
  const headline = audience === 'academy'
    ? 'Built to grow your business'
    : 'Built to make football effortless'
  const subhead = audience === 'academy'
    ? 'MRR forecasting, churn prediction, automation engine, branded payments. Built for the founders who care about the numbers as much as the coaching.'
    : 'Live schedules, progress tracking, photo galleries, instant messaging. The best parent experience in football coaching.'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Audience toggle */}
      <div className="flex flex-col items-center gap-5 mb-14">
        <div
          className="relative inline-flex items-center p-2 rounded-full bg-white/[0.06] border border-white/15 backdrop-blur-md"
          style={{ boxShadow: '0 0 40px rgba(78, 205, 230, 0.12), 0 10px 30px rgba(0, 0, 0, 0.4)' }}
        >
          {/* Animated sliding background */}
          <div
            className="absolute top-2 bottom-2 rounded-full bg-white transition-all duration-500 ease-out"
            style={{
              width: 'calc((100% - 16px) / 2)',
              transform: `translateX(${audience === 'academy' ? '0%' : '100%'})`,
              left: '8px',
              boxShadow: '0 0 30px rgba(78, 205, 230, 0.5), 0 0 60px rgba(78, 205, 230, 0.25), 0 4px 16px rgba(0, 0, 0, 0.4)',
            }}
          />
          <button
            onClick={() => setAudience('academy')}
            className={`relative z-10 px-6 sm:px-8 py-3 rounded-full text-sm sm:text-base font-bold transition-colors duration-300 ${
              audience === 'academy' ? 'text-black' : 'text-white/70 hover:text-white'
            }`}
          >
            <span className="mr-2">🏟️</span> For Academies
          </button>
          <button
            onClick={() => setAudience('parent')}
            className={`relative z-10 px-6 sm:px-8 py-3 rounded-full text-sm sm:text-base font-bold transition-colors duration-300 ${
              audience === 'parent' ? 'text-black' : 'text-white/70 hover:text-white'
            }`}
          >
            <span className="mr-2">👋</span> For Parents
          </button>
        </div>
      </div>

      {/* Section header */}
      <div className="text-center mb-14">
        <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-xs font-semibold uppercase tracking-wider mb-4">
          Features {audience === 'academy' ? 'for academies' : 'for parents'}
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-5">
          {headline}
        </h2>
        <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          {subhead}
        </p>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {features.map((f, i) => (
          <div
            key={`${audience}-${f.title}`}
            className={`group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-7 hover:bg-white/[0.04] hover:border-[#4ecde6]/20 transition-all duration-300 animate-fade-in ${
              f.highlight ? 'lg:col-span-1' : ''
            }`}
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            {f.highlight && (
              <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#4ecde6]/15 text-[#4ecde6]">
                Most-loved
              </div>
            )}
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center text-2xl mb-5 group-hover:bg-[#4ecde6]/10 group-hover:scale-110 transition-all duration-300">
              {f.icon}
            </div>
            <h3 className="text-base font-bold mb-2 group-hover:text-[#4ecde6] transition-colors">{f.title}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Audience-specific footnote */}
      <p className="text-center text-xs text-white/30 mt-12">
        {audience === 'academy'
          ? 'Switch to "For Parents" above to see what your families experience'
          : 'Switch to "For Academies" above to see what runs the academy you train with'}
      </p>
    </div>
  )
}
