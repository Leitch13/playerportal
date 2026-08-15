import Link from 'next/link'

// variant='light' (default): pale footer for the Daylight homepage.
// variant='dark': the original dark footer, used by the SEO landing pages.
export default function Footer({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const dark = variant === 'dark'
  return (
    <footer className={dark ? 'border-t border-white/5 bg-[#080808]' : 'border-t border-[#e3ebf0] bg-[#eef4f7]'}>
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              {/* logo.png is white artwork — on the light footer it sits on a cyan chip */}
              {dark ? (
                <img src="/logo.png" alt="Player Portal" className="h-8 w-auto object-contain" />
              ) : (
                <span className="inline-flex rounded-lg px-2.5 py-1.5" style={{ background: 'linear-gradient(170deg,#12a2bd,#0b7f96)' }}>
                  <img src="/logo.png" alt="Player Portal" className="h-7 w-auto object-contain" />
                </span>
              )}
            </div>
            <p className={`text-xs leading-relaxed max-w-xs ${dark ? 'text-white/50' : 'text-[#5a6b7c]'}`}>
              The operating system for football academies. Built by an academy.
            </p>
          </div>
          <FooterCol dark={dark} title="Product" links={[
            { label: 'Parent Hub', href: '/how-it-works' },
            { label: 'Attendance', href: '/how-it-works' },
            { label: 'Payments', href: '/how-it-works' },
            { label: 'Migration', href: '/how-it-works' },
          ]} />
          {/* Only lists LIVE landing pages. P2 slugs get added in Hotfix B. */}
          <FooterCol dark={dark} title="Solutions" links={[
            { label: 'Academy management', href: '/football-academy-management-software' },
            { label: 'Booking system', href: '/football-booking-system' },
            { label: 'Payment collection', href: '/academy-payment-collection' },
          ]} />
          <FooterCol dark={dark} title="Company" links={[
            { label: 'Why', href: '/how-it-works' },
            { label: 'Pricing', href: '/how-it-works' },
            { label: 'Book a demo', href: '/how-it-works' },
          ]} />
          <FooterCol dark={dark} title="Resources" links={[
            { label: 'Help centre', href: '/how-it-works' },
            { label: 'Security', href: '/privacy' },
            { label: 'Status', href: '/how-it-works' },
          ]} />
          <FooterCol dark={dark} title="Legal" links={[
            { label: 'Terms', href: '/terms' },
            { label: 'Privacy', href: '/privacy' },
          ]} />
        </div>

        <div className={`mt-16 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${dark ? 'border-white/5' : 'border-[#e3ebf0]'}`}>
          <p className={`text-xs ${dark ? 'text-white/40' : 'text-[#93a2ad]'}`}>
            <span className={`font-semibold ${dark ? 'text-white/70' : 'text-[#0d1b2b]'}`}>Built by an academy.</span> Trusted by growing academies.
          </p>
          <p className={`text-xs ${dark ? 'text-white/30' : 'text-[#93a2ad]'}`}>
            © 2026 Play It Loveit Ltd. Made in Aberdeen 🏴󠁧󠁢󠁳󠁣󠁴󠁿
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links, dark }: { title: string; links: { label: string; href: string }[]; dark: boolean }) {
  return (
    <div>
      <p className={`text-xs uppercase tracking-widest font-semibold mb-4 ${dark ? 'text-white/40' : 'text-[#93a2ad]'}`}>{title}</p>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className={`text-sm transition-colors ${dark ? 'text-white/70 hover:text-white' : 'text-[#5a6b7c] hover:text-[#0d1b2b]'}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
