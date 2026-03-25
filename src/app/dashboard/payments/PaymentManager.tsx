'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Parent {
  id: string
  full_name: string
}

interface Player {
  id: string
  first_name: string
  last_name: string
  parent_id: string
}

export default function PaymentManager({
  parents,
  players,
  autoOpen,
  orgId,
}: {
  parents: Parent[]
  players: Player[]
  autoOpen: boolean
  orgId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  const [parentId, setParentId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [amount, setAmount] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('unpaid')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const filteredPlayers = parentId
    ? players.filter((p) => p.parent_id === parentId)
    : players

  // Auto-calculate status from amounts
  function recalcStatus(due: string, paid: string) {
    const d = parseFloat(due) || 0
    const p = parseFloat(paid) || 0
    if (d > 0 && p >= d) return 'paid'
    if (p > 0 && p < d) return 'partial'
    return 'unpaid'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const amtDue = parseFloat(amount)
    const amtPaid = parseFloat(amountPaid) || 0

    const { error } = await supabase.from('payments').insert({
      organisation_id: orgId,
      parent_id: parentId,
      player_id: playerId || null,
      amount: amtDue,
      amount_paid: amtPaid,
      description: description || null,
      due_date: dueDate || null,
      status,
      paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
    })

    if (error) {
      alert(error.message)
    } else {
      setSuccess('Payment added!')
      setParentId('')
      setPlayerId('')
      setAmount('')
      setAmountPaid('')
      setDescription('')
      setDueDate('')
      setStatus('unpaid')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning/90 transition-colors"
      >
        + Add Payment
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Add Payment</h2>
        <button onClick={() => setOpen(false)} className="text-text-light hover:text-text text-sm">Close</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Parent *</label>
          <select
            value={parentId}
            onChange={(e) => {
              setParentId(e.target.value)
              setPlayerId('')
            }}
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select parent...</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Player</label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Optional...</option>
            {filteredPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Spring term fees"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount Due (&pound;) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setStatus(recalcStatus(e.target.value, amountPaid))
            }}
            required
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount Paid (&pound;)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountPaid}
            onChange={(e) => {
              setAmountPaid(e.target.value)
              setStatus(recalcStatus(amount, e.target.value))
            }}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <p className="text-xs text-text-light mt-1">Auto-calculated from amounts, or override manually</p>
        </div>

        {success && <p className="text-sm text-accent font-medium md:col-span-3">{success}</p>}

        <div className="md:col-span-3 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Add Payment'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
