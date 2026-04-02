'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Payment = {
  id: string
  description: string | null
  amount: number
  amount_paid: number
  status: string
  due_date: string | null
  paid_date: string | null
  created_at: string
  player_name: string | null
}

type Props = {
  payments: Payment[]
  parentName: string
  parentEmail: string
  orgName: string
  orgLogoUrl: string | null
  orgEmail: string | null
  orgPhone: string | null
  orgAddress: string | null
}

export default function StatementClient({
  payments,
  parentName,
  parentEmail,
  orgName,
  orgLogoUrl,
  orgEmail,
  orgPhone,
  orgAddress,
}: Props) {
  // Default date range: last 12 months
  const today = new Date()
  const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 12, 1)
  const [startDate, setStartDate] = useState(twelveMonthsAgo.toISOString().substring(0, 10))
  const [endDate, setEndDate] = useState(today.toISOString().substring(0, 10))

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const date = p.due_date || p.created_at
      if (!date) return true
      const d = date.substring(0, 10)
      return d >= startDate && d <= endDate
    })
  }, [payments, startDate, endDate])

  const totalDue = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalPaid = filteredPayments.reduce((sum, p) => sum + p.amount_paid, 0)
  const outstanding = totalDue - totalPaid
  const paidCount = filteredPayments.filter((p) => p.status === 'paid').length
  const overdueCount = filteredPayments.filter((p) => p.status === 'overdue').length

  // Find next payment due (unpaid with future or present due date)
  const nextPayment = payments
    .filter((p) => p.status !== 'paid' && p.due_date)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    [0]

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '\u2014'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateRange = () => {
    const start = new Date(startDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const end = new Date(endDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return `${start} \u2014 ${end}`
  }

  return (
    <div className="statement-page max-w-4xl mx-auto bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen print:bg-white print:m-0 print:p-0 print:min-h-0">
      {/* Action buttons - hidden when printing */}
      <div className="mb-8 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-lg text-sm font-bold hover:bg-[#3dbcd5] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print / Save as PDF
          </button>
          <Link
            href="/dashboard/payments"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Payments
          </Link>
        </div>

        {/* Date range filter */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-white/60 font-medium">Date Range:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
          />
          <span className="text-white/40">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#4ecde6]/50 transition-colors"
          />
        </div>
      </div>

      {/* Statement document */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 print:shadow-none print:border-0 print:rounded-none">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {orgLogoUrl && (
                <img
                  src={orgLogoUrl}
                  alt={orgName}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">{orgName}</h2>
                {orgAddress && (
                  <div className="text-xs text-gray-500 mt-0.5">{orgAddress}</div>
                )}
                {(orgEmail || orgPhone) && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {orgEmail}
                    {orgEmail && orgPhone && ' | '}
                    {orgPhone}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-wide text-gray-900">
                STATEMENT
              </h1>
              <div className="mt-1 text-sm text-gray-500">
                {formatDateRange()}
              </div>
            </div>
          </div>
        </div>

        {/* Account details */}
        <div className="px-8 py-6 grid grid-cols-2 gap-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Account Holder
            </div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold text-gray-900">{parentName}</div>
              <div className="text-gray-500">{parentEmail}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Statement Date
            </div>
            <div className="text-sm font-medium text-gray-900">
              {new Date().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Summary boxes */}
        <div className="px-8 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-gray-900">&pound;{totalPaid.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Total Paid</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className={`text-lg font-bold ${outstanding > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                &pound;{outstanding.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Outstanding</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-gray-900">{paidCount}</div>
              <div className="text-xs text-gray-500 mt-0.5">Payments Made</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className={`text-lg font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {overdueCount}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Overdue</div>
            </div>
          </div>
        </div>

        {/* Next payment due */}
        {nextPayment && (
          <div className="px-8 pb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
              <span className="font-semibold text-blue-800">Next Payment Due:</span>{' '}
              <span className="text-blue-700">
                &pound;{(nextPayment.amount - nextPayment.amount_paid).toFixed(2)} for{' '}
                {nextPayment.description || 'Coaching Fee'} on{' '}
                {formatDate(nextPayment.due_date)}
              </span>
            </div>
          </div>
        )}

        {/* Payments table */}
        <div className="px-8 pb-6">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No payments found for the selected date range.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 font-semibold text-gray-700">Description</th>
                  <th className="text-left py-3 font-semibold text-gray-700 hidden sm:table-cell">Player</th>
                  <th className="text-right py-3 font-semibold text-gray-700">Due</th>
                  <th className="text-right py-3 font-semibold text-gray-700">Paid</th>
                  <th className="text-right py-3 font-semibold text-gray-700">Balance</th>
                  <th className="text-center py-3 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p, i) => {
                  const balance = p.amount - p.amount_paid
                  const runningBalance = filteredPayments
                    .slice(0, i + 1)
                    .reduce((sum, pp) => sum + (pp.amount - pp.amount_paid), 0)

                  return (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-3 text-gray-600">
                        {formatDate(p.due_date || p.created_at)}
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-gray-900">{p.description || 'Coaching Fee'}</div>
                        {p.player_name && (
                          <div className="text-xs text-gray-400 sm:hidden">{p.player_name}</div>
                        )}
                      </td>
                      <td className="py-3 text-gray-600 hidden sm:table-cell">
                        {p.player_name || '\u2014'}
                      </td>
                      <td className="py-3 text-right text-gray-900">&pound;{p.amount.toFixed(2)}</td>
                      <td className="py-3 text-right text-gray-900">&pound;{p.amount_paid.toFixed(2)}</td>
                      <td className={`py-3 text-right font-medium ${balance > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                        &pound;{balance.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            p.status === 'paid'
                              ? 'bg-green-50 text-green-700'
                              : p.status === 'overdue'
                                ? 'bg-red-50 text-red-700'
                                : p.status === 'partial'
                                  ? 'bg-yellow-50 text-yellow-700'
                                  : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {p.status === 'paid' ? 'Paid' : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-900">
                  <td colSpan={3} className="py-3 font-bold text-gray-900">
                    Totals
                  </td>
                  <td className="py-3 text-right font-bold text-gray-900">
                    &pound;{totalDue.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-bold text-gray-900">
                    &pound;{totalPaid.toFixed(2)}
                  </td>
                  <td className={`py-3 text-right font-bold ${outstanding > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                    &pound;{outstanding.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 rounded-b-xl print:bg-transparent">
          <p className="text-sm text-center text-gray-600 mb-2">
            Thank you for choosing {orgName}.
          </p>
          <p className="text-xs text-center text-gray-400">
            Statement generated on{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            &middot; Player Portal
          </p>
        </div>
      </div>
    </div>
  )
}
