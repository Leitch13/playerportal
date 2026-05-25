'use client'

import { useState, useMemo } from 'react'

const PLANS = [
  { slug: 'starter', name: 'Starter', monthlyPrice: 20, transactionFee: 3.5 },
  { slug: 'pro', name: 'Pro', monthlyPrice: 35, transactionFee: 2.5 },
  { slug: 'enterprise', name: 'Enterprise', monthlyPrice: 60, transactionFee: 2 },
] as const

const PRESETS = [500, 2000, 5000, 10000, 20000]

export default function PricingCalculator() {
  const [volume, setVolume] = useState(2000)

  const breakdown = useMemo(
    () =>
      PLANS.map((plan) => {
        const fees = (volume * plan.transactionFee) / 100
        return {
          slug: plan.slug,
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          transactionFee: plan.transactionFee,
          fees,
          total: plan.monthlyPrice + fees,
        }
      }),
    [volume],
  )

  const cheapest = breakdown.reduce((a, b) => (a.total <= b.total ? a : b))
  const savingsVsStarter = breakdown[0].total - cheapest.total

  return (
    <div className="max-w-4xl mx-auto bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex px-3 py-1 rounded-full bg-[#4ecde6]/10 text-[#4ecde6] text-[11px] font-semibold uppercase tracking-wider mb-3">
            Cost Calculator
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            If you process{' '}
            <span className="gradient-text">&pound;{volume.toLocaleString()}</span>/month in payments
          </h3>
          <p className="text-sm text-white/40 mt-1">
            Drag the slider or pick a preset to see your total monthly cost on each plan.
          </p>
        </div>
      </div>

      {/* Slider + presets */}
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

        {/* Preset chips */}
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

      {/* Breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {breakdown.map((item) => {
          const isCheapest = item.slug === cheapest.slug
          return (
            <div
              key={item.slug}
              className={`relative rounded-2xl p-5 text-center transition-all duration-300 ${
                isCheapest
                  ? 'bg-gradient-to-b from-[#4ecde6]/[0.15] to-[#4ecde6]/[0.05] border-2 border-[#4ecde6]/50 shadow-lg shadow-[#4ecde6]/10'
                  : 'bg-white/[0.02] border border-white/10'
              }`}
            >
              {isCheapest && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#4ecde6] text-[#0a0a0a] text-[10px] font-bold uppercase tracking-wider rounded-full shadow-md">
                  Best value
                </div>
              )}
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCheapest ? 'text-[#4ecde6]' : 'text-white/50'}`}>
                {item.name}
              </p>
              <p className={`text-3xl font-extrabold mb-1 ${isCheapest ? 'gradient-text' : 'text-white'}`}>
                &pound;{item.total.toFixed(0)}
              </p>
              <p className="text-[11px] text-white/30">per month</p>
              <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-white/40 space-y-0.5">
                <div className="flex justify-between">
                  <span>Base</span>
                  <span className="text-white/60">&pound;{item.monthlyPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fees ({item.transactionFee}%)</span>
                  <span className="text-white/60">&pound;{item.fees.toFixed(0)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Winner explainer */}
      {savingsVsStarter > 0 ? (
        <div className="text-center text-sm text-white/60">
          <span className="font-semibold text-[#4ecde6]">{cheapest.name}</span> saves you{' '}
          <span className="font-bold text-white">&pound;{savingsVsStarter.toFixed(0)}/month</span>{' '}
          vs Starter at this volume
          {cheapest.slug !== 'starter' && (
            <> &mdash; <span className="text-white/40">and unlocks more features.</span></>
          )}
        </div>
      ) : (
        <div className="text-center text-sm text-white/60">
          <span className="font-semibold text-[#4ecde6]">Starter</span> is the cheapest at this volume &mdash; upgrade once you grow past &pound;1,500/month to start saving.
        </div>
      )}
    </div>
  )
}
