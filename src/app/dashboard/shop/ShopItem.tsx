'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MerchItem {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  image_url: string | null
  sizes: string[]
  in_stock: boolean
}

interface Child {
  id: string
  first_name: string
  last_name: string
}

export default function ShopItem({
  item,
  players,
}: {
  item: MerchItem
  players: Child[]
}) {
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedChild, setSelectedChild] = useState(players[0]?.id || '')
  const [nameOnShirt, setNameOnShirt] = useState('')
  const [playerNumber, setPlayerNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const isPersonalised = item.category === 'kit' || item.category === 'training_top'
  const hasSizes = item.sizes.length > 0

  async function handleOrder() {
    if (hasSizes && !selectedSize) {
      setError('Please select a size')
      return
    }
    if (!selectedChild) {
      setError('Please select a child')
      return
    }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: orgId } = await supabase.rpc('get_my_org')
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !orgId) {
      setError('Authentication error')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('merchandise_orders')
      .insert({
        organisation_id: orgId,
        profile_id: user.id,
        player_id: selectedChild,
        merchandise_id: item.id,
        size: selectedSize || null,
        quantity: 1,
        total_price: item.price,
        player_name_on_shirt: isPersonalised ? nameOnShirt || null : null,
        player_number: isPersonalised ? playerNumber || null : null,
        status: 'pending',
      })

    setLoading(false)
    if (insertError) {
      setError('Failed to place order. Please try again.')
    } else {
      setSuccess(true)
    }
  }

  const categoryGradients: Record<string, string> = {
    kit: 'from-[#4ecde6]/30 to-[#4ecde6]/5',
    training_top: 'from-emerald-500/30 to-emerald-500/5',
    shorts: 'from-blue-500/30 to-blue-500/5',
    socks: 'from-purple-500/30 to-purple-500/5',
    ball: 'from-amber-500/30 to-amber-500/5',
    bag: 'from-rose-500/30 to-rose-500/5',
    bundle: 'from-pink-500/30 to-pink-500/5',
    other: 'from-gray-500/30 to-gray-500/5',
  }

  const categoryIcons: Record<string, string> = {
    kit: '\u{1F455}',
    training_top: '\u{1F3BD}',
    shorts: '\u{1FA73}',
    socks: '\u{1F9E6}',
    ball: '\u26BD',
    bag: '\u{1F392}',
    bundle: '\u{1F381}',
    other: '\u{1F4E6}',
  }

  if (success) {
    return (
      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[320px]">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Order Placed!</p>
        <p className="text-sm text-white/50 mt-1">{item.name}</p>
        {selectedSize && (
          <p className="text-xs text-white/40 mt-0.5">Size: {selectedSize}</p>
        )}
        <p className="text-xs text-white/30 mt-3">Your academy will confirm your order shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
      {/* Image / Placeholder */}
      {item.image_url ? (
        <div className="relative h-48 overflow-hidden">
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {!item.in_stock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white/80 font-semibold text-sm bg-black/40 px-3 py-1 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className={`h-48 bg-gradient-to-br ${categoryGradients[item.category] || categoryGradients.other} flex items-center justify-center relative`}>
          <span className="text-5xl opacity-60">{categoryIcons[item.category] || categoryIcons.other}</span>
          {!item.in_stock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white/80 font-semibold text-sm bg-black/40 px-3 py-1 rounded-full">
                Out of Stock
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-semibold text-white leading-tight">{item.name}</h3>
          <span className="text-lg font-bold text-[#4ecde6] whitespace-nowrap ml-2">
            &pound;{Number(item.price).toFixed(2)}
          </span>
        </div>

        {item.description && (
          <p className="text-xs text-white/40 mb-4 line-clamp-2">{item.description}</p>
        )}

        {/* Size selector */}
        {hasSizes && (
          <div className="mb-4">
            <p className="text-xs text-white/50 mb-2 font-medium">Size</p>
            <div className="flex flex-wrap gap-1.5">
              {item.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedSize === size
                      ? 'bg-[#4ecde6] text-black'
                      : 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Personalisation */}
        {isPersonalised && (
          <div className="mb-4 space-y-2">
            <p className="text-xs text-white/50 font-medium">Personalisation (optional)</p>
            <input
              type="text"
              placeholder="Name on shirt"
              value={nameOnShirt}
              onChange={(e) => setNameOnShirt(e.target.value)}
              maxLength={20}
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50 focus:ring-1 focus:ring-[#4ecde6]/30"
            />
            <input
              type="text"
              placeholder="Number"
              value={playerNumber}
              onChange={(e) => setPlayerNumber(e.target.value)}
              maxLength={3}
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50 focus:ring-1 focus:ring-[#4ecde6]/30"
            />
          </div>
        )}

        {/* Child selector */}
        {players.length > 1 && (
          <div className="mb-4">
            <p className="text-xs text-white/50 mb-2 font-medium">For</p>
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4ecde6]/50 focus:ring-1 focus:ring-[#4ecde6]/30"
            >
              {players.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1a1a1a]">
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        {/* Order button */}
        <div className="mt-auto">
          <button
            onClick={handleOrder}
            disabled={loading || !item.in_stock}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[#4ecde6] text-black hover:bg-[#4ecde6]/90 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Placing Order...
              </span>
            ) : !item.in_stock ? (
              'Out of Stock'
            ) : (
              'Add to Order'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
