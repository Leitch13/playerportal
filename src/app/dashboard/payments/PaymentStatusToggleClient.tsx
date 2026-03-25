'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const statuses = ['unpaid', 'partial', 'paid', 'overdue'] as const

const colours: Record<string, string> = {
  paid: 'bg-cyan-50 border-cyan-200 text-cyan-800',
  unpaid: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  partial: 'bg-orange-50 border-orange-200 text-orange-800',
  overdue: 'bg-red-50 border-red-200 text-red-800',
}

export default function PaymentStatusToggleClient({
  paymentId,
  currentStatus,
  amountDue,
  currentAmountPaid,
}: {
  paymentId: string
  currentStatus: string
  amountDue: number
  currentAmountPaid: number
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [amountPaid, setAmountPaid] = useState(currentAmountPaid)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function updateStatus(newStatus: string) {
    const prev = status
    setStatus(newStatus)
    setSaving(true)

    let newAmountPaid = amountPaid
    if (newStatus === 'paid') {
      newAmountPaid = amountDue
      setAmountPaid(amountDue)
    } else if (newStatus === 'unpaid') {
      newAmountPaid = 0
      setAmountPaid(0)
    }

    const supabase = createClient()
    const updateData: Record<string, unknown> = {
      status: newStatus,
      amount_paid: newAmountPaid,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'paid') {
      updateData.paid_date = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase.from('payments').update(updateData).eq('id', paymentId)
    if (error) setStatus(prev)

    setSaving(false)
    router.refresh()
  }

  async function saveAmountPaid() {
    setSaving(true)
    const supabase = createClient()

    // Auto-determine status from amount
    let newStatus = 'partial'
    if (amountPaid >= amountDue) newStatus = 'paid'
    else if (amountPaid <= 0) newStatus = status === 'overdue' ? 'overdue' : 'unpaid'

    setStatus(newStatus)

    const updateData: Record<string, unknown> = {
      amount_paid: amountPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'paid') {
      updateData.paid_date = new Date().toISOString().split('T')[0]
    }

    await supabase.from('payments').update(updateData).eq('id', paymentId)
    setEditing(false)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => updateStatus(e.target.value)}
        disabled={saving}
        className={`text-xs px-2.5 py-1 rounded-lg border font-medium focus:outline-none focus:ring-1 focus:ring-primary/20 ${colours[status] || colours.unpaid} ${saving ? 'opacity-50' : ''}`}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      {/* Quick amount paid editor */}
      {editing ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-light">&pound;</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max={amountDue}
            value={amountPaid}
            onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
            className="w-20 text-xs px-2 py-1 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
            autoFocus
          />
          <button
            onClick={saveAmountPaid}
            disabled={saving}
            className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-1 py-1 text-text-light hover:text-text"
          >
            &times;
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-primary hover:underline"
          title="Edit amount paid"
        >
          Edit &pound;
        </button>
      )}
    </div>
  )
}
