import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({ stripe: {} }))
import { allocate, isEmptyBalanceError } from './refund-recovery'

describe('allocate', () => {
  const open = [{ id: 'a', remainingPence: 7720 }, { id: 'b', remainingPence: 3000 }]
  it('takes from the oldest first', () => {
    expect(allocate(open, 5000)).toEqual([{ recoveryId: 'a', amountPence: 5000 }])
  })
  it('spills into the next once the oldest is covered', () => {
    expect(allocate(open, 9000)).toEqual([{ recoveryId: 'a', amountPence: 7720 }, { recoveryId: 'b', amountPence: 1280 }])
  })
  it('never takes more than is owed', () => {
    expect(allocate(open, 50000).reduce((s, x) => s + x.amountPence, 0)).toBe(10720)
  })
  it('takes nothing for nothing', () => {
    expect(allocate(open, 0)).toEqual([])
  })
})

describe('isEmptyBalanceError', () => {
  it('recognises Stripe insufficient-balance errors', () => {
    expect(isEmptyBalanceError({ code: 'balance_insufficient' })).toBe(true)
    expect(isEmptyBalanceError({ raw: { code: 'insufficient_funds' } })).toBe(true)
    expect(isEmptyBalanceError({ message: 'Insufficient funds in Stripe account. In test mode, you can add funds...' })).toBe(true)
    // Exactly what Stripe returned for WLFA's camp refund, 29 Sep 2026 (the fallback missed it).
    expect(isEmptyBalanceError({ message: "The recipient of this transfer does not have sufficient funds in their Stripe balance to reverse this amount. Optionally, you can set 'reverse_transfer' to false to reverse the payment. You can subsequently run '/v1/transfers/:id/reversal' separately later to reverse the transfer amount once the connected account has enough balance." })).toBe(true)
  })
  it('leaves every other failure alone', () => {
    expect(isEmptyBalanceError({ code: 'charge_already_refunded', message: 'Charge ch_1 has already been refunded.' })).toBe(false)
    expect(isEmptyBalanceError(null)).toBe(false)
  })
})

describe('invoiceForRepayment', () => {
  // 2 Nov 2026: the webhook's invoice has no transfer_data, so no academy was ever found.
  it('reads the academy from the invoice in the app\'s API version', async () => {
    const { stripe } = await import('@/lib/stripe') as unknown as { stripe: Record<string, unknown> }
    stripe.invoices = { retrieve: vi.fn(async () => ({ id: 'in_1', status: 'draft', transfer_data: { destination: 'acct_gg' }, application_fee_amount: 133 })) }
    const { invoiceForRepayment } = await import('./refund-recovery')
    const got = await invoiceForRepayment({ id: 'in_1', status: 'draft' } as never)
    expect(got.transfer_data?.destination).toBe('acct_gg')
    expect(got.application_fee_amount).toBe(133)
  })
  it('falls back to the subscription\'s academy', async () => {
    const { stripe } = await import('@/lib/stripe') as unknown as { stripe: Record<string, unknown> }
    stripe.invoices = { retrieve: vi.fn(async () => ({ id: 'in_2', status: 'draft', parent: { subscription_details: { subscription: 'sub_1' } } })) }
    stripe.subscriptions = { retrieve: vi.fn(async () => ({ id: 'sub_1', transfer_data: { destination: 'acct_no1' } })) }
    const { invoiceForRepayment } = await import('./refund-recovery')
    const got = await invoiceForRepayment({ id: 'in_2' } as never)
    expect(got.transfer_data?.destination).toBe('acct_no1')
  })
})
