import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sellsSingleDays, wholeCampSeatsLeft } from '@/lib/flexible-camps'
import { loadCampSeats } from '@/lib/camp-seats'
import { CAMP_WAITLIST_MAX, CAMP_WAITLIST_SOURCE, campMarker, parseWaitlistInput, waitlistNote } from '@/lib/camp-waitlist'

export const dynamic = 'force-dynamic'

/**
 * Public: join the waiting list for a camp that is full.
 *
 * Writes one row to `leads` (see src/lib/camp-waitlist.ts). It takes no payment,
 * holds no place and changes nothing about the camp or its bookings. Only a
 * published, upcoming, genuinely full camp accepts entries, the same person
 * can't be added twice, and each camp's list is capped.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
  const parsed = parseWaitlistInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: camp } = await db.from('camps').select('*').eq('id', v.campId).maybeSingle()
  const today = new Date().toISOString().slice(0, 10)
  if (!camp || !camp.is_published || (camp.end_date && camp.end_date < today)) {
    return NextResponse.json({ error: 'That camp could not be found.' }, { status: 404 })
  }

  // Full, by the same count the booking page and checkout use.
  const cap = camp.max_capacity != null ? Number(camp.max_capacity) : null
  let left: number | null = null
  if (cap) {
    const { count } = await db.from('camp_bookings').select('*', { count: 'exact', head: true })
      .eq('camp_id', v.campId).in('payment_status', ['pending', 'paid'])
    left = cap - (count || 0)
    if (sellsSingleDays(camp)) left = wholeCampSeatsLeft(await loadCampSeats(db, v.campId, cap))
  }
  if (left === null || left > 0) {
    return NextResponse.json({ error: 'Good news: this camp has places. Refresh the page to book.' }, { status: 409 })
  }

  const marker = campMarker(v.campId)
  const { data: onList } = await db.from('leads').select('id, email')
    .eq('organisation_id', camp.organisation_id).eq('source', CAMP_WAITLIST_SOURCE).ilike('notes', `%${marker}%`).limit(CAMP_WAITLIST_MAX + 1)
  const already = (onList || []).find((l) => (l.email || '').toLowerCase() === v.email)
  if (already) return NextResponse.json({ ok: true, already: true })
  if ((onList || []).length >= CAMP_WAITLIST_MAX) {
    return NextResponse.json({ error: 'The waiting list for this camp is full. Please contact the academy directly.' }, { status: 409 })
  }

  const { error } = await db.from('leads').insert({
    organisation_id: camp.organisation_id,
    source: CAMP_WAITLIST_SOURCE,
    status: 'new',
    first_name: v.firstName,
    last_name: v.lastName,
    email: v.email,
    phone: v.phone,
    child_name: v.childName,
    child_age: v.childAge,
    interested_in: String(camp.name || 'Camp').slice(0, 120),
    notes: waitlistNote(String(camp.name || 'camp'), v.campId, camp.start_date),
  })
  if (error) {
    console.error('[camp-waitlist] insert failed', error.message)
    return NextResponse.json({ error: 'We couldn’t add you just now. Please try again in a moment.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
