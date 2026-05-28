import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, sendEmailBatch } from '@/lib/email'
import { certExpiryEmail, certExpiryAdminEmail } from '@/lib/email-templates'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const CERT_TYPES: Record<string, string> = {
  fa_coaching: 'FA Coaching Badge',
  dbs: 'DBS Check',
  first_aid: 'First Aid',
  safeguarding: 'Safeguarding',
  other: 'Other',
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportal.app'

  // Find certifications expiring within 30 days (or already expired within last 7 days)
  const now = new Date()
  const thirtyDaysOut = new Date()
  thirtyDaysOut.setDate(now.getDate() + 30)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(now.getDate() - 7)

  const { data: certs, error: certsError } = await supabase
    .from('coach_certifications')
    .select('id, name, type, expiry_date, profile_id, organisation_id')
    .not('expiry_date', 'is', null)
    .gte('expiry_date', sevenDaysAgo.toISOString().split('T')[0])
    .lte('expiry_date', thirtyDaysOut.toISOString().split('T')[0])

  if (certsError) {
    return NextResponse.json({ error: 'Failed to fetch certifications' }, { status: 500 })
  }

  const coachJobs: Parameters<typeof sendEmail>[0][] = []
  const adminJobs: Parameters<typeof sendEmail>[0][] = []

  for (const cert of certs || []) {
    const expiryDate = new Date(cert.expiry_date)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Get coach profile
    const { data: coach } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', cert.profile_id)
      .single()

    if (!coach?.email) continue

    const formattedDate = expiryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // Email the coach
    const coachTemplate = certExpiryEmail({
      coachName: coach.full_name?.split(' ')[0] || 'Coach',
      certName: cert.name,
      certType: CERT_TYPES[cert.type] || cert.type,
      expiryDate: formattedDate,
      daysUntilExpiry,
      dashboardUrl: `${appUrl}/dashboard/cpd`,
    })

    coachJobs.push({ to: coach.email, ...coachTemplate })

    // Email the org admin
    if (cert.organisation_id) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('organisation_id', cert.organisation_id)
        .eq('role', 'admin')
        .limit(3)

      for (const admin of admins || []) {
        if (!admin.email) continue
        const adminTemplate = certExpiryAdminEmail({
          adminName: admin.full_name?.split(' ')[0] || 'Admin',
          coachName: coach.full_name || 'Coach',
          certName: cert.name,
          certType: CERT_TYPES[cert.type] || cert.type,
          expiryDate: formattedDate,
          daysUntilExpiry,
          dashboardUrl: `${appUrl}/dashboard/cpd`,
        })

        adminJobs.push({ to: admin.email, ...adminTemplate })
      }
    }

    // Update status in DB
    const newStatus = daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry <= 30 ? 'expiring' : 'active'
    await supabase
      .from('coach_certifications')
      .update({ status: newStatus })
      .eq('id', cert.id)
  }

  const coachBatch = await sendEmailBatch(coachJobs)
  const adminBatch = await sendEmailBatch(adminJobs)
  const coachEmails = coachBatch.sent
  const adminEmails = adminBatch.sent
  const errors = coachBatch.failed + adminBatch.failed

  return NextResponse.json({
    certsChecked: (certs || []).length,
    coachEmails,
    adminEmails,
    errors,
  })
}
