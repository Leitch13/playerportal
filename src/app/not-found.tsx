import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#060606] text-white flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-16">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4ecde6] to-[#2ba8c3] flex items-center justify-center shadow-lg shadow-[#4ecde6]/20">
          <span className="text-white font-extrabold text-xs">PP</span>
        </div>
        <span className="text-lg font-bold tracking-tight">Player Portal</span>
      </Link>

      {/* 404 */}
      <div className="text-center">
        <div className="text-[10rem] sm:text-[14rem] font-extrabold leading-none tracking-tighter bg-gradient-to-b from-[#4ecde6] via-[#4ecde6]/60 to-transparent bg-clip-text text-transparent select-none">
          404
        </div>

        <div className="text-4xl mb-2 -mt-4">&#9917;</div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          Page not found
        </h1>

        <p className="text-white/40 text-base max-w-md mx-auto mb-10 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-3.5 bg-[#4ecde6] text-[#0a0a0a] rounded-full font-semibold text-sm hover:bg-[#7dddf0] transition-all shadow-lg shadow-[#4ecde6]/20"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3.5 border border-white/15 text-white/70 rounded-full font-semibold text-sm hover:bg-white/5 hover:text-white hover:border-white/25 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
