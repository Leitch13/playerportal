export default function OperatingSystem() {
  return (
    <section className="relative border-t border-white/5 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-6 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#4ecde6] font-semibold mb-6">
            THE POSITIONING
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] font-black text-white">
            The operating system for football academies.
          </h2>
          <p className="mt-6 text-2xl lg:text-3xl leading-[1.2] text-white/40 font-medium">
            Not a booking tool. Not a payment tool. All of it.
          </p>

          <div className="mt-14 inline-flex items-baseline gap-6 rounded-full border border-white/10 bg-white/[0.02] px-8 py-5">
            <div className="text-left">
              <span className="block text-3xl lg:text-4xl font-black text-[#4ecde6] tabular-nums">12 tools.</span>
            </div>
            <div className="text-left">
              <span className="block text-3xl lg:text-4xl font-black text-white tabular-nums">One login.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
