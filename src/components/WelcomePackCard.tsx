import Link from 'next/link'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { loadFamilyPacks } from '@/lib/welcome-pack-server'

/**
 * On a parent's home page: their welcome pack, until they have opened it.
 * See src/lib/welcome-pack.ts. Shows nothing when there is nothing to open.
 */
export default async function WelcomePackCard({ userId }: { userId: string }) {
  let packs: Awaited<ReturnType<typeof loadFamilyPacks>>['packs'] = []
  try {
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const r = await loadFamilyPacks(service, userId)
    packs = r.packs.filter((p) => !r.opened.has(p.packId))
  } catch { return null }
  if (packs.length === 0) return null
  return (
    <div className="mb-5 space-y-3" data-testid="welcome-pack-card">
      {packs.map((p) => (
        <div key={p.packId} className="relative overflow-hidden rounded-3xl border border-[#243652] bg-gradient-to-b from-[#132238] to-[#0d1726] p-5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#4ecde6]/10 blur-3xl" />
          <div className="relative flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0b1524] text-[#4ecde6] ring-1 ring-[#4ecde6]/40">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V3.5Z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4ecde6]">Start here</p>
              <p className="mt-0.5 text-[17px] font-bold leading-tight text-white">{p.title}</p>
              {p.message && <p className="mt-1.5 text-sm leading-relaxed text-white/65">{p.message}</p>}
            </div>
          </div>
          <a href={`/api/welcome-pack/${p.packId}`} target="_blank" rel="noopener noreferrer" data-testid="welcome-pack-open"
            className="relative mt-4 block w-full rounded-xl bg-[#4ecde6] px-4 py-3 text-center text-sm font-bold text-[#06121c] transition-opacity hover:opacity-90">Open your welcome pack</a>
        </div>
      ))}
      <p className="px-1 text-xs text-white/40">You can find it again any time under <Link href="/dashboard/welcome-packs" className="font-semibold text-[#4ecde6] hover:underline">Welcome pack</Link> in the menu.</p>
    </div>
  )
}
