import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-primary text-white py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-white/60 text-sm hover:text-white mb-4 inline-block">&larr; Back</Link>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-white/70 mt-2">Last updated: March 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-border p-8 md:p-10 space-y-8 text-sm leading-relaxed text-text">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold mb-3">1. Introduction</h2>
            <p>
              Player Portal (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a UK-based SaaS platform that provides
              management tools for sports academies. This Privacy Policy explains how we collect, use, store, and
              protect your personal data when you use our platform. We are committed to complying with the UK General
              Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
            <p className="mt-3">
              By using Player Portal, you acknowledge that you have read and understood this Privacy Policy.
              If you do not agree with our practices, please do not use our Service.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold mb-3">2. Data We Collect</h2>
            <p className="mb-3">We collect the following categories of personal data:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account information:</strong> name, email address, phone number, and password (hashed).</li>
              <li><strong>Player information:</strong> child&apos;s name, date of birth, medical conditions, allergies, emergency contact details, and development records.</li>
              <li><strong>Payment information:</strong> billing address and payment method details (processed and stored securely by Stripe; we do not store full card numbers).</li>
              <li><strong>Usage data:</strong> IP address, browser type, device information, pages visited, and interaction data collected through cookies and analytics.</li>
              <li><strong>Communication data:</strong> messages sent through the platform, email correspondence, and notification preferences.</li>
              <li><strong>Media:</strong> photographs uploaded to the gallery by academy staff or coaches.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold mb-3">3. How We Use Your Data</h2>
            <p className="mb-3">We process your personal data for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>To create and manage your account and provide access to the platform.</li>
              <li>To facilitate player registration, scheduling, attendance tracking, and progress reviews.</li>
              <li>To process payments, subscriptions, and invoicing.</li>
              <li>To send transactional emails (e.g. payment confirmations, session reminders, progress reports).</li>
              <li>To improve our platform through anonymised usage analytics.</li>
              <li>To respond to your enquiries and provide customer support.</li>
              <li>To comply with legal obligations and enforce our Terms &amp; Conditions.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold mb-3">4. Legal Basis for Processing</h2>
            <p className="mb-3">We process your data under the following lawful bases:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Contract:</strong> processing is necessary to perform our contract with you (e.g. providing the Service, processing payments).</li>
              <li><strong>Consent:</strong> where you have given explicit consent (e.g. marketing communications, photography consent).</li>
              <li><strong>Legitimate interests:</strong> to improve our platform, prevent fraud, and ensure security.</li>
              <li><strong>Legal obligation:</strong> to comply with applicable laws and regulations.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold mb-3">5. Cookies</h2>
            <p className="mb-3">We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Essential cookies:</strong> maintain your session, authentication state, and security tokens. These are strictly necessary for the platform to function.</li>
              <li><strong>Analytics cookies:</strong> understand how users interact with the platform so we can improve the experience. These are anonymised where possible.</li>
              <li><strong>Preference cookies:</strong> remember your settings and preferences (e.g. notification preferences, theme).</li>
            </ul>
            <p className="mt-3">
              You can manage cookie preferences through your browser settings. Disabling essential cookies may prevent you from using certain features of the platform.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold mb-3">6. Data Storage &amp; Security</h2>
            <p>
              Your data is stored securely using <strong>Supabase</strong>, with databases hosted in the
              European Union (EU). All data is encrypted in transit (TLS 1.2+) and at rest. We implement
              appropriate technical and organisational measures to protect your personal data against unauthorised
              access, alteration, disclosure, or destruction, including:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Row-level security policies on all database tables.</li>
              <li>Hashed and salted password storage.</li>
              <li>Regular security audits and vulnerability assessments.</li>
              <li>Access controls limiting data access to authorised personnel only.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold mb-3">7. Third-Party Services</h2>
            <p className="mb-3">We share your data with the following trusted third parties, solely for the purposes described:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Stripe</strong> (stripe.com) &mdash; payment processing. Stripe is PCI DSS Level 1 certified. We share billing details necessary to process your payments. Stripe&apos;s privacy policy governs their handling of your payment data.</li>
              <li><strong>Resend</strong> (resend.com) &mdash; transactional email delivery. We share your email address and name to send account notifications, payment receipts, and session reminders.</li>
              <li><strong>Supabase</strong> (supabase.com) &mdash; database hosting and authentication infrastructure, hosted within the EU.</li>
            </ul>
            <p className="mt-3">
              We do not sell, rent, or trade your personal data to any third party for marketing purposes.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold mb-3">8. Children&apos;s Data (GDPR Article 8)</h2>
            <p>
              Player Portal processes data relating to children as part of academy player management. We take the
              protection of children&apos;s data extremely seriously.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>All player accounts for children under 18 must be created by a parent or legal guardian.</li>
              <li>In accordance with GDPR Article 8 and the UK Age Appropriate Design Code, we require verifiable parental consent before processing any child&apos;s personal data.</li>
              <li>Children&apos;s data is limited to what is strictly necessary for academy operations: name, date of birth, medical information, attendance, and progress records.</li>
              <li>We do not serve targeted advertising to children or use children&apos;s data for profiling purposes.</li>
              <li>Parents and guardians may request access to, correction of, or deletion of their child&apos;s data at any time.</li>
              <li>Photographs of children are only shared within the secure, authenticated academy gallery and are not publicly accessible.</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold mb-3">9. Your Data Rights</h2>
            <p className="mb-3">Under UK GDPR, you have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Right of access:</strong> request a copy of the personal data we hold about you.</li>
              <li><strong>Right to rectification:</strong> request correction of inaccurate or incomplete data.</li>
              <li><strong>Right to erasure:</strong> request deletion of your personal data (subject to legal retention requirements).</li>
              <li><strong>Right to data portability:</strong> receive your data in a structured, commonly used, machine-readable format (e.g. JSON or CSV).</li>
              <li><strong>Right to restrict processing:</strong> request that we limit how we use your data.</li>
              <li><strong>Right to object:</strong> object to processing based on legitimate interests or for direct marketing.</li>
              <li><strong>Right to withdraw consent:</strong> withdraw consent at any time where processing is based on consent.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us using the details in Section 12 below.
              We will respond to your request within 30 days.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold mb-3">10. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Active account data is retained for as long as your account remains active.</li>
              <li>Upon account closure, we retain your data for 12 months to allow for account recovery and to comply with legal obligations (e.g. financial record-keeping requirements).</li>
              <li>Payment records are retained for 7 years in accordance with HMRC requirements.</li>
              <li>After the retention period, your data is securely deleted or irreversibly anonymised.</li>
              <li>You may request early deletion of your data at any time, subject to legal retention obligations.</li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-bold mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes
              by email or through a notice on the platform. The &quot;Last updated&quot; date at the top of this page
              indicates when the policy was last revised. Continued use of the Service after changes take effect
              constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-bold mb-3">12. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, wish to exercise your data rights, or need
              to raise a concern about how your data is being handled, please contact us:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Via the Player Portal messaging system within your academy dashboard.</li>
              <li>Via email at the address provided on your academy&apos;s booking page.</li>
            </ul>
            <p className="mt-3">
              If you are not satisfied with our response, you have the right to lodge a complaint with the
              Information Commissioner&apos;s Office (ICO) at{' '}
              <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent-light transition-colors">
                ico.org.uk
              </a>.
            </p>
          </section>

        </div>

        <div className="text-center mt-8">
          <Link
            href="/auth/signup"
            className="inline-block px-8 py-3 bg-accent text-primary rounded-xl font-bold hover:bg-accent-light transition-colors"
          >
            Sign Up Now
          </Link>
        </div>
      </div>

      <footer className="border-t border-border py-6 text-center text-xs text-text-light">
        Powered by Player Portal
      </footer>
    </div>
  )
}
