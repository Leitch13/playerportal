/**
 * Sprint 10 — printable camp register.
 *
 * Plain HTML, print-friendly stylesheet. Coaches print this and take it
 * to the venue. Includes:
 *   • Child name
 *   • Age
 *   • Parent name
 *   • Parent phone
 *   • Medical flag (full text — coaches need the detail, not just a badge)
 *   • Signature column for paper check-in
 *
 * NO navigation, no header chrome — when printed, only the register
 * itself is on the page.
 *
 * Reads from camp_bookings directly. Forward-compatible with missing
 * `booking_source` column (Sprint 9 migration 081 may not be applied).
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireFeature } from '@/lib/features'
import PrintButton from './PrintButton'

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  if (start === end) {
    return s.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} → ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`
}

export default async function CampPrintRegisterPage({
  params,
}: {
  params: Promise<{ campId: string }>
}) {
  const { campId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')
  await requireFeature('camps')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organisation_id')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'coach'].includes(profile.role as string)) {
    redirect('/dashboard')
  }
  const orgId = profile.organisation_id as string

  const { data: camp } = await supabase
    .from('camps')
    .select('id, organisation_id, name, start_date, end_date, location')
    .eq('id', campId)
    .maybeSingle()
  if (!camp || camp.organisation_id !== orgId) redirect('/dashboard/camps')

  const { data: orgRow } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()
  const academyName = (orgRow as { name?: string | null } | null)?.name || ''

  type Row = {
    id: string
    child_name: string | null
    child_age: number | null
    parent_name: string | null
    parent_phone: string | null
    medical_info: string | null
    payment_status: string
  }
  const { data: bookingsRaw } = await supabase
    .from('camp_bookings')
    .select('id, child_name, child_age, parent_name, parent_phone, medical_info, payment_status')
    .eq('camp_id', campId)
    .eq('organisation_id', orgId)
    .in('payment_status', ['paid', 'pending'])
    .order('child_name', { ascending: true })

  const rows = ((bookingsRaw || []) as Row[]).sort((a, b) =>
    (a.child_name || '').localeCompare(b.child_name || ''),
  )

  return (
    <>
      {/* Print stylesheet — strips dashboard chrome, paginates cleanly,
          forces white background + black ink so coaches get a readable
          paper register. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-table { break-inside: auto; }
          .print-table tr { break-inside: avoid; break-after: auto; }
        }
        .print-register { background: #fff; color: #000; min-height: 100vh; padding: 24px; font-family: -apple-system, system-ui, sans-serif; }
        .print-register h1 { font-size: 22px; margin: 0 0 4px; }
        .print-register .sub { color: #444; font-size: 13px; margin: 0 0 16px; }
        .print-register table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .print-register th { background: #f3f3f3; text-align: left; padding: 8px; border: 1px solid #999; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        .print-register td { padding: 8px; border: 1px solid #ccc; vertical-align: top; }
        .print-register td.signature { width: 22%; }
        .print-register td.medical { color: #b00020; font-weight: 600; }
        .print-register .medical-empty { color: #999; font-weight: 400; }
        .print-register .toolbar { margin-bottom: 16px; }
        .print-register .toolbar button { background: #4ecde6; color: #000; border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
      `}</style>

      <div className="print-register">
        <div className="toolbar no-print">
          <PrintButton />
        </div>

        <h1>{camp.name as string} — register</h1>
        <p className="sub">
          {fmtDateRange(camp.start_date as string, camp.end_date as string)}
          {camp.location ? ` · ${camp.location}` : ''}
          {academyName ? ` · ${academyName}` : ''}
          {' · '}{rows.length} child{rows.length === 1 ? '' : 'ren'}
        </p>

        {rows.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>No active bookings on this camp.</p>
        ) : (
          <table className="print-table" data-testid="print-register-table">
            <thead>
              <tr>
                <th style={{ width: '4%' }}>#</th>
                <th style={{ width: '22%' }}>Child</th>
                <th style={{ width: '4%' }}>Age</th>
                <th style={{ width: '20%' }}>Parent</th>
                <th style={{ width: '14%' }}>Phone</th>
                <th style={{ width: '20%' }}>Medical</th>
                <th style={{ width: '16%' }}>Signature</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const hasMedical = !!(r.medical_info && r.medical_info.trim())
                return (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.child_name || '—'}</td>
                    <td>{r.child_age != null ? r.child_age : '—'}</td>
                    <td>{r.parent_name || '—'}</td>
                    <td>{r.parent_phone || '—'}</td>
                    <td className={hasMedical ? 'medical' : ''}>
                      {hasMedical ? (r.medical_info as string) : <span className="medical-empty">None</span>}
                    </td>
                    <td className="signature">{/* empty for sign-in */}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <p className="sub" style={{ marginTop: 24, fontSize: 11, color: '#888' }}>
          Printed via Player Portal. Medical column reflects what the parent supplied at booking.
          For emergencies, contact the parent on the phone number above.
        </p>
      </div>
    </>
  )
}
