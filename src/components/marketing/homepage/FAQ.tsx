const QUESTIONS = [
  {
    q: 'Can I migrate my members from another provider?',
    a: 'Yes. Export your current provider\'s CSV, upload it, and Player Portal matches parents, players, classes and plans automatically. Existing memberships, enrolments and billing information are preserved wherever possible to make switching straightforward.',
  },
  {
    q: 'What happens if my Stripe account isn\'t set up?',
    a: 'We walk you through it during onboarding. If you already have a Stripe account, connect it in one click. If not, sign up with Stripe from inside Player Portal — takes about 10 minutes and Stripe verifies your business.',
  },
  {
    q: 'Do you handle GDPR, DBS checks and consent forms?',
    a: 'GDPR — yes, UK-hosted with a proper data-processing agreement. DBS status — track it per coach with expiry reminders. Consent forms — collect them at signup (medical, photo, terms) with parent signatures stored per player.',
  },
  {
    q: 'How much time does the initial setup take?',
    a: 'Most academies are running within a day. Sign up (2 minutes), connect Stripe (10 minutes), add your classes and plans (30 minutes), import your members (an afternoon for a full migration). Then invite parents and go live.',
  },
  {
    q: 'What if I want to cancel?',
    a: 'Cancel in a click, from your settings. No forms, no calls, no lock-in. Your data is yours — export everything, keep everything. If you leave, we help you leave clean.',
  },
  {
    q: 'Who owns my data?',
    a: 'You do. Every player, parent, payment, message and report. We\'re the platform; the data is yours. Export it any time as CSV. We never share it, never sell it, never train models on it.',
  },
]

export default function FAQ() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-5xl px-6 py-32">
        <div className="max-w-3xl mb-16">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            THE OBVIOUS QUESTIONS
          </p>
          <h2 className="text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            Direct answers.
            <br />
            <span className="text-white/50">No marketing padding.</span>
          </h2>
        </div>

        <div className="space-y-2">
          {QUESTIONS.map((qa, i) => (
            <details
              key={qa.q}
              className="group rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden [&_summary]:list-none open:border-[#4ecde6]/25 transition-colors"
              open={i === 0}
            >
              <summary className="cursor-pointer flex items-center justify-between gap-6 px-6 py-5 hover:bg-white/[0.02] transition-colors">
                <span className="text-lg font-semibold text-white leading-snug">{qa.q}</span>
                <span className="w-8 h-8 shrink-0 rounded-full border border-white/15 flex items-center justify-center group-open:rotate-45 group-open:border-[#4ecde6]/50 group-open:text-[#4ecde6] transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </summary>
              <div className="px-6 pb-6 pt-1 text-base text-white/70 leading-relaxed max-w-3xl">
                {qa.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
