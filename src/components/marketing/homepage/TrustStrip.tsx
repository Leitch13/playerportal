export default function TrustStrip() {
  return (
    <section className="relative border-y border-white/5 bg-[#0a0a0a]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <p className="text-xs uppercase tracking-widest text-white/40 font-semibold shrink-0">
            Growing academies trust Player Portal
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            <AcademyLogo name="Jamie Allan Football Academy" abbr="JAF" />
            <AcademyLogo name="Gold &amp; Gray Soccer Academy" abbr="G&amp;G" />
          </div>
        </div>
      </div>
    </section>
  )
}

function AcademyLogo({ name, abbr }: { name: string; abbr: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
        <span className="text-xs font-black text-white/60 tracking-tight" dangerouslySetInnerHTML={{ __html: abbr }} />
      </div>
      <span className="text-sm font-semibold text-white/70" dangerouslySetInnerHTML={{ __html: name }} />
    </div>
  )
}
