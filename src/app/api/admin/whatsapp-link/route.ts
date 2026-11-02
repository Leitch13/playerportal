import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buildWhatsappUrl } from '@/lib/whatsapp'
import { membershipPayUrl } from '@/lib/membership-pay-link'
import { prepareBackMonthsBill } from '@/lib/never-confirmed'
import { refreshFamilyBills, payNowLinkUrl } from '@/lib/one-to-one/money'

export const dynamic = 'force-dynamic'

const firstName = (full: string | null | undefined) => String(full || '').trim().split(/\s+/)[0] || 'there'

/**
 * POST /api/admin/whatsapp-link { kind, id } → { url } — "WhatsApp it" next to every send button
 * (John, 2 Nov 2026: "if an email doesn't work … is there another way?"). Works out the family's own link and the message, and returns a wa.me link
 * for the academy's phone. Sends nothing itself. Admins only, own academy only.
 *   invite / card / owed → id is the child   charge → a 1-2-1 month bill   setup → a 1-2-1 slot   camp → a camp booking
 */
export async function POST(request: NextRequest) {
  const supa = await createServerClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') return NextResponse.json({ error: 'Only academy admins can do this.' }, { status: 403 })
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })
  const body = await request.json().catch(() => ({}))
  const kind = String(body.kind || ''), id = String(body.id || '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Something is missing. Refresh the page and try again.' }, { status: 400 })
  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net').replace(/\/$/, '')
  const { data: org } = await db.from('organisations').select('name').eq('id', orgId).single()
  const academy = (org?.name as string) || 'the academy'
  const parentOf = async (parentId: string | null) => parentId ? (await db.from('profiles').select('full_name, phone').eq('id', parentId).maybeSingle()).data : null
  const fail = (error: string, status = 404) => NextResponse.json({ error }, { status })

  let phone: string | null = null, text = ''
  if (kind === 'invite' || kind === 'card' || kind === 'owed') {
    const { data: player } = await db.from('players').select('first_name, parent_id, organisation_id').eq('id', id).maybeSingle()
    if (!player || player.organisation_id !== orgId) return fail('Player not found.')
    const parent = await parentOf(player.parent_id as string | null)
    phone = (parent?.phone as string | null) ?? null
    const hi = `Hi ${firstName(parent?.full_name as string | null)}, it's ${academy}.`
    if (kind === 'invite') {
      const { data: sub } = await db.from('subscriptions').select('invite_token').eq('player_id', id).eq('organisation_id', orgId).eq('status', 'pending_migration').not('invite_token', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!sub) return fail(`${player.first_name} has no invite waiting.`)
      text = `${hi} Here's ${player.first_name}'s link to set up their place and monthly payment. It takes a minute: ${base}/confirm-subscription/${sub.invite_token}`
    } else if (kind === 'card') {
      const { data: sub } = await db.from('subscriptions').select('id').eq('player_id', id).eq('organisation_id', orgId).in('status', ['past_due', 'unpaid']).not('stripe_subscription_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!sub) return fail(`Nothing has failed on ${player.first_name}'s membership.`)
      text = `${hi} ${player.first_name}'s last payment didn't go through. You can pay here with the same card or a new one, and it's kept for next month: ${membershipPayUrl(sub.id as string)}`
    } else {
      const b = await prepareBackMonthsBill(db, orgId as string, id, base)
      if (!b.ok) return fail(b.error, b.status)
      text = `${hi} ${player.first_name} has been coming but the monthly payment was never set up, so ${b.owed.label} hasn't been paid: £${b.owed.amount.toFixed(2)}. Pay here: ${b.payUrl}${b.setupUrl ? `\nThen set up the monthly payment so it comes off automatically: ${b.setupUrl}` : ''}`
      if (phone) await b.markSent('whatsapp')
    }
  } else if (kind === 'charge') {
    const { data: c } = await db.from('coaching_charges').select('parent_id, billing_month, status').eq('id', id).eq('organisation_id', orgId).maybeSingle()
    if (!c) return fail('That bill is not in your academy.')
    // Today's amount first, so the page the parent opens matches what the academy sees.
    await refreshFamilyBills(db, orgId as string, c.parent_id as string | null)
    const parent = await parentOf(c.parent_id as string | null)
    phone = (parent?.phone as string | null) ?? null
    const month = new Date(c.billing_month + 'T12:00:00Z').toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
    text = `Hi ${firstName(parent?.full_name as string | null)}, it's ${academy}. Here's the link to pay for ${month}'s 1-2-1 sessions. It shows what's due and saves your card for next month: ${payNowLinkUrl(id)}`
  } else if (kind === 'setup') {
    const { data: s } = await db.from('regular_slots').select('parent_id, player:players(first_name)').eq('id', id).eq('organisation_id', orgId).maybeSingle()
    if (!s) return fail('That slot is not in your academy.')
    const parent = await parentOf(s.parent_id as string | null)
    phone = (parent?.phone as string | null) ?? null
    const child = (s.player as unknown as { first_name: string } | null)?.first_name || 'your child'
    text = `Hi ${firstName(parent?.full_name as string | null)}, it's ${academy}. Here's the link to set up ${child}'s 1-2-1 sessions. It shows what's due and saves your card: ${base}/pay/121/${id}`
  } else if (kind === 'camp') {
    const { data: b } = await db.from('camp_bookings').select('organisation_id, parent_name, parent_phone, child_name, payment_status, camp:camps(name)').eq('id', id).maybeSingle()
    if (!b || b.organisation_id !== orgId) return fail('Booking not found.')
    if (b.payment_status === 'paid') return fail('This place is already paid for.', 409)
    phone = (b.parent_phone as string | null) ?? null
    const camp = (b.camp as unknown as { name: string } | null)?.name || 'the camp'
    text = `Hi ${firstName(b.parent_name as string | null)}, it's ${academy}. ${String(b.child_name || 'Your child').trim()}'s place on ${camp} isn't paid yet. Pay here to confirm it: ${base}/pay/camp/${id}`
  } else return fail('Unknown link.', 400)

  const url = buildWhatsappUrl(phone, text)
  if (!url) return fail('There is no mobile number on file for this family. Add one on their parent page.', 400)
  await db.from('audit_log').insert({ organisation_id: orgId, user_id: user.id, action: 'whatsapp.link_opened', entity_type: kind, entity_id: id, details: {} }).then(() => {}, () => {})
  return NextResponse.json({ url })
}
