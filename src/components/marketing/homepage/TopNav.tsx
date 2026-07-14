import Link from 'next/link'

export default function TopNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#0a0a0a]/70">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Player Portal" className="h-9 w-auto object-contain" />
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <a href="#product" className="hover:text-white transition-colors">Product</a>
          <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#why" className="hover:text-white transition-colors">Why</a>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/auth/signin" className="hidden sm:inline text-sm text-white/70 hover:text-white transition-colors">Log in</Link>
          <Link href="/book-demo" className="hidden sm:inline text-sm font-semibold text-white/90 hover:text-white border border-white/15 hover:border-white/30 px-4 py-2 rounded-full transition-colors">
            Book a demo
          </Link>
          <Link href="/onboard" className="text-sm font-semibold text-black bg-[#4ecde6] hover:bg-[#6eddf2] px-4 py-2 rounded-full transition-colors">
            Try free
          </Link>
        </div>
      </div>
    </nav>
  )
}
