'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Waiver {
  id: string
  title: string
  content: string
  required: boolean
  version: number
}

interface Player {
  id: string
  first_name: string
  last_name: string
}

interface Signature {
  id: string
  waiver_id: string
  player_id: string
  signed_at: string
}

export default function SignWaiver({
  waivers,
  signatures,
  players,
  userId,
  orgId,
}: {
  waivers: Waiver[]
  signatures: Signature[]
  players: Player[]
  userId: string
  orgId: string
}) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Build a set of signed waiver+player combos
  const signedSet = new Set(
    signatures.map((s) => `${s.waiver_id}:${s.player_id}`)
  )

  function isSignedForPlayer(waiverId: string, playerId: string) {
    return signedSet.has(`${waiverId}:${playerId}`)
  }

  function isFullySigned(waiverId: string) {
    return players.every((p) => isSignedForPlayer(waiverId, p.id))
  }

  // Count unsigned required waivers across all players
  const unsignedRequired = waivers.filter(
    (w) => w.required && !isFullySigned(w.id)
  )

  async function handleSign(waiverId: string) {
    if (!agreed || !selectedPlayerId) return
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.from('waiver_signatures').insert({
      organisation_id: orgId,
      waiver_id: waiverId,
      parent_id: userId,
      player_id: selectedPlayerId,
      signed_at: new Date().toISOString(),
    })

    if (error) {
      alert(error.message)
    } else {
      setAgreed(false)
      setSelectedPlayerId('')
      setExpandedId(null)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {unsignedRequired.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <p className="text-sm font-medium text-warning">
            You have {unsignedRequired.length} required waiver{unsignedRequired.length > 1 ? 's' : ''} that still need signing.
          </p>
        </div>
      )}

      {waivers.map((waiver) => {
        const fullySigned = isFullySigned(waiver.id)
        const isExpanded = expandedId === waiver.id

        return (
          <div key={waiver.id} className="bg-white rounded-xl border border-border">
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{waiver.title}</h3>
                  {waiver.required && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-danger/10 text-danger font-medium">
                      Required
                    </span>
                  )}
                  {fullySigned ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-100 text-cyan-800 font-medium">
                      Signed
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 font-medium">
                      Unsigned
                    </span>
                  )}
                </div>
                {/* Show per-player status */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {players.map((p) => {
                    const signed = isSignedForPlayer(waiver.id, p.id)
                    const sig = signatures.find(
                      (s) => s.waiver_id === waiver.id && s.player_id === p.id
                    )
                    return (
                      <span
                        key={p.id}
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          signed
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-surface-dark text-text-light'
                        }`}
                      >
                        {p.first_name} {p.last_name}
                        {signed && sig
                          ? ` - ${new Date(sig.signed_at).toLocaleDateString()}`
                          : ' - Not signed'}
                      </span>
                    )
                  })}
                </div>
              </div>
              {!fullySigned && (
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : waiver.id)
                    setAgreed(false)
                    setSelectedPlayerId('')
                  }}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition-colors shrink-0"
                >
                  {isExpanded ? 'Close' : 'Read & Sign'}
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-4">
                <div className="bg-surface rounded-lg p-4 max-h-64 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{waiver.content}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Sign for player *</label>
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select a player</option>
                    {players
                      .filter((p) => !isSignedForPlayer(waiver.id, p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </option>
                      ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary/20"
                  />
                  I have read and agree to the terms above
                </label>

                <button
                  onClick={() => handleSign(waiver.id)}
                  disabled={!agreed || !selectedPlayerId || loading}
                  className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Signing...' : 'Sign Waiver'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
