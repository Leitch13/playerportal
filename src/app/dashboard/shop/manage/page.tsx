import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import ManageShopClient from './ManageShopClient'

export const metadata = { title: 'Manage Shop' }

export default async function ManageShopPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('shop')

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  const { data: org } = await supabase.from('organisations').select('name, primary_color, logo_url').eq('id', orgId).single()
  // Shop header photo, read on its own so this page still opens if it can't be read.
  const { data: hero } = await supabase.from('organisations').select('shop_hero_url').eq('id', orgId).maybeSingle()

  // Fetch products
  const { data: products } = await supabase
    .from('merchandise')
    .select('*')
    .eq('organisation_id', orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  // Fetch all orders with related data
  const { data: orders } = await supabase
    .from('merchandise_orders')
    .select(`
      id, size, quantity, total_price, player_name_on_shirt, player_number, status, notes, created_at,
      merchandise_id,
      merchandise:merchandise(name, category, image_url),
      profile:profiles(full_name),
      player:players(first_name, last_name)
    `)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  // Revenue calculation
  const paidStatuses = ['paid', 'ordered', 'shipped', 'delivered']
  const totalRevenue = (orders || [])
    .filter((o) => paidStatuses.includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_price), 0)

  const pendingCount = (orders || []).filter((o) => o.status === 'pending').length
  const activeOrderCount = (orders || []).filter((o) => ['paid', 'ordered'].includes(o.status)).length
  // Money taken this calendar month (paid or further along), UK time.
  const monthKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }).slice(0, 7)
  const monthRevenue = (orders || [])
    .filter((o) => paidStatuses.includes(o.status) && new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }).slice(0, 7) === monthKey)
    .reduce((sum, o) => sum + Number(o.total_price), 0)

  return (
    <ManageShopClient
      products={products || []}
      orders={(orders || []) as never[]}
      orgId={orgId}
      totalRevenue={totalRevenue}
      pendingCount={pendingCount}
      activeOrderCount={activeOrderCount}
      monthRevenue={monthRevenue}
      academyName={(org?.name as string | null) || 'Your academy'}
      accent={(org?.primary_color as string | null) || '#4ecde6'}
      logoUrl={(org?.logo_url as string | null) || null}
      heroUrl={((hero as { shop_hero_url?: string | null } | null)?.shop_hero_url) || null}
    />
  )
}
