'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ShopProduct {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  image_url: string | null
  sizes: string[]
  in_stock: boolean
}

export interface ShopChild {
  id: string
  first_name: string
  last_name: string
}

export interface ShopOrder {
  id: string
  status: string
  total_price: number
  quantity: number | null
  size: string | null
  created_at: string
  name: string
  child: string | null
}

interface BasketLine {
  key: string
  product: ShopProduct
  playerId: string
  size: string
  quantity: number
  nameOnShirt: string
  number: string
}

const GROUPS: { key: string; label: string; cats: string[] }[] = [
  { key: 'all', label: 'All', cats: [] },
  { key: 'kit', label: 'Match kit', cats: ['kit'] },
  { key: 'training', label: 'Training', cats: ['training_top', 'shorts', 'socks'] },
  { key: 'equipment', label: 'Equipment', cats: ['ball', 'bag', 'other'] },
  { key: 'bundle', label: 'Bundles', cats: ['bundle'] },
]

const CATEGORY_LABEL: Record<string, string> = {
  kit: 'Match kit',
  training_top: 'Training',
  shorts: 'Shorts',
  socks: 'Socks',
  ball: 'Ball',
  bag: 'Bag',
  bundle: 'Bundle',
  other: 'Equipment',
}

const STATUS_STEPS = ['pending', 'paid', 'ordered', 'shipped', 'delivered']
const STATUS_LABEL: Record<string, string> = {
  pending: 'Sent to academy',
  paid: 'Paid',
  ordered: 'Ordered',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const money = (n: number) => `£${n.toFixed(2).replace(/\.00$/, '')}`
const isPersonal = (c: string) => c === 'kit' || c === 'training_top'

/** Drawn product art in the academy's colour, used when there is no photo. */
function KitArt({ category, accent, name, number, className = '' }: { category: string; accent: string; name?: string; number?: string; className?: string }) {
  if (category === 'ball') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <circle cx="40" cy="40" r="30" fill="#f4f6f8" />
        <path d="M40 24 L52 33 L47.5 47 L32.5 47 L28 33Z" fill="#111827" />
        <path d="M40 24 L40 12 M52 33 L66 29 M47.5 47 L56 60 M32.5 47 L24 60 M28 33 L14 29" stroke="#111827" strokeWidth="2.5" />
        <circle cx="40" cy="40" r="30" fill="none" stroke={accent} strokeWidth="3" />
      </svg>
    )
  }
  if (category === 'bag') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <path d="M28 26 Q40 8 52 26" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        <rect x="10" y="26" width="60" height="38" rx="12" fill={accent} />
        <rect x="10" y="26" width="60" height="38" rx="12" fill="#000" opacity="0.18" />
        <rect x="30" y="40" width="20" height="5" rx="2.5" fill="#fff" opacity="0.85" />
      </svg>
    )
  }
  if (category === 'socks') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <path d="M26 8 H44 V46 L58 54 Q66 60 60 68 Q56 72 48 68 L28 58 Q24 56 26 50Z" fill={accent} />
        <rect x="26" y="8" width="18" height="10" fill="#fff" opacity="0.85" />
      </svg>
    )
  }
  if (category === 'shorts') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <path d="M14 16 H66 L70 60 H46 L40 36 L34 60 H10Z" fill={accent} />
        <rect x="14" y="16" width="52" height="7" fill="#000" opacity="0.2" />
      </svg>
    )
  }
  if (category === 'bundle') {
    return (
      <svg viewBox="0 0 96 80" className={className} aria-hidden="true">
        <path d="M54 18 L42 26 L47 37 L53 34 L53 70 L80 70 L80 34 L86 37 L91 26 L79 18 Q66.5 26 54 18Z" fill="#fff" opacity="0.18" />
        <path d="M22 10 L6 20 L12 34 L20 30 L20 70 L54 70 L54 30 L62 34 L68 20 L52 10 Q37 20 22 10Z" fill={accent} />
        <path d="M22 10 Q37 20 52 10" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="70" cy="62" r="13" fill="#f4f6f8" />
        <path d="M70 55 L76 59.5 L73.8 66.5 L66.2 66.5 L64 59.5Z" fill="#111827" />
      </svg>
    )
  }
  const training = category === 'training_top'
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      {training ? (
        <path d="M26 8 L4 26 L12 38 L22 30 L22 74 L58 74 L58 30 L68 38 L76 26 L54 8 L46 8 L40 16 L34 8Z" fill={accent} />
      ) : (
        <path d="M26 8 L8 19 L14 34 L22 30 L22 74 L58 74 L58 30 L66 34 L72 19 L54 8 Q40 18 26 8Z" fill={accent} />
      )}
      <path d="M22 30 L22 74 L58 74 L58 30" fill="#000" opacity="0.12" />
      {training ? (
        <path d="M40 16 L40 74" stroke="#fff" strokeWidth="2.5" opacity="0.8" />
      ) : (
        <path d="M26 8 Q40 18 54 8" fill="none" stroke="#fff" strokeWidth="3" />
      )}
      {name ? (
        <text x="40" y="40" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800" letterSpacing="1">{name.toUpperCase().slice(0, 10)}</text>
      ) : null}
      {number ? (
        <text x="40" y={name ? 60 : 54} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900">{number}</text>
      ) : null}
    </svg>
  )
}

