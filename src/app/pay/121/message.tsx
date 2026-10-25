import Link from 'next/link'

/** A plain page for the 1-2-1 pay links when there's nothing to pay or something's wrong. */
export default function PayMessage({ title, text, academy }: { title: string; text: string; academy?: string | null }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-8 text-center space-y-3">
        {academy && <p className="text-xs uppercase tracking-wider text-white/45">{academy}</p>}
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="text-sm text-white/70">{text}</p>
        <Link href="/dashboard/sessions" className="inline-block mt-2 rounded-xl bg-[#4ecde6] px-5 py-2.5 text-sm font-bold text-black">Open my sessions</Link>
      </div>
    </div>
  )
}
