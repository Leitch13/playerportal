import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How Player Portal uses cookies and similar technologies.',
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="bg-[#0a0a0a] border-b border-white/[0.06] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-white/50 text-sm hover:text-white mb-4 inline-block">&larr; Back</Link>
          <h1 className="text-3xl font-bold">Cookie Policy</h1>
          <p className="text-white/60 mt-2">Last updated: 8 July 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 md:p-10 space-y-8 text-sm leading-relaxed text-white/70">

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">1. What are cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help websites
              remember your preferences, keep you logged in, and understand how the site is being used.
              This policy explains which cookies Player Portal uses and why.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">2. How we use cookies</h2>
            <p>
              Player Portal uses a minimal set of cookies. Some are essential to keeping you signed in and the
              platform working; some are strictly optional and only load when you accept &ldquo;All&rdquo; on
              the cookie banner. We do <strong>not</strong> use advertising cookies, and we do not build
              marketing profiles of you or your child.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">3. Cookie categories</h2>

            <div className="space-y-5 mt-4">
              <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                <h3 className="font-bold text-white mb-1">Essential cookies (always on)</h3>
                <p className="text-xs text-white/60 mb-3">These cookies are required for the platform to work. You cannot disable them without breaking the site.</p>
                <ul className="text-xs space-y-1 text-white/70 list-disc pl-5">
                  <li><code className="text-emerald-400">sb-access-token</code> · Supabase authentication</li>
                  <li><code className="text-emerald-400">sb-refresh-token</code> · Supabase session refresh</li>
                  <li><code className="text-emerald-400">__stripe_mid</code>, <code className="text-emerald-400">__stripe_sid</code> · Stripe fraud prevention during checkout</li>
                </ul>
              </div>

              <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                <h3 className="font-bold text-white mb-1">Functional cookies (on by default, opt-out available)</h3>
                <p className="text-xs text-white/60 mb-3">These remember your preferences — e.g. dark mode, collapsed nav groups.</p>
                <ul className="text-xs space-y-1 text-white/70 list-disc pl-5">
                  <li><code className="text-emerald-400">pp-theme</code> · Your dark/light theme preference</li>
                  <li><code className="text-emerald-400">nav-collapsed</code> · Which sidebar sections you've collapsed</li>
                </ul>
              </div>

              <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                <h3 className="font-bold text-white mb-1">Analytics cookies (opt-in only)</h3>
                <p className="text-xs text-white/60 mb-3">
                  These help us understand which pages people visit, how they arrived, and where we&apos;re
                  losing them, so we can improve the platform. We only load these when you accept
                  &ldquo;All&rdquo; on the cookie banner. Accepting &ldquo;Essential Only&rdquo; keeps
                  them off entirely.
                </p>
                <ul className="text-xs space-y-1 text-white/70 list-disc pl-5">
                  <li>
                    <strong className="text-white">Google Analytics 4</strong> ·
                    <code className="text-emerald-400 mx-1">_ga</code>,
                    <code className="text-emerald-400 mx-1">_ga_&lt;id&gt;</code> ·
                    aggregate page views and traffic sources
                  </li>
                  <li>
                    <strong className="text-white">Microsoft Clarity</strong> ·
                    <code className="text-emerald-400 mx-1">_clck</code>,
                    <code className="text-emerald-400 mx-1">_clsk</code>,
                    <code className="text-emerald-400 mx-1">CLID</code>,
                    <code className="text-emerald-400 mx-1">ANONCHK</code>,
                    <code className="text-emerald-400 mx-1">MR</code>,
                    <code className="text-emerald-400 mx-1">SM</code> ·
                    anonymised session recordings and heatmaps
                  </li>
                  <li>
                    <strong className="text-white">Vercel Analytics + Speed Insights</strong> ·
                    first-party session token · anonymised page-view counts and Core Web Vitals
                  </li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  None of these track your child. None are used for advertising. None are shared with
                  third parties for marketing. You can withdraw consent at any time by clearing your
                  browser&apos;s site data — the banner will return on your next visit.
                </p>
              </div>

              <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-5">
                <h3 className="font-bold text-white mb-1">Advertising cookies</h3>
                <p className="text-xs text-white/60">We do not use advertising cookies. We will never sell your data.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">4. Third-party cookies</h2>
            <p>
              When you interact with certain features, our trusted providers may set cookies. These are essential
              to the function you're using.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong className="text-white">Stripe</strong> — for secure payment processing and fraud prevention</li>
              <li><strong className="text-white">Supabase</strong> — for authentication and session management</li>
              <li><strong className="text-white">Google (Analytics 4)</strong> — opt-in only via the cookie banner</li>
              <li><strong className="text-white">Microsoft (Clarity)</strong> — opt-in only via the cookie banner</li>
              <li><strong className="text-white">Vercel (Analytics + Speed Insights)</strong> — opt-in only via the cookie banner</li>
            </ul>
            <p className="mt-3">
              These providers have their own privacy policies and are contractually bound under our Data Processing Agreement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">5. Managing cookies</h2>
            <p>
              You can manage or delete cookies through your browser settings at any time. Please note that
              disabling essential cookies will log you out and may prevent Player Portal from working properly.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" className="text-[#4ecde6] hover:underline" target="_blank" rel="noopener noreferrer">Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" className="text-[#4ecde6] hover:underline" target="_blank" rel="noopener noreferrer">Firefox</a></li>
              <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" className="text-[#4ecde6] hover:underline" target="_blank" rel="noopener noreferrer">Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" className="text-[#4ecde6] hover:underline" target="_blank" rel="noopener noreferrer">Edge</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">6. Children&apos;s data</h2>
            <p>
              Player Portal is a platform used by adults (parents, coaches, academy admins) on behalf of children.
              Children do not directly interact with the platform, and we do not use cookies to track children
              or build profiles of them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">7. Updates to this policy</h2>
            <p>
              We may update this policy from time to time. When we do, we&apos;ll update the &ldquo;last updated&rdquo;
              date at the top and, if changes are material, notify you by email or in the dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 text-white">8. Contact us</h2>
            <p>
              Questions about our use of cookies? Contact us at <a href="mailto:privacy@theplayerportal.net" className="text-[#4ecde6] hover:underline">privacy@theplayerportal.net</a>.
            </p>
            <p className="mt-3 text-xs text-white/40">
              JSL Sports Technology Ltd · trading as Player Portal
            </p>
          </section>

          <section className="pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-white/40">
              See also: <Link href="/privacy" className="text-[#4ecde6] hover:underline">Privacy Policy</Link> ·{' '}
              <Link href="/dpa" className="text-[#4ecde6] hover:underline">Data Processing Agreement</Link> ·{' '}
              <Link href="/terms" className="text-[#4ecde6] hover:underline">Terms of Service</Link>
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
