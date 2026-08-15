// variant='light' (default): white strip for the Daylight homepage.
// variant='dark': the original dark strip, used by the SEO landing pages.
export default function TrustStrip({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const dark = variant === 'dark'
  return (
    <section className={`relative border-y ${dark ? 'border-white/5 bg-[#0a0a0a]' : 'border-[#e3ebf0] bg-white'}`}>
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <p className={`text-xs uppercase tracking-widest font-semibold shrink-0 ${dark ? 'text-white/40' : 'text-[#93a2ad]'}`}>
            Growing academies trust Player Portal
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            <AcademyLogo name="Jamie Allan Football Academy" abbr="JAF" dark={dark} />
            <AcademyLogo name="Gold &amp; Gray Soccer Academy" abbr="G&amp;G" dark={dark} />
          </div>
        </div>
      </div>
    </section>
  )
}

function AcademyLogo({ name, abbr, dark }: { name: string; abbr: string; dark: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${dark ? 'bg-white/5 border-white/10' : 'bg-[#eef4f7] border-[#e3ebf0]'}`}>
        <span className={`text-xs font-black tracking-tight ${dark ? 'text-white/60' : 'text-[#5a6b7c]'}`} dangerouslySetInnerHTML={{ __html: abbr }} />
      </div>
      <span className={`text-sm font-semibold ${dark ? 'text-white/70' : 'text-[#0d1b2b]'}`} dangerouslySetInnerHTML={{ __html: name }} />
    </div>
  )
}
