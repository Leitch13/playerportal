'use client'

export default function EmailSetup({
  academyName,
  contactEmail,
}: {
  academyName?: string
  contactEmail?: string
}) {
  const senderName = academyName?.trim() || 'Your academy'

  const emailsSent = [
    { title: 'Booking confirmations', desc: 'Sent the moment a parent books a class.' },
    { title: 'Welcome emails', desc: 'Sent when a new parent joins your academy.' },
    { title: 'Payment & renewal reminders', desc: 'Keeps subscriptions on track automatically.' },
    { title: 'Trial reminders & follow-ups', desc: 'Nudges trial parents to sign up.' },
    { title: 'Announcements', desc: 'Whenever you send a message to your families.' },
  ]

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#1e1e1e] p-6 space-y-6">
      <div>
        <h2 className="font-bold text-lg">Email</h2>
        <p className="text-sm text-white/40 mt-1">Player Portal sends all your emails for you — nothing to set up.</p>
      </div>

      {/* Active banner */}
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="font-semibold text-sm text-emerald-300">Email is active</p>
        </div>
        <p className="text-xs text-emerald-200/70 mt-1.5 leading-relaxed">
          Emails to your families are sent as <span className="font-semibold text-emerald-200">{senderName}</span>
          {contactEmail
            ? <> and replies go straight to <span className="font-semibold text-emerald-200">{contactEmail}</span>.</>
            : <>. Add a contact email on the General tab so parent replies reach you directly.</>}
        </p>
      </div>

      {/* What gets sent */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-white/70">Sent automatically on your behalf</h3>
        <div className="space-y-2">
          {emailsSent.map((e, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-[#1e1e1e] bg-white/[0.02]">
              <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-white/90">{e.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-white/30 leading-relaxed pt-1">
        Your academy name shows as the sender and parent replies go to your contact email — no Resend account,
        domains or API keys needed. To change the reply-to address, update your contact email on the General tab.
      </p>
    </div>
  )
}
