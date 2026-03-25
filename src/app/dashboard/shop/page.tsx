import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShopItem from './ShopItem'
import ShopCategoryFilter from './ShopCategoryFilter'

export const metadata = { title: 'Academy Shop' }

interface MerchRow {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  image_url: string | null
  sizes: string[]
  in_stock: boolean
  sort_order: number
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) redirect('/dashboard')

  // Fetch children for selector
  const { data: children } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)

  // Fetch merchandise
  let query = supabase
    .from('merchandise')
    .select('*')
    .eq('organisation_id', orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const categoryFilter = params.category
  if (categoryFilter && categoryFilter !== 'all') {
    const categoryMap: Record<string, string[]> = {
      kit: ['kit'],
      training: ['training_top'],
      equipment: ['shorts', 'socks', 'ball', 'bag', 'bundle', 'other'],
    }
    const cats = categoryMap[categoryFilter]
    if (cats) {
      query = query.in('category', cats)
    }
  }

  const { data: merchandise } = await query

  const items = (merchandise || []) as MerchRow[]
  const playerList = (children || []).map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
  }))

  // Fetch user's recent orders
  const { data: recentOrders } = await supabase
    .from('merchandise_orders')
    .select('id, status, total_price, created_at, merchandise:merchandise(name), size')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Academy Shop</h1>
          <p className="text-sm text-white/40 mt-1">
            Official kit, training gear &amp; equipment
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <ShopCategoryFilter active={categoryFilter || 'all'} />

      <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-6" />

      {/* Product grid */}
      {items.length === 0 ? (
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">👕</p>
          <p className="text-white/60 font-medium">No items available yet</p>
          <p className="text-sm text-white/30 mt-1">
            Your academy hasn&apos;t added any merchandise. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ShopItem key={item.id} item={item} players={playerList} />
          ))}
        </div>
      )}

      {/* Recent orders */}
      {recentOrders && recentOrders.length > 0 && (
        <>
          <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent my-8" />
          <h2 className="text-lg font-semibold text-white mb-4">Your Recent Orders</h2>
          <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="divide-y divide-white/[0.06]">
              {recentOrders.map((order) => {
                const merchData = order.merchandise as unknown as { name: string } | null
                const statusColors: Record<string, string> = {
                  pending: 'text-amber-400 bg-amber-400/10',
                  paid: 'text-blue-400 bg-blue-400/10',
                  ordered: 'text-purple-400 bg-purple-400/10',
                  shipped: 'text-[#4ecde6] bg-[#4ecde6]/10',
                  delivered: 'text-emerald-400 bg-emerald-400/10',
                  cancelled: 'text-red-400 bg-red-400/10',
                }
                return (
                  <div key={order.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {merchData?.name || 'Item'}
                        {order.size && <span className="text-white/40 ml-1.5">({order.size})</span>}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-[#4ecde6]">
                        &pound;{Number(order.total_price).toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColors[order.status] || 'text-white/40 bg-white/5'}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
