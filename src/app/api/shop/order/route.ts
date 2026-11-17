import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyOrgAdmins } from '@/lib/notify-admins'

/**
 * Parent places a kit order from the academy shop (one basket, many lines).
 *
 * Body: { lines: [{ merchandiseId, playerId, size?, quantity, nameOnShirt?, number? }] }
 *
 * Before 17 Nov 2026 the shop inserted orders straight from the browser, one
 * item at a time, with the PRICE sent by the browser, and nobody at the
 * academy was told. Now:
 *  - prices come from the merchandise row, never from the browser;
 *  - every item must belong to the parent's academy and be in stock;
 *  - every child must belong to this parent and this academy;
 *  - the academy is told (bell + email) the moment the order lands.
 *
 * No money moves here: orders are 'pending' and the academy collects payment
 * as before.
 */

const MAX_LINES = 20
const MAX_QTY = 10

type Line = {
  merchandiseId?: string
  playerId?: string
  size?: string | null
  quantity?: number
  nameOnShirt?: string | null
  number?: string | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  let body: { lines?: Line[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const lines = Array.isArray(body.lines) ? body.lines : []
  if (lines.length === 0) return NextResponse.json({ error: 'Your basket is empty.' }, { status: 400 })
  if (lines.length > MAX_LINES) return NextResponse.json({ error: `Up to ${MAX_LINES} items per order.` }, { status: 400 })

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await db
    .from('profiles')
    .select('organisation_id, full_name, email')
    .eq('id', user.id)
    .single()
  const orgId = profile?.organisation_id as string | undefined
  if (!orgId) return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })

  const merchIds = [...new Set(lines.map((l) => l.merchandiseId).filter(Boolean))] as string[]
  const playerIds = [...new Set(lines.map((l) => l.playerId).filter(Boolean))] as string[]

  const [{ data: merch }, { data: players }] = await Promise.all([
    db.from('merchandise').select('id, name, price, sizes, in_stock, category').eq('organisation_id', orgId).in('id', merchIds.length ? merchIds : ['00000000-0000-0000-0000-000000000000']),
    db.from('players').select('id, first_name, last_name').eq('parent_id', user.id).eq('organisation_id', orgId).in('id', playerIds.length ? playerIds : ['00000000-0000-0000-0000-000000000000']),
  ])
  const merchById = new Map((merch || []).map((m) => [m.id as string, m]))
  const playerById = new Map((players || []).map((p) => [p.id as string, p]))

  const rows: Record<string, unknown>[] = []
  const summary: string[] = []
  let total = 0
  for (const l of lines) {
    const m = l.merchandiseId ? merchById.get(l.merchandiseId) : undefined
    if (!m) return NextResponse.json({ error: 'One of the items is no longer in the shop. Refresh the page and try again.' }, { status: 400 })
    if (!m.in_stock) return NextResponse.json({ error: `${m.name} is out of stock. Remove it from your basket.` }, { status: 400 })
    const p = l.playerId ? playerById.get(l.playerId) : undefined
    if (!p) return NextResponse.json({ error: 'Choose which child the kit is for.' }, { status: 400 })
    const sizes = (m.sizes as string[] | null) || []
    const size = (l.size || '').trim() || null
    if (sizes.length > 0 && (!size || !sizes.includes(size))) {
      return NextResponse.json({ error: `Choose a size for ${m.name}.` }, { status: 400 })
    }
    const qty = Math.floor(Number(l.quantity) || 1)
    if (qty < 1 || qty > MAX_QTY) return NextResponse.json({ error: `Quantity must be 1 to ${MAX_QTY}.` }, { status: 400 })
    const personal = m.category === 'kit' || m.category === 'training_top'
    const nameOnShirt = personal ? (l.nameOnShirt || '').trim().slice(0, 20) || null : null
    const number = personal ? (l.number || '').trim().slice(0, 3) || null : null
    const lineTotal = Math.round(Number(m.price) * qty * 100) / 100
    total += lineTotal
    rows.push({
      organisation_id: orgId,
      profile_id: user.id,
      player_id: p.id,
      merchandise_id: m.id,
      size,
      quantity: qty,
      total_price: lineTotal,
      player_name_on_shirt: nameOnShirt,
      player_number: number,
      status: 'pending',
    })
    const extras = [size && `size ${size}`, nameOnShirt && `"${nameOnShirt}"`, number && `#${number}`].filter(Boolean).join(', ')
    summary.push(`${qty > 1 ? `${qty} × ` : ''}${m.name}${extras ? ` (${extras})` : ''} for ${p.first_name}: £${lineTotal.toFixed(2)}`)
  }

  const { error } = await db.from('merchandise_orders').insert(rows)
  if (error) {
    console.error('[shop/order] insert failed', error.message)
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 })
  }

  const parentName = (profile?.full_name as string) || (profile?.email as string) || 'A parent'
  const childNames = [...new Set(rows.map((r) => playerById.get(r.player_id as string)?.first_name).filter(Boolean))].join(' and ')
  await notifyOrgAdmins({
    orgId,
    type: 'shop_order',
    title: `New kit order: ${childNames}, £${total.toFixed(2)}`,
    body: `${parentName} ordered: ${summary.join('; ')}. Total £${total.toFixed(2)}, not yet paid. Collect payment and mark it Paid in Shop → Orders.`,
    link: '/dashboard/shop/manage',
    email: true,
  })

  return NextResponse.json({ ok: true, items: rows.length, total })
}