function ProductImage({ product, accent, size = 'card', name, number }: { product: ShopProduct; accent: string; size?: 'card' | 'large' | 'thumb'; name?: string; number?: string }) {
  const h = size === 'large' ? 'h-56 sm:h-64' : size === 'thumb' ? 'h-14 w-14' : 'h-40 sm:h-44'
  if (product.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.image_url} alt={product.name} className={`${h} w-full object-cover`} />
    )
  }
  return (
    <div
      className={`${h} flex w-full items-center justify-center`}
      style={{ background: `radial-gradient(circle at 50% 35%, ${accent}33 0%, ${accent}0f 45%, #0b1422 80%)` }}
    >
      <KitArt
        category={product.category}
        accent={accent}
        name={name}
        number={number}
        className={size === 'large' ? 'h-44 w-44 drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]' : size === 'thumb' ? 'h-10 w-10' : 'h-28 w-28 drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105'}
      />
    </div>
  )
}

function Icon({ d, className = 'h-4 w-4' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}
const BAG = 'M6 7h12l-1 13H7L6 7zm3 0V5a3 3 0 016 0v2'
const CLOSE = 'M6 6l12 12M18 6L6 18'
const CHECK = 'M5 13l4 4L19 7'

export default function ShopClient({
  academyName,
  logoUrl,
  accent,
  products,
  childList,
  orders,
}: {
  academyName: string
  logoUrl: string | null
  accent: string
  products: ShopProduct[]
  childList: ShopChild[]
  orders: ShopOrder[]
}) {
  const router = useRouter()
  const [group, setGroup] = useState('all')
  const [open, setOpen] = useState<ShopProduct | null>(null)
  const [basket, setBasket] = useState<BasketLine[]>([])
  const [basketOpen, setBasketOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState('')
  const [placed, setPlaced] = useState<{ items: number; total: number } | null>(null)

  // product sheet state
  const [size, setSize] = useState('')
  const [playerId, setPlayerId] = useState(childList[0]?.id || '')
  const [qty, setQty] = useState(1)
  const [shirtName, setShirtName] = useState('')
  const [shirtNo, setShirtNo] = useState('')
  const [sheetError, setSheetError] = useState('')

  const visibleGroups = GROUPS.filter((g) => g.key === 'all' || products.some((p) => g.cats.includes(p.category)))
  const featured = products.find((p) => p.category === 'bundle' && p.in_stock) || null
  const shown = useMemo(() => {
    const g = GROUPS.find((x) => x.key === group)
    const list = !g || g.key === 'all' ? products : products.filter((p) => g.cats.includes(p.category))
    return group === 'all' && featured ? list.filter((p) => p.id !== featured.id) : list
  }, [group, products, featured])

  const count = basket.reduce((a, l) => a + l.quantity, 0)
  const total = basket.reduce((a, l) => a + l.quantity * Number(l.product.price), 0)
  const childName = (id: string) => childList.find((c) => c.id === id)?.first_name || ''

  useEffect(() => {
    const lock = open || basketOpen
    document.body.style.overflow = lock ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, basketOpen])

  function openProduct(p: ShopProduct) {
    setOpen(p)
    setSize(p.sizes.length === 1 ? p.sizes[0] : '')
    setQty(1)
    setShirtName(childList.find((c) => c.id === playerId)?.first_name || '')
    setShirtNo('')
    setSheetError('')
  }

  function addToBasket() {
    if (!open) return
    if (open.sizes.length > 0 && !size) return setSheetError('Choose a size')
    if (!playerId) return setSheetError('Choose which child this is for')
    setBasket((b) => [
      ...b,
      {
        key: `${open.id}-${Date.now()}`,
        product: open,
        playerId,
        size,
        quantity: qty,
        nameOnShirt: isPersonal(open.category) ? shirtName : '',
        number: isPersonal(open.category) ? shirtNo : '',
      },
    ])
    setOpen(null)
    setPlaced(null)
  }

  async function placeOrder() {
    setPlacing(true)
    setPlaceError('')
    try {
      const res = await fetch('/api/shop/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: basket.map((l) => ({
            merchandiseId: l.product.id,
            playerId: l.playerId,
            size: l.size || null,
            quantity: l.quantity,
            nameOnShirt: l.nameOnShirt || null,
            number: l.number || null,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPlaceError(json.error || 'We could not place your order. Please try again.')
      } else {
        setPlaced({ items: json.items, total: json.total })
        setBasket([])
        setBasketOpen(false)
        router.refresh()
      }
    } catch {
      setPlaceError('No connection. Check your signal and try again.')
    }
    setPlacing(false)
  }

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all ${active ? 'text-black shadow-[0_6px_20px_-6px_var(--shop-accent)]' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white'}`

  return (
    <div
      className="relative -m-6 min-h-screen bg-[#070c15] p-4 pb-32 text-white sm:p-6 lg:-m-8 lg:p-8 lg:pb-32"
      style={{ ['--shop-accent' as string]: accent }}
    >
      {/* ─── Hero ─── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1726] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-40" style={{ background: `radial-gradient(closest-side, ${accent}, transparent)` }} />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full opacity-15" style={{ background: `radial-gradient(closest-side, ${accent}, transparent)` }} />
        <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 sm:block">
          <KitArt category="kit" accent={accent} className="h-40 w-40 rotate-6 opacity-90 drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)]" />
        </div>
        <div className="relative flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={academyName} className="h-16 w-16 shrink-0 rounded-2xl border border-white/15 bg-white object-contain p-1 sm:h-20 sm:w-20" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-black sm:h-20 sm:w-20" style={{ background: accent }}>
              {academyName.charAt(0)}
            </div>
          )}
          <div className="sm:max-w-[60%]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: accent }}>Official kit shop</p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-white sm:text-4xl">{academyName}</h1>
            <p className="mt-1.5 text-sm text-white/55">Match kit, training wear and equipment. Pick a size, add your child&apos;s name and order in one go.</p>
          </div>
        </div>
      </div>

      {placed && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300"><Icon d={CHECK} className="h-5 w-5" /></span>
          <div>
            <p className="font-bold text-white">Order sent to {academyName}</p>
            <p className="text-sm text-white/60">{placed.items} {placed.items === 1 ? 'item' : 'items'}, {money(placed.total)}. {academyName} has been told and will be in touch about payment and collection.</p>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.08] bg-[#0d1726] p-12 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-white/30"><Icon d={BAG} className="h-7 w-7" /></span>
          <p className="font-semibold text-white/80">The shop is being stocked</p>
          <p className="mt-1 text-sm text-white/40">{academyName} hasn&apos;t added any kit yet. Check back soon.</p>
        </div>
      ) : (
        <>
          {visibleGroups.length > 2 && (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleGroups.map((g) => (
                <button key={g.key} onClick={() => setGroup(g.key)} className={chip(group === g.key)} style={group === g.key ? { background: accent } : undefined}>
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {/* ─── Featured bundle ─── */}
          {featured && group === 'all' && (
            <button
              onClick={() => openProduct(featured)}
              className="group mb-5 flex w-full items-center gap-4 overflow-hidden rounded-3xl border text-left transition-all hover:-translate-y-0.5"
              style={{ borderColor: `${accent}55`, background: `linear-gradient(110deg, ${accent}2e 0%, #0d1726 70%)` }}
            >
              <div className="min-w-0 flex-1 p-5 sm:p-6">
                <span className="inline-block rounded-full bg-amber-300/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-200">Best value</span>
                <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">{featured.name}</h2>
                {featured.description && <p className="mt-1 line-clamp-2 text-sm text-white/55">{featured.description}</p>}
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-2xl font-black text-white">{money(Number(featured.price))}</span>
                  <span className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold text-black" style={{ background: accent }}>View bundle</span>
                </div>
              </div>
              <div className="w-36 shrink-0 sm:w-56">
                {featured.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featured.image_url} alt={featured.name} className="h-40 w-full object-cover" />
                ) : (
                  <KitArt category="bundle" accent={accent} className="h-32 w-full transition-transform duration-300 group-hover:scale-105 sm:h-40" />
                )}
              </div>
            </button>
          )}

          {/* ─── Products ─── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => (
              <button
                key={p.id}
                onClick={() => p.in_stock && openProduct(p)}
                disabled={!p.in_stock}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#1b2a40] bg-[#0d1726] text-left transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] disabled:cursor-not-allowed"
              >
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
                    <p className="truncate text-sm font-bold text-white sm:text-base">{p.name}</p>
                    <p className="mt-0.5 text-sm font-extrabold" style={{ color: accent }}>{money(Number(p.price))}</p>
                  </div>
                  {p.in_stock && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold leading-none text-[#070c15] transition-transform group-hover:scale-110">+</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─── Orders ─── */}
      {orders.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold text-white">Your orders</h2>
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1726]">
            {orders.map((o) => {
              const step = STATUS_STEPS.indexOf(o.status)
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {o.quantity && o.quantity > 1 ? `${o.quantity} × ` : ''}{o.name}
                      {o.size && <span className="ml-1.5 text-white/40">{o.size}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {o.child ? `For ${o.child} · ` : ''}{new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-bold text-white">{money(Number(o.total_price))}</span>
                    {o.status === 'cancelled' ? (
                      <span className="text-[11px] font-semibold text-red-300">Cancelled</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="flex gap-0.5">
                          {STATUS_STEPS.map((s, i) => (
                            <span key={s} className="h-1.5 w-3 rounded-full" style={{ background: i <= step ? accent : 'rgba(255,255,255,0.12)' }} />
                          ))}
                        </span>
                        <span className="text-[11px] font-semibold text-white/60">{STATUS_LABEL[o.status] || o.status}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Basket bar ─── */}
      {count > 0 && !basketOpen && !open && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4 lg:left-64">
          <button
            onClick={() => setBasketOpen(true)}
            className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-white px-5 py-4 text-[#070c15] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)]"
          >
            <span className="flex items-center gap-3 font-bold">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm text-black" style={{ background: accent }}>{count}</span>
              View basket
            </span>
            <span className="text-lg font-black">{money(total)}</span>
          </button>
        </div>
      )}

      {/* ─── Product sheet ─── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1422] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <ProductImage product={open} accent={accent} size="large" name={isPersonal(open.category) ? shirtName : undefined} number={isPersonal(open.category) ? shirtNo : undefined} />
              <button onClick={() => setOpen(null)} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"><Icon d={CLOSE} /></button>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: accent }}>{CATEGORY_LABEL[open.category] || 'Kit'}</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <h3 className="text-xl font-black text-white">{open.name}</h3>
                  <span className="text-xl font-black text-white">{money(Number(open.price))}</span>
                </div>
                {open.description && <p className="mt-1.5 text-sm text-white/55">{open.description}</p>}
              </div>

              {open.sizes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {open.sizes.map((s) => (
                      <button key={s} onClick={() => { setSize(s); setSheetError('') }} className={`min-w-[3.25rem] rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${size === s ? 'text-white' : 'border-white/10 text-white/60 hover:border-white/30'}`} style={size === s ? { borderColor: accent, background: `${accent}26` } : undefined}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {childList.length > 1 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">For</p>
                  <div className="flex flex-wrap gap-2">
                    {childList.map((c) => (
                      <button key={c.id} onClick={() => { setPlayerId(c.id); if (isPersonal(open.category)) setShirtName(c.first_name) }} className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${playerId === c.id ? 'text-white' : 'border-white/10 text-white/60 hover:border-white/30'}`} style={playerId === c.id ? { borderColor: accent, background: `${accent}26` } : undefined}>
                        {c.first_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isPersonal(open.category) && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">On the back <span className="normal-case tracking-normal text-white/30">(optional)</span></p>
                  <div className="flex gap-2">
                    <input value={shirtName} onChange={(e) => setShirtName(e.target.value)} maxLength={20} placeholder="Name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold uppercase text-white placeholder:normal-case placeholder:text-white/30 focus:border-white/30 focus:outline-none" />
                    <input value={shirtNo} onChange={(e) => setShirtNo(e.target.value.replace(/\D/g, ''))} maxLength={3} inputMode="numeric" placeholder="No." className="w-20 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center text-sm font-semibold text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-white/45">Quantity</p>
                <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One fewer" className="h-9 w-9 rounded-lg text-lg font-bold text-white/70 hover:bg-white/10">−</button>
                  <span className="w-8 text-center font-bold">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="One more" className="h-9 w-9 rounded-lg text-lg font-bold text-white/70 hover:bg-white/10">+</button>
                </div>
              </div>

              {sheetError && <p className="text-sm font-semibold text-red-300">{sheetError}</p>}
              {childList.length === 0 && <p className="text-sm text-amber-200">Add your child to your account first, then come back to order.</p>}

              <button onClick={addToBasket} disabled={childList.length === 0} className="w-full rounded-2xl py-4 text-base font-black text-black transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40" style={{ background: accent }}>
                Add to basket · {money(Number(open.price) * qty)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Basket sheet ─── */}
      {basketOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setBasketOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1422] p-5 sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black text-white">Your basket</h3>
              <button onClick={() => setBasketOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"><Icon d={CLOSE} /></button>
            </div>
            {basket.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/50">Your basket is empty.</p>
            ) : (
              <div className="space-y-3">
                {basket.map((l) => (
                  <div key={l.key} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <ProductImage product={l.product} accent={accent} size="thumb" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{l.quantity > 1 ? `${l.quantity} × ` : ''}{l.product.name}</p>
                      <p className="truncate text-xs text-white/45">
                        {[childName(l.playerId) && `For ${childName(l.playerId)}`, l.size && `Size ${l.size}`, (l.nameOnShirt || l.number) && `${l.nameOnShirt.toUpperCase()} ${l.number}`.trim()].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-white">{money(l.quantity * Number(l.product.price))}</span>
                      <button onClick={() => setBasket((b) => b.filter((x) => x.key !== l.key))} className="text-[11px] font-semibold text-white/40 hover:text-red-300">Remove</button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
                  <span className="text-sm text-white/60">Total</span>
                  <span className="text-2xl font-black text-white">{money(total)}</span>
                </div>
                <p className="text-xs text-white/45">{academyName} gets your order straight away and will be in touch about payment and collection.</p>
                {placeError && <p className="text-sm font-semibold text-red-300">{placeError}</p>}
                <button onClick={placeOrder} disabled={placing} className="w-full rounded-2xl py-4 text-base font-black text-black transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50" style={{ background: accent }}>
                  {placing ? 'Sending order…' : `Place order · ${money(total)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
