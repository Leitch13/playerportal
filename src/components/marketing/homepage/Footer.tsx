import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#080808]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Player Portal" className="h-8 w-auto object-contain" />
            </div>
            <p className="text-xs text-white/50 leading-relaxed max-w-xs">
              The operating system for football academies. Built by an academy.
            </p>
          </div>
          <FooterCol title="Product" links={[
            { label: 'Parent Hub', href: '/how-it-works' },
            { label: 'Attendance', href: '/how-it-works' },
            { label: 'Payments', href: '/how-it-works' },
            { label: 'Migration', href: '/how-it-works' },
          ]} />
          {/* Only lists LIVE landing pages. P2 slugs get added in Hotfix B. */}
          <FooterCol title="Solutions" links={[
            { label: 'Academy management', href: '/football-academy-management-software' },
            { label: 'Booking system', href: '/football-booking-system' },
            { label: 'Payment collection', href: '/academy-payment-collection' },
          ]} />
          <FooterCol title="Company" links={[
            { label: 'Why', href: '/how-it-works' },
            { label: 'Pricing', href: '/how-it-works' },
            { label: 'Book a demo', href: '/how-it-works' },
          ]} />
          <FooterCol title="Resources" links={[
            { label: 'Help centre', href: '/how-it-works' },
            { label: 'Security', href: '/privacy' },
            { label: 'Status', href: '/how-it-works' },
          ]} />
          <FooterCol title="Legal" links={[
            { label: 'Terms', href: '/terms' },
            { label: 'Privacy', href: '/privacy' },
          ]} />
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            <span className="text-white/70 font-semibold">Built by an academy.</span> Trusted by growing academies.
          </p>
          <p className="text-xs text-white/30">
            © 2026 Play It Loveit Ltd. Made in Aberdeen 🏴󠁧󠁢󠁳󠁣󠁴󠁿
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-4">{title}</p>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-white/70 hover:text-white transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
