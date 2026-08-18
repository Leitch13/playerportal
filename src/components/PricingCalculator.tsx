'use client'

import { useState } from 'react'

// ONE plan since 2026-08: £35/mo + 3.5% all-in. The calculator shows what an
// academy pays and — more importantly — what they keep.
const MONTHLY = 35
const FEE_PCT = 3.5
const PRESETS = [500, 2000, 5000, 10000, 20000]

export default function PricingCalculator() {
  const [volume, setVolume] = useState(2000)
  const fees = (volume * FEE_PCT) / 100
  const total = MONTHLY + fees
  const keep = volume - fees

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-10">
      <div className="text-center mb-8">
        <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-[11px] font-semibold uppercase tracking-wider mb-3">
          Cost Calculator
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white">
          If you process{' '}
          <span className="gradient-text">&pound;{volume.toLocaleString()}</span>/month in payments
        </h3>
        <p className="text-sm text-white/40 mt-1">
          One plan &mdash; &pound;35/month + 3.5% per transaction, card processing included.
        </p>
      </div>

      <div className="mb-8">
        <input
          type="range"
          min={500}
          max={20000}
          step={500}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#4ecde6] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#4ecde6] [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#4ecde6]/40 [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-white/20"
        />
        <div className="flex justify-between text-xs text-white/30 mt-2">
          <span>&pound;500</span>
          <span>&pound;20,000</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setVolume(preset)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                volume === preset
                  ? 'bg-[#4ecde6] text-[#0a0a0a]'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              &pound;{preset >= 1000 ? `${preset / 1000}k` : preset}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-5 text-center bg-white/[0.02] border border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Subscription</p>
          <p className="text-3xl font-extrabold text-white tabular-nums">&pound;35</p>
          <p className="text-xs text-white/40 mt-1">per month &middot; everything included</p>
        </div>
        <div className="rounded-2xl p-5 text-center bg-white/[0.02] border border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">Fees (3.5%)</p>
          <p className="text-3xl font-extrabold text-white tabular-nums">&pound;{fees.toFixed(0)}</p>
          <p className="text-xs text-white/40 mt-1">all-in &middot; card processing included</p>
        </div>
        <div className="relative rounded-2xl p-5 text-center bg-gradient-to-b from-[#4ecde6]/[0.15] to-[#4ecde6]/[0.05] border-2 border-[#4ecde6]/50 shadow-lg shadow-[#4ecde6]/10">
          <p className="text-[11px] uppercase tracking-wider text-[#4ecde6] font-semibold mb-2">You keep</p>
          <p className="text-3xl font-extrabold text-white tabular-nums">&pound;{keep.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-white/40 mt-1">96.5p of every pound collected</p>
        </div>
      </div>

      <p className="text-center text-sm text-white/50">
        Total platform cost at this volume:{' '}
        <span className="font-bold text-white">&pound;{total.toFixed(0)}/month</span> &mdash; no booking
        fees for parents, no per-player charges, no surprises.
      </p>
    </div>
  )
}
