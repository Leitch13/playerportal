'use client'

// Manage Shop, rebuilt 19 Nov 2026 (John: "make it look unreal").
// Live parent-card preview while editing, a big photo tile, one-tap starter products,
// size groups, a product gallery and an orders board. Same tables and columns as before.

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProductImage } from '../ShopArt'

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
  merchandise_id: string | null
  size: string | null
  quantity: number
  total_price: number
  player_name_on_shirt: string | null
  player_number: string | null
  status: string
  notes: string | null
  created_at: string
  merchandise: { name: string; category: string; image_url: string | null } | null
  profile: { full_name: string } | null
  player: { first_name: string; last_name: string } | null
}

const CATEGORIES = [
  { value: 'kit', label: 'Match kit' },
  { value: 'training_top', label: 'Training top' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'socks', label: 'Socks' },
  { value: 'ball', label: 'Ball' },
  { value: 'bag', label: 'Bag' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'other', label: 'Other' },
]

// Size groups. Kids' ages first (how most academies sell kit).
const KIDS = ['3–4', '5–6', '7–8', '9–10', '11–12', '13']
const SIZE_GROUPS: { key: string; label: string; sizes: string[] }[] = [
  { key: 'kids', label: 'Kids (age)', sizes: KIDS },
  { key: 'youth', label: 'Youth', sizes: ['YS', 'YM', 'YL'] },
  { key: 'adult', label: 'Adult', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { key: 'gloves', label: 'Glove sizes', sizes: ['4', '5', '6', '7', '8', '9', '10'] },
]
const KNOWN_SIZES = SIZE_GROUPS.flatMap((g) => g.sizes)

// One tap fills the form; the academy checks it and presses Add.
const STARTERS: { name: string; category: string; price: number; sizes: string[]; description: string }[] = [
  { name: 'Training top', category: 'training_top', price: 25, sizes: [...KIDS, 'S', 'M', 'L', 'XL'], description: 'Academy training top with badge.' },
  { name: 'Match kit', category: 'kit', price: 35, sizes: [...KIDS, 'S', 'M', 'L', 'XL'], description: 'Shirt and shorts. Add a name and number.' },
  { name: 'Shorts', category: 'shorts', price: 15, sizes: [...KIDS, 'S', 'M', 'L'], description: 'Academy training shorts.' },
  { name: 'Socks', category: 'socks', price: 8, sizes: ['YS', 'YM', 'YL', 'S', 'M', 'L'], description: 'Academy socks.' },
  { name: 'Goalkeeper gloves', category: 'other', price: 20, sizes: ['4', '5', '6', '7', '8', '9', '10'], description: 'Match goalkeeper gloves.' },
  { name: 'Kit bundle', category: 'bundle', price: 55, sizes: [...KIDS, 'S', 'M', 'L', 'XL'], description: 'Training top, shorts and socks together.' },
]

// The board: one column per step. Database values stay the same.
const BOARD: { status: string; label: string; next?: string; nextLabel?: string; tone: string }[] = [
  { status: 'pending', label: 'New', next: 'paid', nextLabel: 'Mark paid', tone: '#f5b942' },
  { status: 'paid', label: 'Paid', next: 'ordered', nextLabel: 'Ordered from supplier', tone: '#4f8cff' },
  { status: 'ordered', label: 'Ordered from supplier', next: 'shipped', nextLabel: 'Ready to collect', tone: '#a77bff' },
  { status: 'shipped', label: 'Ready to collect', next: 'delivered', nextLabel: 'Collected', tone: '#4ecde6' },
  { status: 'delivered', label: 'Collected', tone: '#34d399' },
]
const PREV: Record<string, string> = { paid: 'pending', ordered: 'paid', shipped: 'ordered', delivered: 'shipped' }

const money = (n: number) => `£${n.toFixed(2).replace(/\.00$/, '')}`
const isPersonal = (c: string) => c === 'kit' || c === 'training_top'
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** Big square photo tile: tap to upload from phone or laptop; Change / Remove once set. */
function PhotoTile({ folder, value, onChange, wide = false }: { folder: string; value: string; onChange: (url: string) => void; wide?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) return setError('Choose a photo (JPG, PNG or WebP).')
    if (file.size > 10 * 1024 * 1024) return setError('That photo is over 10MB. Try a smaller one.')
    setBusy(true); setError('')
    const supabase = createClient()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error: err } = await supabase.storage.from('coaching').upload(path, file, { cacheControl: '3600', upsert: false })
    setBusy(false)
    if (err || !data) return setError('Upload failed. Please try again.')
    onChange(supabase.storage.from('coaching').getPublicUrl(data.path).data.publicUrl)
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Upload a photo of this product"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f) }}
        className={`relative ${wide ? 'aspect-[16/7]' : 'aspect-square'} w-full overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${drag ? 'border-[#4ecde6] bg-[#4ecde6]/10' : value ? 'border-transparent' : 'border-white/15 bg-white/[0.03] hover:border-white/30'}`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Product photo" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
              <button type="button" onClick={() => input.current?.click()} className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black">Change</button>
              <button type="button" onClick={() => onChange('')} className="rounded-lg bg-black/60 px-3 py-2 text-xs font-bold text-white">Remove</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4ecde6]/15 text-[#4ecde6]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </span>
            <span className="text-sm font-bold text-white">{busy ? 'Uploading…' : 'Tap to add a photo'}</span>
            <span className="text-xs text-white/45">{wide ? 'A wide team or kit photo works best · or drag one here' : 'Upload a photo of this product · or drag one here'}</span>
          </button>
        )}
        {busy && value && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold">Uploading…</div>}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}

/** The parent shop card, exactly as parents see it. */
function ParentCard({ p, accent }: { p: { name: string; category: string; image_url: string | null; price: number; in_stock: boolean }; accent: string }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[#1b2a40] bg-[#0d1726] text-left shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
      <div className="relative overflow-hidden">
        <ProductImage product={p} accent={accent} />
        {isPersonal(p.category) && p.in_stock && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#070c15]">Add name + no.</span>
        )}
        {!p.in_stock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white/80">Out of stock</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 items-end justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white sm:text-base">{p.name || 'Product name'}</p>
          <p className="mt-0.5 text-sm font-extrabold" style={{ color: accent }}>{money(Number(p.price) || 0)}</p>
        </div>
        {p.in_stock && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold leading-none text-[#070c15]">+</span>}
      </div>
    </div>
  )
}

export default function ManageShopClient({
  products: initialProducts,
  orders: initialOrders,
  orgId,
  totalRevenue,
  pendingCount,
  monthRevenue,
  academyName,
  accent,
  logoUrl,
  heroUrl: initialHero,
}: {
  products: Product[]
  orders: Order[]
  orgId: string
  totalRevenue: number
  pendingCount: number
  activeOrderCount: number
  monthRevenue: number
  academyName: string
  accent: string
  logoUrl: string | null
  heroUrl: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'products' | 'orders'>('products')
  const [showCancelled, setShowCancelled] = useState(false)

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
  const [formError, setFormError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const formTop = useRef<HTMLDivElement>(null)
  const [heroUrl, setHeroUrl] = useState(initialHero || '')
  const [heroMsg, setHeroMsg] = useState('')

  async function saveHero(url: string) {
    setHeroUrl(url); setHeroMsg('')
    const { error } = await createClient().from('organisations').update({ shop_hero_url: url || null }).eq('id', orgId)
    setHeroMsg(error ? 'Could not save the header photo. Please try again.' : url ? 'Saved. Parents see it now.' : 'Removed.')
    if (!error) router.refresh()
  }

  const live = initialOrders.filter((o) => o.status !== 'cancelled')
  const orderedCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of live) if (o.merchandise_id) m.set(o.merchandise_id, (m.get(o.merchandise_id) || 0) + (o.quantity || 1))
    return m
  }, [live])
  const bestSeller = useMemo(() => {
    let best: Product | null = null; let n = 0
    for (const p of initialProducts) { const c = orderedCount.get(p.id) || 0; if (c > n) { n = c; best = p } }
    return best ? { product: best as Product, count: n } : null
  }, [initialProducts, orderedCount])

  function openForm(fill?: Partial<Product>, id: string | null = null) {
    setEditingId(id)
    setFormName(fill?.name || '')
    setFormCategory(fill?.category || 'kit')
    setFormPrice(fill?.price != null ? String(fill.price) : '')
    setFormDescription(fill?.description || '')
    setFormImageUrl(fill?.image_url || '')
    setFormSizes(fill?.sizes || [])
    setFormInStock(fill?.in_stock ?? true)
    setFormError('')
    setShowForm(true)
    setTab('products')
    setTimeout(() => formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const closeForm = () => { setShowForm(false); setEditingId(null) }

  const toggleSize = (size: string) => setFormSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]))
  function toggleGroup(sizes: string[]) {
    const all = sizes.every((s) => formSizes.includes(s))
    setFormSizes((prev) => (all ? prev.filter((s) => !sizes.includes(s)) : [...prev, ...sizes.filter((s) => !prev.includes(s))]))
  }

  async function saveProduct() {
    if (!formName.trim()) return setFormError('Give the product a name.')
    const price = parseFloat(formPrice)
    if (!(price >= 0)) return setFormError('Add a price.')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      organisation_id: orgId,
      name: formName.trim(),
      category: formCategory,
      price,
      description: formDescription.trim() || null,
      image_url: formImageUrl || null,
      sizes: formSizes,
      in_stock: formInStock,
    }
    const { error } = editingId
      ? await supabase.from('merchandise').update(payload).eq('id', editingId)
      : await supabase.from('merchandise').insert(payload)
    setSaving(false)
    if (error) return setFormError('Could not save. Please try again.')
    closeForm()
    router.refresh()
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product? Existing orders will not be affected.')) return
    const supabase = createClient()
    await supabase.from('merchandise').delete().eq('id', id)
    if (editingId === id) closeForm()
    router.refresh()
  }

  async function setStock(p: Product, inStock: boolean) {
    setBusyId(p.id)
    await createClient().from('merchandise').update({ in_stock: inStock }).eq('id', p.id)
    setBusyId(null)
    router.refresh()
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    if (newStatus === 'cancelled' && !confirm('Cancel this order?')) return
    setBusyId(orderId)
    await createClient().from('merchandise_orders').update({ status: newStatus }).eq('id', orderId)
    setBusyId(null)
    router.refresh()
  }

  const preview = { name: formName, category: formCategory, image_url: formImageUrl || null, price: parseFloat(formPrice) || 0, in_stock: formInStock }
  const otherSizes = formSizes.filter((s) => !KNOWN_SIZES.includes(s))
  const input = 'w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#4ecde6]/60 focus:outline-none focus:ring-1 focus:ring-[#4ecde6]/30'
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/45'

  const starters = (compact = false) => (
    <div className={`grid gap-2.5 ${compact ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
      {STARTERS.map((s) => (
        <button key={s.name} type="button" onClick={() => openForm({ ...s, in_stock: true })}
          className="group flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#0d1726] p-2.5 text-center transition-all hover:-translate-y-0.5 hover:border-[#4ecde6]/40">
          <div className="w-full overflow-hidden rounded-xl"><ProductImage product={{ name: s.name, category: s.category, image_url: null }} accent={accent} size="thumb" /></div>
          <span className="text-xs font-bold leading-tight text-white">{s.name}</span>
          {!compact && <span className="text-[11px] text-white/45">{money(s.price)}</span>}
        </button>
      ))}
    </div>
  )

  return (
    <div className="-m-6 min-h-screen bg-[#080e18] p-4 text-white sm:p-6 lg:-m-8 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>{academyName}</p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Kit shop</h1>
          <p className="mt-1 text-sm text-white/45">Add kit, see orders come in, and move each one through to collected.</p>
        </div>
        <div className="flex gap-2">
          <a href="/dashboard/shop" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/[0.06]">See it as a parent</a>
          <button onClick={() => openForm()} className="rounded-xl bg-[#4ecde6] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#4ecde6]/90">+ Add product</button>
        </div>
      </div>

      {/* Numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#4ecde6]/[0.12] to-transparent p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Taken this month</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-white sm:text-3xl">{money(monthRevenue)}</p>
          <p className="mt-1 text-xs text-white/40">{money(totalRevenue)} since the shop opened</p>
        </div>
        <button onClick={() => setTab('orders')} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left hover:border-amber-400/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Orders waiting</p>
          <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${pendingCount ? 'text-amber-300' : 'text-white'}`}>{pendingCount}</p>
          <p className="mt-1 text-xs text-white/40">{pendingCount ? 'New orders to collect payment for →' : 'Nothing waiting'}</p>
        </button>
        <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:col-span-1">
          {bestSeller ? (
            <>
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"><ProductImage product={bestSeller.product} accent={accent} size="thumb" /></div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Best seller</p>
                <p className="truncate text-base font-bold text-white">{bestSeller.product.name}</p>
                <p className="text-xs text-white/40">{bestSeller.count} ordered</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Best seller</p>
              <p className="mt-1 text-sm text-white/50">Shows here once orders come in.</p>
            </div>
          )}
        </div>
      </div>

      {/* Shop header photo */}
      <div className="mb-6 grid gap-4 rounded-3xl border border-white/[0.08] bg-[#0b1422] p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-sm font-black">Shop header photo</p>
          <p className="mb-3 mt-0.5 text-xs text-white/45">The big picture at the top of your parents&apos; shop. A team photo or your kit laid out works best.</p>
          <PhotoTile folder="shop-hero" value={heroUrl} onChange={saveHero} wide />
          {heroMsg && <p className={`mt-2 text-xs ${heroMsg.startsWith('Could') ? 'text-red-300' : 'text-emerald-300'}`}>{heroMsg}</p>}
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">What parents see</p>
          <div className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1726] p-4 ${heroUrl ? 'flex min-h-[170px] items-end' : ''}`}>
            {heroUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070c15] via-[#070c15]/70 to-[#070c15]/10" />
              </>
            ) : (
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40" style={{ background: `radial-gradient(closest-side, ${accent}, transparent)` }} />
            )}
            <div className="relative flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-white/15 bg-white object-contain p-0.5" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-black" style={{ background: accent }}>{academyName.charAt(0)}</div>
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.2em]" style={{ color: accent }}>Official kit shop</p>
                <p className="truncate text-lg font-black leading-tight">{academyName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
        {(['products', 'orders'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${tab === t ? 'bg-[#4ecde6] text-black' : 'text-white/55 hover:text-white'}`}>
            {t === 'products' ? `Products · ${initialProducts.length}` : `Orders · ${live.length}`}
          </button>
        ))}
      </div>

      {/* ───────── PRODUCTS ───────── */}
      {tab === 'products' && (
        <div>
          {showForm && (
            <div ref={formTop} className="mb-8 scroll-mt-6 rounded-3xl border border-white/[0.08] bg-[#0b1422] p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-black">{editingId ? 'Edit product' : 'New product'}</h2>
                <button onClick={closeForm} className="text-sm text-white/50 hover:text-white">Close</button>
              </div>
              {!editingId && (
                <div className="mb-6">
                  <p className={label}>Start from</p>
                  {starters(true)}
                </div>
              )}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
                    <div className="max-w-[200px] sm:max-w-none">
                      <p className={label}>Photo</p>
                      <PhotoTile folder="shop-products" value={formImageUrl} onChange={setFormImageUrl} />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className={label} htmlFor="shop-name">Name</label>
                        <input id="shop-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Academy training top" className={input} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={label} htmlFor="shop-price">Price (£)</label>
                          <input id="shop-price" type="number" inputMode="decimal" min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="25" className={input} />
                        </div>
                        <div>
                          <label className={label} htmlFor="shop-cat">Type</label>
                          <select id="shop-cat" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={input}>
                            {CATEGORIES.map((c) => <option key={c.value} value={c.value} className="bg-[#0b1422]">{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={label} htmlFor="shop-desc">Description</label>
                        <textarea id="shop-desc" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} placeholder="What's included, material, fit…" className={`${input} resize-none`} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className={label}>Sizes parents can pick</p>
                    <div className="space-y-2.5">
                      {SIZE_GROUPS.map((g) => {
                        const all = g.sizes.every((s) => formSizes.includes(s))
                        return (
                          <div key={g.key} className="flex flex-wrap items-center gap-1.5">
                            <button type="button" onClick={() => toggleGroup(g.sizes)}
                              className={`mr-1 w-28 rounded-lg px-2.5 py-1.5 text-left text-xs font-bold ${all ? 'bg-[#4ecde6]/20 text-[#4ecde6]' : 'bg-white/[0.04] text-white/60 hover:text-white'}`}>
                              {g.label} {all ? '✓' : '· all'}
                            </button>
                            {g.sizes.map((s) => (
                              <button key={s} type="button" onClick={() => toggleSize(s)}
                                className={`min-w-[2.6rem] rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${formSizes.includes(s) ? 'border-[#4ecde6] bg-[#4ecde6]/15 text-white' : 'border-white/10 text-white/50 hover:border-white/30'}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                      {otherSizes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mr-1 w-28 px-2.5 text-xs font-bold text-white/40">Also on this product</span>
                          {otherSizes.map((s) => (
                            <button key={s} type="button" onClick={() => toggleSize(s)} className="min-w-[2.6rem] rounded-lg border border-[#4ecde6] bg-[#4ecde6]/15 px-2.5 py-1.5 text-xs font-bold">{s} ✕</button>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-white/35">No sizes ticked = one size (balls, bags).</p>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3">
                    <button type="button" role="switch" aria-checked={formInStock} onClick={() => setFormInStock(!formInStock)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${formInStock ? 'bg-emerald-400' : 'bg-white/15'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${formInStock ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm font-semibold">{formInStock ? 'In stock: parents can order' : 'Out of stock: shown but can’t be ordered'}</span>
                  </label>

                  {formError && <p className="text-sm text-red-300">{formError}</p>}
                  <div className="flex gap-2">
                    <button onClick={saveProduct} disabled={saving} className="rounded-xl bg-[#4ecde6] px-6 py-3 text-sm font-black text-black disabled:opacity-50">
                      {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to shop'}
                    </button>
                    <button onClick={closeForm} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">Cancel</button>
                    {editingId && <button onClick={() => deleteProduct(editingId)} className="ml-auto rounded-xl px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/10">Delete</button>}
                  </div>
                </div>

                {/* Live preview */}
                <div className="lg:sticky lg:top-6 lg:self-start">
                  <p className={label}>What parents see</p>
                  <div className="rounded-3xl p-4" style={{ background: `radial-gradient(circle at 50% 0%, ${accent}22, transparent 70%)` }}>
                    <div className="mx-auto max-w-[240px]"><ParentCard p={preview} accent={accent} /></div>
                    {formSizes.length > 0 && (
                      <div className="mx-auto mt-3 flex max-w-[240px] flex-wrap justify-center gap-1">
                        {formSizes.slice(0, 10).map((s) => <span key={s} className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/60">{s}</span>)}
                        {formSizes.length > 10 && <span className="px-1 text-[10px] text-white/40">+{formSizes.length - 10}</span>}
                      </div>
                    )}
                    <p className="mt-3 text-center text-[11px] text-white/40">Updates as you type</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {initialProducts.length === 0 && !showForm ? (
            <div className="rounded-3xl border border-white/[0.08] bg-[#0b1422] p-6 sm:p-8">
              <h2 className="text-xl font-black">Stock your shop in a minute</h2>
              <p className="mt-1 mb-6 text-sm text-white/50">Tap a product to start. The name, type, price and sizes fill in for you. Change anything, add your photo, then add it to the shop.</p>
              {starters()}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {initialProducts.map((p) => {
                const n = orderedCount.get(p.id) || 0
                return (
                  <div key={p.id} className={`group overflow-hidden rounded-2xl border bg-[#0d1726] transition-all ${editingId === p.id ? 'border-[#4ecde6]' : 'border-[#1b2a40] hover:border-white/20'}`}>
                    <button onClick={() => openForm(p, p.id)} className="relative block w-full overflow-hidden text-left" aria-label={`Edit ${p.name}`}>
                      <ProductImage product={p} accent={accent} />
                      {n > 0 && <span className="absolute right-2.5 top-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">{n} ordered</span>}
                      {!p.in_stock && <div className="absolute inset-0 flex items-center justify-center bg-black/55"><span className="rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white/80">Out of stock</span></div>}
                    </button>
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white sm:text-base">{p.name}</p>
                          <p className="text-sm font-extrabold" style={{ color: accent }}>{money(Number(p.price))}</p>
                        </div>
                        <button role="switch" aria-checked={p.in_stock} aria-label={p.in_stock ? 'In stock' : 'Out of stock'} disabled={busyId === p.id}
                          onClick={() => setStock(p, !p.in_stock)} title={p.in_stock ? 'In stock' : 'Out of stock'}
                          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${p.in_stock ? 'bg-emerald-400' : 'bg-white/15'}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${p.in_stock ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-white/40">{p.sizes.length ? p.sizes.join(' · ') : 'One size'}</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => openForm(p, p.id)} className="flex-1 rounded-lg bg-white/[0.06] py-1.5 text-xs font-bold text-white/80 hover:bg-white/[0.1]">Edit</button>
                        <button onClick={() => deleteProduct(p.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-300/80 hover:bg-red-500/10">Delete</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              <button onClick={() => openForm()} className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 text-white/50 hover:border-[#4ecde6]/50 hover:text-white">
                <span className="text-3xl leading-none">+</span><span className="text-sm font-bold">Add product</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ───────── ORDERS BOARD ───────── */}
      {tab === 'orders' && (
        <div>
          {live.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.08] bg-[#0b1422] p-8 text-center">
              <p className="text-lg font-black">No orders yet</p>
              <p className="mt-1 text-sm text-white/50">When a parent orders, it lands in New and you get an alert.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-1 gap-3 sm:min-w-[1100px] sm:grid-cols-5">
                {BOARD.map((col) => {
                  const list = live.filter((o) => o.status === col.status)
                  const total = list.reduce((a, o) => a + Number(o.total_price), 0)
                  return (
                    <div key={col.status} className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5 ${list.length ? '' : 'hidden sm:block'}`}>
                      <div className="mb-2.5 flex items-center justify-between px-1">
                        <span className="flex items-center gap-2 text-sm font-bold"><i className="h-2 w-2 rounded-full" style={{ background: col.tone }} />{col.label}</span>
                        <span className="text-xs tabular-nums text-white/40">{list.length}{list.length ? ` · ${money(total)}` : ''}</span>
                      </div>
                      <div className="space-y-2">
                        {list.map((o) => {
                          const child = o.player ? `${o.player.first_name} ${o.player.last_name || ''}`.trim() : 'Child'
                          return (
                            <div key={o.id} className="rounded-xl border border-white/[0.08] bg-[#0d1726] p-3">
                              <div className="flex gap-2.5">
                                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                                  <ProductImage product={{ name: o.merchandise?.name || 'Item', category: o.merchandise?.category || 'other', image_url: o.merchandise?.image_url || null }} accent={accent} size="thumb" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-white">{child}</p>
                                  <p className="truncate text-xs text-white/55">{(o.quantity || 1) > 1 ? `${o.quantity} × ` : ''}{o.merchandise?.name || 'Item'}</p>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {o.size && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold">Size {o.size}</span>}
                                {o.player_name_on_shirt && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold">“{o.player_name_on_shirt}”</span>}
                                {o.player_number && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold">#{o.player_number}</span>}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                                <span className="truncate">{o.profile?.full_name || 'Parent'} · {when(o.created_at)}</span>
                                <span className="font-bold tabular-nums text-white">{money(Number(o.total_price))}</span>
                              </div>
                              {o.notes && <p className="mt-1.5 text-[11px] text-white/50">“{o.notes}”</p>}
                              <div className="mt-2.5 flex gap-1.5">
                                {col.next && (
                                  <button disabled={busyId === o.id} onClick={() => updateOrderStatus(o.id, col.next!)}
                                    className="flex-1 rounded-lg py-1.5 text-xs font-black text-black disabled:opacity-50" style={{ background: BOARD.find((b) => b.status === col.next)?.tone }}>
                                    {busyId === o.id ? '…' : `${col.nextLabel} →`}
                                  </button>
                                )}
                                {PREV[o.status] && (
                                  <button disabled={busyId === o.id} onClick={() => updateOrderStatus(o.id, PREV[o.status])} title="Move back a step" className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs font-bold text-white/60">←</button>
                                )}
                                {o.status !== 'delivered' && (
                                  <button disabled={busyId === o.id} onClick={() => updateOrderStatus(o.id, 'cancelled')} title="Cancel order" className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-300/70 hover:bg-red-500/10">✕</button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {list.length === 0 && <p className="px-1 py-4 text-center text-xs text-white/25">Nothing here</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {initialOrders.some((o) => o.status === 'cancelled') && (
            <div className="mt-4">
              <button onClick={() => setShowCancelled(!showCancelled)} className="text-xs font-semibold text-white/40 hover:text-white/70">
                {showCancelled ? 'Hide' : 'Show'} cancelled orders ({initialOrders.filter((o) => o.status === 'cancelled').length})
              </button>
              {showCancelled && (
                <div className="mt-2 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
                  {initialOrders.filter((o) => o.status === 'cancelled').map((o) => (
                    <div key={o.id} className="flex items-center justify-between px-3 py-2 text-xs text-white/50">
                      <span>{o.player?.first_name || 'Child'} · {o.merchandise?.name || 'Item'} · {when(o.created_at)}</span>
                      <button onClick={() => updateOrderStatus(o.id, 'pending')} className="font-bold text-white/70 hover:text-white">Restore</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
