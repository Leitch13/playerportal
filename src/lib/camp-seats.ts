// Seats on a camp, counted the same way everywhere. A week booking takes a
// seat on every day; a day booking takes a seat on its days. Used by both
// camp checkouts and the public camp page. Counts only, no rows returned.
import type { SupabaseClient } from '@supabase/supabase-js'
import { BOOKING_MODE_WHOLE_CAMP, type DaySeatInput } from './flexible-camps'

export async function loadCampSeats(
  supabase: SupabaseClient,
  campId: string,
  maxCapacity: number | null,
): Promise<DaySeatInput> {
  const [{ count: whole }, { data: days }, { data: dayRows }] = await Promise.all([
    supabase.from('camp_bookings').select('*', { count: 'exact', head: true })
      .eq('camp_id', campId).eq('booking_mode', BOOKING_MODE_WHOLE_CAMP).in('payment_status', ['pending', 'paid']),
    supabase.from('camp_days').select('id').eq('camp_id', campId),
    supabase.from('camp_booking_days').select('camp_day_id, camp_bookings!inner(camp_id, payment_status)')
      .eq('camp_bookings.camp_id', campId).in('camp_bookings.payment_status', ['pending', 'paid']),
  ])
  const dayBookingsByDayId: Record<string, number> = {}
  for (const r of (dayRows ?? []) as { camp_day_id: string }[]) dayBookingsByDayId[r.camp_day_id] = (dayBookingsByDayId[r.camp_day_id] ?? 0) + 1
  return {
    maxCapacity,
    wholeCampBookings: whole ?? 0,
    dayBookingsByDayId,
    dayIds: ((days ?? []) as { id: string }[]).map((d) => d.id),
  }
}
