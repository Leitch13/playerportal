import { NextRequest, NextResponse } from 'next/server'
import { trialPlaceFree, placesDb, CLASS_FULL_TRIAL_MESSAGE } from '@/lib/class-places'

/**
 * Is there a place for a free trial on this class, this day? The free-trial form asks
 * right before it books (it saves from the browser, so the server has to say yes first).
 * Returns only yes/no and counts, never who is booked. See src/lib/class-places.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const { groupId, date } = await request.json()
    if (typeof groupId !== 'string' || !/^[0-9a-f-]{36}$/i.test(groupId)) return NextResponse.json({ error: 'Missing class' }, { status: 400 })
    if (date != null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) return NextResponse.json({ error: 'Bad date' }, { status: 400 })
    const r = await trialPlaceFree(placesDb(), groupId, date)
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: CLASS_FULL_TRIAL_MESSAGE, code: 'class_full' }, { status: 409 })
  } catch {
    // Never block a booking because this check broke; the over-limit alert still catches it.
    return NextResponse.json({ ok: true, unchecked: true })
  }
}
