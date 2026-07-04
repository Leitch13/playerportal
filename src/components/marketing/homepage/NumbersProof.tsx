// Every number here is a real, verifiable figure from the production DB /
// live Stripe. Refresh the copy when the underlying numbers grow enough
// to look stale — see docs/RELEASE_BACKLOG.md for the review cadence.
const STATS = [
  { number: '£5,729', suffix: '', label: 'collected in the last 30 days on Player Portal', detail: 'Live Stripe. Verified. Growing every week.' },
  { number: '134', suffix: '', label: 'members migrated for one academy in one afternoon', detail: 'Zero double-charges. Zero downtime.' },
  { number: '100', suffix: '%', label: 'of subscriptions collected via auto-billing', detail: '78 of 78 active subs — nobody chases anyone.' },
  { number: '£1,311', suffix: '', label: 'real single-day take at a paying academy', detail: 'Live Stripe. Verified. Not a projection.' },
]

export default function NumbersProof() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-3xl mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            THE NUMBERS
          </p>
          <h2 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            Real academies.
            <br />
            <span className="text-white/50">Real numbers.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 hover:border-[#4ecde6]/25 transition-colors">
              <div className="flex items-baseline mb-4">
                <span className="text-5xl lg:text-6xl font-black text-white tabular-nums tracking-tight">{s.number}</span>
                <span className="text-2xl lg:text-3xl font-bold text-[#4ecde6] ml-1">{s.suffix}</span>
              </div>
              <p className="text-sm text-white font-semibold leading-tight">{s.label}</p>
              <p className="mt-3 text-xs text-white/45 leading-relaxed">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
