import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { backupContactProblem, saveBackupContact } from '@/lib/camp-backup-contact'
import { validChildDob } from '@/lib/camp-booking-details'

const ageFromDob = (dob: string): number | null => { const d = new Date(dob + 'T12:00:00Z'), n = new Date(); if (isNaN(d.getTime())) return null; let a = n.getUTCFullYear() - d.getUTCFullYear(); if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--; return a >= 0 && a < 25 ? a : null }

/**
 * A family who has already booked a camp adds their backup contact.
 * See src/lib/camp-backup-contact.ts. Reached from the link the academy sends,
 * which holds the booking's own id and nothing else. Writes one record; it
 * cannot read anything back and cannot change the booking.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { bookingId?: string; name?: string; phone?: string; dob?: string }
  if (!/^[0-9a-f-]{36}$/i.test(body.bookingId || '')) return NextResponse.json({ ok: false, error: 'That link is not right. Please ask your academy for a new one.' }, { status: 400 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: booking } = await sb.from('camp_bookings').select('id, organisation_id, parent_phone, payment_status').eq('id', body.bookingId).maybeSingle()
  if (!booking || booking.payment_status === 'cancelled' || booking.payment_status === 'refunded') return NextResponse.json({ ok: false, error: 'That booking could not be found. Please ask your academy.' }, { status: 404 })
  // The same link also takes a missing date of birth (camp register "Ask for missing details", 18 Oct 2026).
  if (body.dob !== undefined) {
    if (!validChildDob(body.dob)) return NextResponse.json({ ok: false, error: "That date of birth doesn't look right. Please check it." }, { status: 400 })
    const age = ageFromDob(body.dob)
    await sb.from('camp_bookings').update({ child_dob: body.dob, ...(age !== null ? { child_age: age } : {}) }).eq('id', booking.id).is('child_dob', null)
  }
  if (body.name !== undefined || body.phone !== undefined) {
    const problem = backupContactProblem({ name: body.name, phone: body.phone, parentPhone: booking.parent_phone as string | null })
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })
    const saved = await saveBackupContact(sb, { organisationId: booking.organisation_id as string, bookingId: booking.id as string, name: body.name!, phone: body.phone!, source: 'link' })
    if (!saved) return NextResponse.json({ ok: false, error: 'That did not save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
