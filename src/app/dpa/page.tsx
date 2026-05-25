import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Processing Agreement — Player Portal',
  description: 'Data Processing Agreement between Player Portal and subscribing organisations.',
}

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-primary text-white py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-white/60 text-sm hover:text-white mb-4 inline-block">&larr; Back</Link>
          <h1 className="text-3xl font-bold">Data Processing Agreement</h1>
          <p className="text-white/70 mt-2">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-border p-8 md:p-10 space-y-8 text-sm leading-relaxed text-text">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-xs">
            <strong>Note:</strong> This is a template Data Processing Agreement. It is provided for informational purposes and should be reviewed by a qualified legal professional before use.
          </div>

          {/* Parties */}
          <section>
            <h2 className="text-lg font-bold mb-3">1. Parties</h2>
            <p>This Data Processing Agreement (&quot;DPA&quot;) forms part of the agreement between:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Data Controller:</strong> The subscribing organisation (&quot;Academy&quot;, &quot;you&quot;, &quot;your&quot;) that has signed up for a Player Portal account.</li>
              <li><strong>Data Processor:</strong> Player Portal, operated by JSL Sports Technology Ltd (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), provider of the Player Portal platform.</li>
            </ul>
            <p className="mt-2">This DPA is incorporated into and subject to the Player Portal <Link href="/terms" className="text-primary underline">Terms &amp; Conditions</Link>.</p>
          </section>

          {/* Definitions */}
          <section>
            <h2 className="text-lg font-bold mb-3">2. Definitions</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>&quot;Personal Data&quot;</strong> means any information relating to an identified or identifiable natural person, as defined in the UK GDPR.</li>
              <li><strong>&quot;Processing&quot;</strong> means any operation performed on Personal Data, including collection, recording, organisation, storage, adaptation, retrieval, use, disclosure, erasure, or destruction.</li>
              <li><strong>&quot;Data Subject&quot;</strong> means the identified or identifiable person to whom the Personal Data relates, including players, parents, guardians, and coaching staff.</li>
              <li><strong>&quot;Sub-processor&quot;</strong> means any third party engaged by the Processor to process Personal Data on behalf of the Controller.</li>
              <li><strong>&quot;Data Breach&quot;</strong> means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, Personal Data.</li>
            </ul>
          </section>

          {/* Scope */}
          <section>
            <h2 className="text-lg font-bold mb-3">3. Scope &amp; Purpose of Processing</h2>
            <p>We process Personal Data solely for the purpose of providing the Player Portal platform to the Academy. This includes:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Managing player registrations, enrolments, and attendance records</li>
              <li>Storing player profiles including name, date of birth, age group, and medical information</li>
              <li>Managing parent/guardian contact details and communications</li>
              <li>Processing payments and financial records via Stripe</li>
              <li>Generating progress reports and performance reviews</li>
              <li>Sending transactional emails (booking confirmations, progress reports, notifications)</li>
              <li>Providing analytics and reporting to Academy administrators</li>
            </ul>
          </section>

          {/* Categories of data */}
          <section>
            <h2 className="text-lg font-bold mb-3">4. Categories of Personal Data</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm mt-2">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold">Data Subject</th>
                    <th className="text-left py-2 font-semibold">Categories of Data</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-3 pr-4 align-top font-medium">Players (Children)</td>
                    <td className="py-3">Name, date of birth, age group, medical information, emergency contacts, attendance records, performance reviews, skill assessments, photographs (if uploaded)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 pr-4 align-top font-medium">Parents / Guardians</td>
                    <td className="py-3">Name, email address, phone number, postal address, payment information (processed by Stripe), communication preferences</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 pr-4 align-top font-medium">Coaches / Staff</td>
                    <td className="py-3">Name, email address, phone number, role, qualifications, session records</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3"><strong>Special Category Data:</strong> Medical information provided for players is classified as special category data under UK GDPR. This data is processed with explicit consent from the parent/guardian and is necessary for the legitimate interest of safeguarding the child during sporting activities.</p>
          </section>

          {/* Processor obligations */}
          <section>
            <h2 className="text-lg font-bold mb-3">5. Processor Obligations</h2>
            <p>As Data Processor, Player Portal shall:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Process Personal Data only on documented instructions from the Controller, unless required by law</li>
              <li>Ensure that persons authorised to process Personal Data have committed to confidentiality</li>
              <li>Implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including:
                <ul className="list-disc pl-6 mt-1 space-y-1">
                  <li>Encryption of data in transit (TLS/SSL) and at rest</li>
                  <li>Row-level security (RLS) ensuring data isolation between organisations</li>
                  <li>Role-based access controls (admin, coach, parent)</li>
                  <li>Regular security updates and monitoring</li>
                  <li>Secure authentication via Supabase Auth with email verification</li>
                </ul>
              </li>
              <li>Not engage another processor (sub-processor) without prior written authorisation from the Controller</li>
              <li>Assist the Controller in responding to Data Subject rights requests</li>
              <li>Delete or return all Personal Data upon termination of the agreement, at the Controller&apos;s choice</li>
              <li>Make available to the Controller all information necessary to demonstrate compliance with GDPR obligations</li>
            </ul>
          </section>

          {/* Sub-processors */}
          <section>
            <h2 className="text-lg font-bold mb-3">6. Sub-processors</h2>
            <p>The Controller authorises the use of the following sub-processors:</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm mt-2">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold">Sub-processor</th>
                    <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                    <th className="text-left py-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Supabase</td>
                    <td className="py-2 pr-4">Database hosting, authentication, file storage</td>
                    <td className="py-2">EU (Frankfurt) / US</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Vercel</td>
                    <td className="py-2 pr-4">Application hosting and deployment</td>
                    <td className="py-2">Global (Edge)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Stripe</td>
                    <td className="py-2 pr-4">Payment processing</td>
                    <td className="py-2">US / EU</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Resend</td>
                    <td className="py-2 pr-4">Transactional email delivery</td>
                    <td className="py-2">US</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">Where sub-processors are located outside the UK, appropriate safeguards are in place (such as Standard Contractual Clauses or UK adequacy decisions) to ensure an adequate level of data protection.</p>
          </section>

          {/* Data subject rights */}
          <section>
            <h2 className="text-lg font-bold mb-3">7. Data Subject Rights</h2>
            <p>We will assist the Academy in fulfilling Data Subject rights requests, including:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Right of access</strong> — providing copies of Personal Data held</li>
              <li><strong>Right to rectification</strong> — correcting inaccurate data</li>
              <li><strong>Right to erasure</strong> — deleting data when no longer necessary</li>
              <li><strong>Right to restriction</strong> — restricting processing in certain circumstances</li>
              <li><strong>Right to data portability</strong> — providing data in a structured, machine-readable format (JSON/CSV export)</li>
              <li><strong>Right to object</strong> — ceasing processing where applicable</li>
            </ul>
            <p className="mt-2">The Academy, as Data Controller, is responsible for responding to Data Subject requests. Player Portal will provide reasonable technical assistance within 5 working days of receiving a request from the Academy.</p>
          </section>

          {/* Data breach */}
          <section>
            <h2 className="text-lg font-bold mb-3">8. Data Breach Notification</h2>
            <p>In the event of a Data Breach, Player Portal shall:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Notify the Academy without undue delay and in any event within <strong>24 hours</strong> of becoming aware of the breach</li>
              <li>Provide the Academy with sufficient information to enable it to meet its obligations under Articles 33 and 34 of the UK GDPR, including:
                <ul className="list-disc pl-6 mt-1 space-y-1">
                  <li>The nature of the breach and categories of data affected</li>
                  <li>The approximate number of Data Subjects affected</li>
                  <li>The likely consequences of the breach</li>
                  <li>Measures taken or proposed to address the breach</li>
                </ul>
              </li>
              <li>Cooperate with the Academy and take reasonable steps to mitigate the effects of the breach</li>
            </ul>
          </section>

          {/* Data retention */}
          <section>
            <h2 className="text-lg font-bold mb-3">9. Data Retention &amp; Deletion</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Personal Data is retained for the duration of the Academy&apos;s active subscription.</li>
              <li>Upon termination or expiry of the subscription, the Academy may export all data via the platform&apos;s built-in export feature (JSON or CSV format).</li>
              <li>Following termination, Personal Data will be deleted within <strong>30 days</strong> unless retention is required by applicable law.</li>
              <li>The Academy may request early deletion of specific records at any time by contacting Player Portal support.</li>
              <li>Anonymised and aggregated data (which cannot identify individuals) may be retained for analytical purposes.</li>
            </ul>
          </section>

          {/* Children's data */}
          <section>
            <h2 className="text-lg font-bold mb-3">10. Children&apos;s Data &amp; Safeguarding</h2>
            <p>Player Portal recognises the sensitive nature of processing children&apos;s data and implements the following safeguards:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Children&apos;s accounts are always linked to a parent/guardian account — children cannot create accounts independently</li>
              <li>Parental consent is obtained during registration for the processing of their child&apos;s data</li>
              <li>Medical information is only accessible to authorised Academy staff (admins and coaches)</li>
              <li>Player photographs and media are stored securely and only visible within the Academy&apos;s organisation</li>
              <li>Data minimisation principles are applied — only necessary data is collected</li>
              <li>The Academy remains responsible for obtaining and maintaining appropriate consent from parents/guardians</li>
            </ul>
          </section>

          {/* International transfers */}
          <section>
            <h2 className="text-lg font-bold mb-3">11. International Data Transfers</h2>
            <p>Where Personal Data is transferred outside the United Kingdom, Player Portal ensures that:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Transfers are made to countries with an adequate level of protection as determined by the UK Secretary of State, or</li>
              <li>Appropriate safeguards are in place, such as the International Data Transfer Agreement (IDTA) or UK Addendum to EU Standard Contractual Clauses</li>
              <li>All sub-processors maintain appropriate data protection certifications and agreements</li>
            </ul>
          </section>

          {/* Audit */}
          <section>
            <h2 className="text-lg font-bold mb-3">12. Audit Rights</h2>
            <p>The Academy shall have the right to audit Player Portal&apos;s compliance with this DPA, subject to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Providing at least 30 days&apos; written notice</li>
              <li>Audits being conducted during normal business hours</li>
              <li>The Academy bearing the costs of any audit</li>
              <li>Confidentiality obligations applying to all information obtained during the audit</li>
            </ul>
            <p className="mt-2">Player Portal may satisfy audit requests by providing relevant compliance documentation, certifications, or reports from independent assessors.</p>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-lg font-bold mb-3">13. Liability</h2>
            <p>Each party&apos;s liability under this DPA shall be subject to the limitations and exclusions set out in the main Terms &amp; Conditions. Nothing in this DPA shall limit either party&apos;s liability for breaches of data protection law caused by its own negligence or wilful misconduct.</p>
          </section>

          {/* Term */}
          <section>
            <h2 className="text-lg font-bold mb-3">14. Term &amp; Termination</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>This DPA shall come into effect on the date the Academy creates a Player Portal account and shall remain in effect for the duration of the subscription.</li>
              <li>Obligations relating to data deletion, confidentiality, and cooperation shall survive termination.</li>
              <li>Either party may terminate this DPA if the other party materially breaches its obligations and fails to remedy the breach within 30 days of written notice.</li>
            </ul>
          </section>

          {/* Governing law */}
          <section>
            <h2 className="text-lg font-bold mb-3">15. Governing Law</h2>
            <p>This DPA shall be governed by and construed in accordance with the laws of England and Wales. Any disputes arising from this DPA shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-bold mb-3">16. Contact</h2>
            <p>For any queries regarding this Data Processing Agreement or data protection matters, please contact:</p>
            <div className="bg-gray-50 rounded-xl p-4 mt-2">
              <p><strong>Player Portal — Data Protection</strong></p>
              <p>Email: privacy@theplayerportal.net</p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="flex gap-4 justify-center mt-8 text-sm text-text/50">
          <Link href="/terms" className="hover:text-primary">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
