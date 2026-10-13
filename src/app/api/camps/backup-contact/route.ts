import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { backupContactProblem, saveBackupContact } from '@/lib/camp-backup-contact'

/**
 * A family who has already booked a camp adds their backup contact.
 * See src/lib/camp-backup-contact.ts. Reached from the link the academy sends,
 * which holds the booking's own id and nothing else. Writes one record; it
 * cannot read anything back and cannot change the booking.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { bookingId?: string; name?: string; phone?: string }
  if (!/^[0-9a-f-]{36}$/i.test(body.bookingId || '')) return NextResponse.json({ ok: false, error: 'That link is not right. Please ask your academy for a new one.' }, { status: 400 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: booking } = await sb.from('camp_bookings').select('id, organisation_id, parent_phone, payment_status').eq('id', body.bookingId).maybeSingle()
  if (!booking || booking.payment_status === 'cancelled' || booking.payment_status === 'refunded') return NextResponse.json({ ok: false, error: 'That booking could not be found. Please ask your academy.' }, { status: 404 })
  const problem = backupContactProblem({ name: body.name, phone: body.phone, parentPhone: booking.parent_phone as string | null })
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
  const saved = await saveBackupContact(sb, { organisationId: booking.organisation_id as string, bookingId: booking.id as string, name: body.name!, phone: body.phone!, source: 'link' })
  if (!saved) return NextResponse.json({ ok: false, error: 'That did not save. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
