export default function ProblemSection() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            THE PROBLEM
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            You know that feeling on a Sunday night
            <br />
            <span className="text-white/50">when you&apos;re chasing 12 parents for £30?</span>
          </h2>
          <p className="mt-8 text-lg text-white/60 max-w-2xl leading-relaxed">
            Multiply it by 47 parents. Add a lost spreadsheet. Add three WhatsApp groups. Add a coach asking &ldquo;who&apos;s coming to training tomorrow?&rdquo;
          </p>
          <p className="mt-3 text-lg text-white/80 max-w-2xl leading-relaxed font-medium">
            That&apos;s what running an academy on six different tools looks like.
          </p>
        </div>

        {/* Split comparison */}
        <div className="mt-20 grid lg:grid-cols-2 gap-6">
          <BeforeCard />
          <AfterCard />
        </div>
      </div>
    </section>
  )
}

function BeforeCard() {
  const chaos = [
    { icon: '💳', label: 'Stripe', tail: 'who paid?' },
    { icon: '📊', label: 'Google Sheets', tail: 'v14_final.xlsx' },
    { icon: '💬', label: 'WhatsApp — U8s parents', tail: '48 unread' },
    { icon: '📧', label: 'Mailchimp', tail: 'not synced' },
    { icon: '🗓️', label: 'Booking provider', tail: 'bookings' },
    { icon: '📱', label: 'Personal phone', tail: 'chasing at 21:30' },
  ]
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-8">
      <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-4">Before</p>
      <p className="text-lg font-bold text-white mb-6">Six tabs. Zero clarity.</p>
      <div className="space-y-2">
        {chaos.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5">
            <span className="text-lg grayscale opacity-60">{c.icon}</span>
            <span className="text-sm text-white/80 flex-1 font-medium">{c.label}</span>
            <span className="text-xs text-white/40 font-mono">{c.tail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AfterCard() {
  return (
    <div className="rounded-2xl border border-[#4ecde6]/25 bg-gradient-to-br from-[#4ecde6]/[0.03] to-transparent p-8 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #4ecde6 0%, transparent 70%)' }} />
      <div className="relative">
        <p className="text-xs uppercase tracking-widest text-[#4ecde6] font-semibold mb-4">After</p>
        <p className="text-lg font-bold text-white mb-6">One tab. Everything.</p>
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-[#4ecde6]/20 flex items-center justify-center">
              <span className="text-[10px] font-black text-[#4ecde6]">P</span>
            </div>
            <span className="text-sm font-bold text-white">Player Portal</span>
          </div>
          <div className="space-y-2">
            {['Bookings', 'Memberships', 'Payments', 'Attendance', 'Parent Hub', 'Camps'].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#4ecde6]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="text-xs text-white/80 font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-sm text-white/60">
          Same data. Same permissions. Same login. Same place.
        </p>
      </div>
    </div>
  )
}
