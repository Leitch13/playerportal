import { redirect } from 'next/navigation'

// Promo codes now live on Discounts (27 Oct 2026), with the sibling, quarterly and per-child discounts.
export default function PromoCodesPage() {
  redirect('/dashboard/discounts')
}
