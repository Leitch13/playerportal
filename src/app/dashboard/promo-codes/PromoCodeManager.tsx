'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PromoCodeManager({
  orgId,
  toggleCodeId,
  toggleCodeActive,
  codeString,
}: {
  orgId: string
  toggleCodeId?: string
  toggleCodeActive?: boolean
  codeString?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [copied, setCopied] = useState(false)

  // Form state
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [appliesTo, setAppliesTo] = useState<'all' | 'subscription' | 'one_off' | 'trial'>('all')

  // If this instance is for the action buttons (toggle + copy)
  if (toggleCodeId) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            setLoading(true)
            const supabase = createClient()
            await supabase
              .from('promo_codes')
              .update({ active: !toggleCodeActive })
              .eq('id', toggleCodeId)
            router.refresh()
            setLoading(false)
          }}
          disabled={loading}
          className={`text-xs px-2 py-1 rounded font-medium ${
            toggleCodeActive
              ? 'bg-red-50 text-danger hover:bg-red-100'
              : 'bg-cyan-50 text-primary hover:bg-cyan-100'
          }`}
        >
          {loading ? '...' : toggleCodeActive ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(codeString || '')
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="text-xs px-2 py-1 rounded font-medium bg-surface-dark text-text-light hover:bg-border"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()

    const value =
      discountType === 'fixed'
        ? Math.round(parseFloat(discountValue) * 100) // store cents
        : parseFloat(discountValue)

    const { error } = await supabase.from('promo_codes').insert({
      organisation_id: orgId,
      code: code.toUpperCase().trim(),
      description: description || null,
      discount_type: discountType,
      discount_value: value,
      max_uses: maxUses ? parseInt(maxUses, 10) : null,
      current_uses: 0,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      applies_to: appliesTo,
      active: true,
    })

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Promo code created!')
      setCode('')
      setDescription('')
      setDiscountType('percentage')
      setDiscountValue('')
      setMaxUses('')
      setValidFrom('')
      setValidUntil('')
      setAppliesTo('all')
      router.refresh()
      setTimeout(() => {
        setSuccess('')
        setOpen(false)
      }, 1500)
    }

    setLoading(false)
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          + Create Promo Code
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">New Promo Code</h2>
            <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">
              Cancel
            </button>
          </div>

          {success && (
            <div className="bg-cyan-50 text-primary px-4 py-2 rounded-lg text-sm mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER25"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Discount Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Discount Value {discountType === 'percentage' ? '(%)' : '($)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step={discountType === 'percentage' ? '1' : '0.01'}
                  max={discountType === 'percentage' ? '100' : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Uses</label>
                <input
                  type="number"
                  min="0"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valid From</label>
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Applies To</label>
                <select
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value as typeof appliesTo)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="subscription">Subscription</option>
                  <option value="one_off">One-off Payment</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Promo Code'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
