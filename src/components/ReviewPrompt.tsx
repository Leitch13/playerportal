'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ReviewPromptProps {
  promptId: string
  childName: string
  googleReviewUrl: string | null
}

const FACES = [
  { emoji: '\u{1F622}', label: 'Terrible', value: 1 },
  { emoji: '\u{1F615}', label: 'Not great', value: 2 },
  { emoji: '\u{1F610}', label: 'Okay', value: 3 },
  { emoji: '\u{1F60A}', label: 'Good', value: 4 },
  { emoji: '\u{1F929}', label: 'Amazing', value: 5 },
]

export default function ReviewPrompt({ promptId, childName, googleReviewUrl }: ReviewPromptProps) {
  const [step, setStep] = useState<'ask' | 'happy' | 'unhappy' | 'done'>('ask')
  const [rating, setRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [hoveredFace, setHoveredFace] = useState<number | null>(null)

  async function updatePrompt(status: string, extra?: { rating?: number; feedback?: string }) {
    const supabase = createClient()
    await supabase
      .from('review_prompts')
      .update({ status, ...extra })
      .eq('id', promptId)
  }

  async function handleRating(value: number) {
    setRating(value)
    if (value >= 4) {
      await updatePrompt('happy', { rating: value })
      setStep('happy')
    } else if (value <= 2) {
      await updatePrompt('unhappy', { rating: value })
      setStep('unhappy')
    } else {
      await updatePrompt('dismissed', { rating: value })
      setStep('done')
    }
  }

  async function handleFeedback() {
    if (!feedback.trim()) return
    setSubmitting(true)
    await updatePrompt('unhappy', { rating: rating || 2, feedback })
    setStep('done')
    setSubmitting(false)
  }

  async function handleDismiss() {
    await updatePrompt('dismissed')
    setDismissed(true)
  }

  async function handleReviewed() {
    await updatePrompt('reviewed', { rating: rating || 5 })
    setStep('done')
  }

  if (dismissed) return null

  return (
    <div className="relative bg-gradient-to-br from-[#141414] to-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Dismiss X */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Step 1: Rating */}
      {step === 'ask' && (
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto rounded-xl bg-[#4ecde6]/10 flex items-center justify-center">
            <span className="text-xl">{'\u2B50'}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              How&apos;s {childName} enjoying their sessions?
            </h3>
            <p className="text-xs text-white/40 mt-1">Your feedback helps us improve</p>
          </div>
          <div className="flex justify-center gap-3">
            {FACES.map((face) => (
              <button
                key={face.value}
                onClick={() => handleRating(face.value)}
                onMouseEnter={() => setHoveredFace(face.value)}
                onMouseLeave={() => setHoveredFace(null)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 ${
                  hoveredFace === face.value
                    ? 'bg-[#4ecde6]/10 scale-110'
                    : 'hover:bg-white/[0.05]'
                }`}
              >
                <span className="text-2xl">{face.emoji}</span>
                <span className="text-[10px] text-white/30">{face.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2a: Happy path — ask for Google review */}
      {step === 'happy' && (
        <div className="text-center space-y-4 animate-in fade-in duration-300">
          <div className="w-10 h-10 mx-auto rounded-xl bg-green-500/10 flex items-center justify-center">
            <span className="text-xl">{'\u{1F389}'}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Glad to hear it!</h3>
            <p className="text-xs text-white/40 mt-1">
              Would you mind leaving a quick review? It really helps us.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            {googleReviewUrl ? (
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleReviewed}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4ecde6] text-white text-sm font-semibold hover:opacity-90 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Leave a Google Review
              </a>
            ) : (
              <p className="text-xs text-white/40">Thank you for your kind feedback!</p>
            )}
            <button
              onClick={() => setStep('done')}
              className="px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.05] transition-all"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Step 2b: Unhappy path — private feedback */}
      {step === 'unhappy' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/10 flex items-center justify-center">
              <span className="text-xl">{'\u{1F4AC}'}</span>
            </div>
            <h3 className="text-sm font-semibold text-white mt-3">
              We&apos;re sorry to hear that
            </h3>
            <p className="text-xs text-white/40 mt-1">
              Could you tell us more? Your feedback goes directly to the coach.
            </p>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What could we do better?"
            rows={3}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4ecde6]/50 transition-all placeholder:text-white/30 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep('done')}
              className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.05] transition-all"
            >
              Skip
            </button>
            <button
              onClick={handleFeedback}
              disabled={submitting || !feedback.trim()}
              className="px-5 py-2 rounded-xl bg-[#4ecde6] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {submitting ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="text-center space-y-2 animate-in fade-in duration-300 py-2">
          <span className="text-2xl">{'\u{1F64F}'}</span>
          <p className="text-sm font-medium text-white">Thanks for your feedback!</p>
          <p className="text-xs text-white/40">We appreciate you taking the time</p>
        </div>
      )}
    </div>
  )
}
