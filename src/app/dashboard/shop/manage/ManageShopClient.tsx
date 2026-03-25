'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Product {
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

interface Order {
  id: string
  size: string | null
  quantity: number
  total_price: number
  player_name_on_shirt: string | null
  player_number: string | null
  status: string
  notes: string | null
  created_at: string
  merchandise: { name: string; category: string } | null
  profile: { full_name: string } | null
  player: { first_name: string; last_name: string } | null
}

const CATEGORIES = [
  { value: 'kit', label: 'Kit' },
  { value: 'training_top', label: 'Training Top' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'socks', label: 'Socks' },
  { value: 'ball', label: 'Ball' },
  { value: 'bag', label: 'Bag' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'other', label: 'Other' },
]

const SIZE_OPTIONS = ['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL']

const STATUS_FLOW = ['pending', 'paid', 'ordered', 'shipped', 'delivered', 'cancelled'] as const

export default function ManageShopClient({
  products: initialProducts,
  orders: initialOrders,
  orgId,
  totalRevenue,
  pendingCount,
  activeOrderCount,
}: {
  products: Product[]
  orders: Order[]
  orgId: string
  totalRevenue: number
  pendingCount: number
  activeOrderCount: number
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'products' | 'orders'>('products')
  const [statusFilter, setStatusFilter] = useState('all')

  // Product form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('kit')
  const [formPrice, setFormPrice] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formSizes, setFormSizes] = useState<string[]>([])
  const [formInStock, setFormInStock] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setFormName('')
    setFormCategory('kit')
    setFormPrice('')
    setFormDescription('')
    setFormImageUrl('')
    setFormSizes([])
    setFormInStock(true)
    setShowForm(false)
  }

  function editProduct(p: Product) {
    setEditingId(p.id)
    setFormName(p.name)
    setFormCategory(p.category)
    setFormPrice(String(p.price))
    setFormDescription(p.description || '')
    setFormImageUrl(p.image_url || '')
    setFormSizes(p.sizes)
    setFormInStock(p.in_stock)
    setShowForm(true)
  }

  function toggleSize(size: string) {
    setFormSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    )
  }

  async function saveProduct() {
    if (!formName || !formPrice) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      organisation_id: orgId,
      name: formName,
      category: formCategory,
      price: parseFloat(formPrice),
      description: formDescription || null,
      image_url: formImageUrl || null,
      sizes: formSizes,
      in_stock: formInStock,
    }

    if (editingId) {
      await supabase.from('merchandise').update(payload).eq('id', editingId)
    } else {
      await supabase.from('merchandise').insert(payload)
    }

    setSaving(false)
    resetForm()
    router.refresh()
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product? Existing orders will not be affected.')) return
    const supabase = createClient()
    await supabase.from('merchandise').delete().eq('id', id)
    router.refresh()
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    setUpdatingOrder(orderId)
    const supabase = createClient()
    await supabase.from('merchandise_orders').update({ status: newStatus }).eq('id', orderId)
    setUpdatingOrder(null)
    router.refresh()
  }

  const filteredOrders =
    statusFilter === 'all'
      ? initialOrders
      : initialOrders.filter((o) => o.status === statusFilter)

  const statusColors: Record<string, string> = {
    pending: 'text-amber-400 bg-amber-400/10',
    paid: 'text-blue-400 bg-blue-400/10',
    ordered: 'text-purple-400 bg-purple-400/10',
    shipped: 'text-[#4ecde6] bg-[#4ecde6]/10',
    delivered: 'text-emerald-400 bg-emerald-400/10',
    cancelled: 'text-red-400 bg-red-400/10',
  }

  const inputClasses =
    'w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#4ecde6]/50 focus:ring-1 focus:ring-[#4ecde6]/30'

  return (
    <div className="bg-[#0a0a0a] -m-6 lg:-m-8 p-6 lg:p-8 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Shop</h1>
          <p className="text-sm text-white/40 mt-1">Products, orders &amp; revenue</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
          <p className="text-xs text-white/40 font-medium">Total Revenue</p>
          <p className="text-2xl font-bold text-[#4ecde6] mt-1">&pound;{totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
          <p className="text-xs text-white/40 font-medium">Pending Orders</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
          <p className="text-xs text-white/40 font-medium">Active Orders</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{activeOrderCount}</p>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#4ecde6]/40 to-transparent mb-6" />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {(['products', 'orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all capitalize ${
              tab === t
                ? 'bg-[#4ecde6] text-black'
                : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <div>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="mb-4 px-5 py-2.5 rounded-xl bg-[#4ecde6] text-black font-semibold text-sm hover:bg-[#4ecde6]/90 transition-all"
          >
            + Add Product
          </button>

          {/* Add/Edit form */}
          {showForm && (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 mb-6">
              <h3 className="text-base font-semibold text-white mb-4">
                {editingId ? 'Edit Product' : 'New Product'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 font-medium mb-1 block">Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Academy Training Top"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 font-medium mb-1 block">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={inputClasses}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value} className="bg-[#1a1a1a]">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 font-medium mb-1 block">Price (&pound;) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="29.99"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 font-medium mb-1 block">Image URL</label>
                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClasses}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/50 font-medium mb-1 block">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Product description..."
                    rows={2}
                    className={inputClasses}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/50 font-medium mb-2 block">Sizes</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          formSizes.includes(size)
                            ? 'bg-[#4ecde6] text-black'
                            : 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12]'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formInStock}
                      onChange={(e) => setFormInStock(e.target.checked)}
                      className="rounded border-white/20 bg-white/10 text-[#4ecde6] focus:ring-[#4ecde6]/30"
                    />
                    <span className="text-sm text-white/60">In Stock</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={saveProduct}
                  disabled={saving || !formName || !formPrice}
                  className="px-5 py-2 rounded-xl bg-[#4ecde6] text-black font-semibold text-sm hover:bg-[#4ecde6]/90 transition-all disabled:opacity-40"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-5 py-2 rounded-xl bg-white/[0.06] text-white/50 font-medium text-sm hover:bg-white/[0.1]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Product list */}
          {initialProducts.length === 0 ? (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">👕</p>
              <p className="text-white/60 font-medium">No products yet</p>
              <p className="text-sm text-white/30 mt-1">Add your first item to start selling.</p>
            </div>
          ) : (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="divide-y divide-white/[0.06]">
                {initialProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <span className="text-lg opacity-50">👕</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-white/40 capitalize">{p.category.replace('_', ' ')}</span>
                          {p.sizes.length > 0 && (
                            <span className="text-[10px] text-white/30">
                              {p.sizes.join(', ')}
                            </span>
                          )}
                          {!p.in_stock && (
                            <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full font-medium">
                              Out of stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-[#4ecde6]">
                        &pound;{Number(p.price).toFixed(2)}
                      </span>
                      <button
                        onClick={() => editProduct(p)}
                        className="text-xs text-white/40 hover:text-white px-2 py-1 rounded hover:bg-white/[0.06] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded hover:bg-red-400/[0.06] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div>
          {/* Status filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            {['all', ...STATUS_FLOW].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all capitalize ${
                  statusFilter === s
                    ? 'bg-[#4ecde6] text-black'
                    : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-white/60 font-medium">No orders found</p>
            </div>
          ) : (
            <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
              {/* Desktop table header */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_80px_100px_120px] gap-3 px-5 py-3 text-[10px] text-white/30 uppercase tracking-wider font-semibold border-b border-white/[0.06]">
                <span>Product</span>
                <span>Customer</span>
                <span>Player</span>
                <span>Total</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {filteredOrders.map((order) => {
                  const nextStatuses: Record<string, string[]> = {
                    pending: ['paid', 'cancelled'],
                    paid: ['ordered', 'cancelled'],
                    ordered: ['shipped'],
                    shipped: ['delivered'],
                    delivered: [],
                    cancelled: [],
                  }
                  const actions = nextStatuses[order.status] || []

                  return (
                    <div
                      key={order.id}
                      className="md:grid md:grid-cols-[1fr_1fr_1fr_80px_100px_120px] gap-3 px-5 py-3 items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {order.merchandise?.name || 'Item'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {order.size && (
                            <span className="text-xs text-white/40">Size: {order.size}</span>
                          )}
                          {order.player_name_on_shirt && (
                            <span className="text-xs text-white/30">
                              &quot;{order.player_name_on_shirt}&quot;
                              {order.player_number && ` #${order.player_number}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">{order.profile?.full_name || 'Unknown'}</p>
                        <p className="text-[10px] text-white/30">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">
                          {order.player
                            ? `${order.player.first_name} ${order.player.last_name}`
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-[#4ecde6]">
                          &pound;{Number(order.total_price).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                            statusColors[order.status] || 'text-white/40 bg-white/5'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="flex gap-1.5 mt-2 md:mt-0">
                        {actions.map((next) => (
                          <button
                            key={next}
                            onClick={() => updateOrderStatus(order.id, next)}
                            disabled={updatingOrder === order.id}
                            className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-all capitalize ${
                              next === 'cancelled'
                                ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                                : 'text-white/60 bg-white/[0.06] hover:bg-white/[0.1] hover:text-white'
                            } disabled:opacity-40`}
                          >
                            {updatingOrder === order.id ? '...' : next}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
