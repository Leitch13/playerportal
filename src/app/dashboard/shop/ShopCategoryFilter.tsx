'use client'

import { useRouter } from 'next/navigation'

const categories = [
  { key: 'all', label: 'All', icon: '\u{1F6CD}\uFE0F' },
  { key: 'kit', label: 'Kit', icon: '\u{1F455}' },
  { key: 'training', label: 'Training', icon: '\u{1F3BD}' },
  { key: 'equipment', label: 'Equipment', icon: '\u26BD' },
]

export default function ShopCategoryFilter({ active }: { active: string }) {
  const router = useRouter()

  function setCategory(key: string) {
    const params = new URLSearchParams()
    if (key !== 'all') params.set('category', key)
    router.push(`/dashboard/shop${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => setCategory(cat.key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            active === cat.key
              ? 'bg-[#4ecde6] text-black'
              : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white'
          }`}
        >
          <span>{cat.icon}</span>
          {cat.label}
        </button>
      ))}
    </div>
  )
}
