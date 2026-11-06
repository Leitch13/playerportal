import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { decideAcademy, userFromApprovalToken } from '@/lib/academy-approval'

// John's Approve / Don't approve buttons for a new academy (src/lib/academy-approval.ts).
// { token, decision: 'approve' | 'reject' }. The token is signed and only ever emailed to John.
export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (!rateLimit(`academy-approve:${ip}`, 20, 3600000).success) {
    return NextResponse.json({ error: 'Too many tries. Please wait a few minutes.' }, { status: 429 })
  }
  const body = await request.json().catch(() => ({}))
  const userId = userFromApprovalToken(String(body.token || ''))
  if (!userId) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'reject' ? 'reject' : null
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  if (!decision) {
    // Just looking: which academy is this link for?
    const { data: p } = await db.from('profiles').select('full_name, email, organisation_id').eq('id', userId).maybeSingle()
    const { data: o } = p?.organisation_id ? await db.from('organisations').select('name, contact_phone, location').eq('id', p.organisation_id).maybeSingle() : { data: null }
    return NextResponse.json({ academy: o?.name || null, owner: p?.full_name || null, email: p?.email || null, phone: o?.contact_phone || null, location: o?.location || null })
  }
  const done = await decideAcademy(db, userId, decision)
  if (!done.ok) return NextResponse.json({ error: done.error }, { status: 400 })
  return NextResponse.json(done)
}
