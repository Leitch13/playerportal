import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ManageShopClient from './ManageShopClient'

export const metadata = { title: 'Manage Shop' }

export default async function ManageShopPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') redirect('/dashboard')

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

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
      merchandise:merchandise(name, category),
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

  return (
    <ManageShopClient
      products={products || []}
      orders={(orders || []) as never[]}
      orgId={orgId}
      totalRevenue={totalRevenue}
      pendingCount={pendingCount}
      activeOrderCount={activeOrderCount}
    />
  )
}
