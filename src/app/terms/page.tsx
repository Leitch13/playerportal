import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
}

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-primary text-white py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-white/60 text-sm hover:text-white mb-4 inline-block">&larr; Back</Link>
          <h1 className="text-3xl font-bold">Terms &amp; Conditions</h1>
          <p className="text-white/70 mt-2">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-border p-8 md:p-10 space-y-8 text-sm leading-relaxed text-text">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold mb-3">1. Introduction</h2>
            <p>
              Welcome to Player Portal. These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of the Player Portal platform
              (&quot;Service&quot;), operated by your sports academy (&quot;the Academy&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
              By creating an account, you agree to be bound by these Terms.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold mb-3">2. Account Registration</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must be at least 18 years old to create an account.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>All information provided during registration must be accurate and up to date.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately of any unauthorised use of your account.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold mb-3">3. Player Registration &amp; Parental Consent</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>By registering a child, you confirm you are their parent or legal guardian.</li>
              <li>You consent to your child participating in training sessions and activities run by the Academy.</li>
              <li>You are responsible for ensuring all medical information, allergies, and emergency contact details are accurate and kept up to date.</li>
              <li>You must inform the Academy of any changes to your child&apos;s health or circumstances that may affect their participation.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold mb-3">4. Subscriptions &amp; Payments</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Monthly subscriptions</strong> are billed automatically on the 1st of each month. Your first payment is prorated from the date you sign up to the end of the current month.</li>
              <li><strong>Quarterly payments</strong> (3 months upfront) are one-time payments covering a full quarter and include a 10% discount.</li>
              <li>All payments are processed securely through Stripe. The Academy does not store your card details.</li>
              <li>Prices are in GBP (&pound;) and may be updated with 30 days&apos; notice.</li>
              <li>Failed payments may result in suspension of your child&apos;s enrolment until payment is resolved.</li>
              <li>You are responsible for ensuring your payment method is valid and has sufficient funds.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold mb-3">5. Cancellations &amp; Refunds</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Monthly subscriptions can be cancelled at any time. Your access will continue until the end of the current billing period.</li>
              <li>Quarterly payments are non-refundable once the quarter has started, except in exceptional circumstances at the Academy&apos;s discretion.</li>
              <li>If a class is cancelled by the Academy, a credit or make-up session will be offered.</li>
              <li>No refunds will be given for missed sessions due to player absence.</li>
              <li>A minimum of 7 days&apos; notice is required for cancellation of any subscription.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold mb-3">6. Class Attendance &amp; Conduct</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Players are expected to attend sessions regularly and arrive on time.</li>
              <li>The Academy reserves the right to refuse entry to any player who is unwell or behaves inappropriately.</li>
              <li>Parents/guardians must ensure their child is collected promptly at the end of each session.</li>
              <li>The Academy is not responsible for supervision of children outside of scheduled session times.</li>
              <li>Abusive, threatening, or antisocial behaviour by parents or players will not be tolerated and may result in immediate removal from the programme without refund.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold mb-3">7. Health &amp; Safety</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Players participate at their own risk. The Academy takes reasonable precautions but cannot guarantee the prevention of injuries.</li>
              <li>You must disclose all medical conditions, injuries, and allergies during registration.</li>
              <li>In the event of an injury or medical emergency, the Academy will take reasonable steps to seek appropriate medical attention and will attempt to contact the emergency contacts on file.</li>
              <li>Players must wear appropriate sportswear and shin guards during sessions.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold mb-3">8. Photography &amp; Media</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Photographs and videos may be taken during sessions for use on the Academy&apos;s website, social media, and promotional materials.</li>
              <li>If you do not wish your child to be photographed, please inform the Academy in writing.</li>
              <li>Photos uploaded to the Player Portal gallery are visible to all members of your Academy.</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold mb-3">9. Data Protection &amp; Privacy</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We collect and process personal data in accordance with UK GDPR and the Data Protection Act 2018.</li>
              <li>Data collected includes: names, email, phone, address, medical information, payment details (processed by Stripe), attendance records, and progress reviews.</li>
              <li>Your data is stored securely and will not be shared with third parties except where required for the operation of the Service (e.g., Stripe for payment processing).</li>
              <li>You have the right to request access to, correction of, or deletion of your personal data at any time by contacting the Academy.</li>
              <li>We retain your data for as long as your account is active, plus 12 months after account closure.</li>
            </ul>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold mb-3">10. Referral Programme</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Referral rewards are at the sole discretion of the Academy.</li>
              <li>Referral rewards are only issued after the referred person has signed up and made their first payment.</li>
              <li>The Academy reserves the right to modify or discontinue the referral programme at any time.</li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-bold mb-3">11. Liability</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>The Academy accepts no liability for loss of or damage to personal property brought to sessions.</li>
              <li>The Academy&apos;s total liability in connection with these Terms shall not exceed the total fees paid by you in the 3 months preceding any claim.</li>
              <li>Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, or fraud.</li>
            </ul>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-bold mb-3">12. Changes to Terms</h2>
            <p>
              The Academy reserves the right to update these Terms at any time. We will notify you of material changes
              via email or through the Player Portal. Continued use of the Service after changes take effect constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-lg font-bold mb-3">13. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of England and Wales.
              Any disputes arising under or in connection with these Terms shall be subject to the exclusive
              jurisdiction of the courts of England and Wales.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-lg font-bold mb-3">14. Contact</h2>
            <p>
              If you have any questions about these Terms, please contact the Academy through the Player Portal
              messaging system or via the contact details provided on your Academy&apos;s booking page.
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
