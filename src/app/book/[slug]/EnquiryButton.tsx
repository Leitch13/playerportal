'use client'

import { useState } from 'react'

interface Props {
  orgId: string
  academyName: string
  primaryColor?: string
  variant?: 'primary' | 'secondary'
}

/**
 * "Enquire about classes" button + modal.
 *
 * For parents who aren't ready to book a trial yet but want to ask questions.
 * Drops them into the leads pipeline as source='website', status='new'.
 */
export default function EnquiryButton({ orgId, academyName, primaryColor = '#4ecde6', variant = 'secondary' }: Props) {
  const [open, setOpen] = useState(false)
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parentName || (!email && !phone)) {
      setError('Please enter your name and at least an email or phone number.')
      return
    }
    setLoading(true)
    setError('')

    const [firstName, ...lastParts] = parentName.trim().split(/\s+/)

    const res = await fetch('/api/leads/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organisation_id: orgId,
        first_name: firstName,
        last_name: lastParts.join(' ') || null,
        email: email || null,
        phone: phone || null,
        child_name: childName || null,
        child_age: childAge ? parseInt(childAge) : null,
        source: 'website',
        status: 'new',
        notes: message || null,
      }),
    })

    setLoading(false)
    if (!res.ok) {
      setError('Sorry, something went wrong. Please try again or book a trial directly.')
      return
    }
    setSuccess(true)
  }

  function resetAndClose() {
    setOpen(false)
    // reset after a moment so the user sees the fade-out cleanly
    setTimeout(() => {
      setParentName('')
      setEmail('')
      setPhone('')
      setChildName('')
      setChildAge('')
      setMessage('')
      setSuccess(false)
      setError('')
    }, 200)
  }

  const buttonClass = variant === 'primary'
    ? 'inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-[#0a0a0a] transition-all hover:scale-105'
    : 'inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm text-white border-2 border-white/40 bg-white/[0.06] hover:bg-white/10 hover:border-white/60 transition-all'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass}
        style={variant === 'primary' ? { backgroundColor: primaryColor } : undefined}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Enquire about classes
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={resetAndClose}
        >
          <div
            className="w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">👋</div>
                <h2 className="text-xl font-bold text-white mb-2">Thanks {parentName.split(' ')[0]}!</h2>
                <p className="text-sm text-white/60 mb-6">
                  We&apos;ve got your enquiry and <strong className="text-white/80">{academyName}</strong> will be in touch shortly to answer your questions.
                </p>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-white">Enquire about classes</h2>
                    <p className="text-xs text-white/50 mt-1">
                      Not ready to book? Leave your details and {academyName} will get back to you.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="text-white/40 hover:text-white"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/60 mb-1">Your name *</label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/60 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/60 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50"
                        placeholder="07..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_80px] gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/60 mb-1">Child&apos;s name</label>
                      <input
                        type="text"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50"
                        placeholder="e.g. Jack"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/60 mb-1">Age</label>
                      <input
                        type="number"
                        min={3}
                        max={21}
                        value={childAge}
                        onChange={(e) => setChildAge(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50"
                        placeholder="9"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/60 mb-1">Your question or message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50 resize-none"
                      placeholder="e.g. Do you have classes on Saturdays? What age groups?"
                    />
                  </div>

                  {error && (
                    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-full font-semibold text-sm text-[#0a0a0a] transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {loading ? 'Sending…' : 'Send enquiry'}
                  </button>
                  <p className="text-[10px] text-white/30 text-center">
                    We&apos;ll only use your details to reply to your enquiry.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
