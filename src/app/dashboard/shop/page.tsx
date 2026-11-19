import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import ShopClient, { type ShopProduct, type ShopOrder } from './ShopClient'

export const metadata = { title: 'Academy Shop' }

export default async function ShopPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('shop')

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  // The shop is the parent buying THEIR academy's kit — brand it as the
  // academy, not as Player Portal. Same treatment as the public booking page.
  const [{ data: org }, { data: children }, { data: merchandise }, { data: recentOrders }] = await Promise.all([
    supabase.from('organisations').select('name, logo_url, primary_color').eq('id', orgId).single(),
    supabase.from('players').select('id, first_name, last_name').eq('parent_id', user.id).order('first_name'),
    supabase
      .from('merchandise')
      .select('id, name, description, category, price, image_url, sizes, in_stock')
      .eq('organisation_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('merchandise_orders')
      .select('id, status, total_price, quantity, size, created_at, merchandise:merchandise(name), player:players(first_name)')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  // Shop header photo (19 Nov 2026). Read on its own so the shop still opens if it can't be read.
  const { data: hero } = await supabase.from('organisations').select('shop_hero_url').eq('id', orgId).maybeSingle()
  const heroUrl = ((hero as { shop_hero_url?: string | null } | null)?.shop_hero_url) || null

  const accent = (org?.primary_color as string | null) || '#4ecde6'
  const academyName = (org?.name as string | null) || 'Academy'

  const products = ((merchandise || []) as ShopProduct[]).map((m) => ({ ...m, sizes: m.sizes || [] }))
  const orders: ShopOrder[] = (recentOrders || []).map((o) => ({
    id: o.id as string,
    status: o.status as string,
    total_price: Number(o.total_price),
    quantity: (o.quantity as number | null) ?? 1,
    size: (o.size as string | null) ?? null,
    created_at: o.created_at as string,
    name: (o.merchandise as unknown as { name: string } | null)?.name || 'Item',
    child: (o.player as unknown as { first_name: string } | null)?.first_name || null,
  }))

  return (
    <ShopClient
      academyName={academyName}
      logoUrl={(org?.logo_url as string | null) || null}
      heroUrl={heroUrl}
      accent={accent}
      products={products}
      childList={(children || []).map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name }))}
      orders={orders}
    />
  )
}
