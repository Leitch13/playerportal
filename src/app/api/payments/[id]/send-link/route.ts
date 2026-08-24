import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────
// POST /api/payments/[id]/send-link
//
// Admin-only: email the parent a link to pay a single one-off invoice.
//
// Raising an invoice ("+ Add Payment") writes a ledger row and nothing else —
// no notification has ever been sent, which is why invoices raised in
// production sat unpaid indefinitely. This is the missing "send it" step.
//
// SAFETY: sends an email and stamps `notes` for an audit trail. It performs
// ZERO Stripe calls and never alters amount, status or any subscription.
// ─────────────────────────────────────────────────────────────────────────

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  // ── AuthN + AuthZ — signed-in admin of the owning academy only ──
  const supa = await createServerClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

  const { data: role } = await supa.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only academy admins can send payment links.' }, { status: 403 })
  }
  const { data: orgId } = await supa.rpc('get_my_org')
  if (!orgId) {
    return NextResponse.json({ error: 'Your account is not linked to an academy.' }, { status: 400 })
  }

  const db = adminDb()

  const { data: payment } = await db
    .from('payments')
    .select(
      'id, amount, amount_paid, status, description, organisation_id, notes, parent:profiles!payments_parent_id_fkey(full_name, email)'
    )
    .eq('id', id)
    .maybeSingle()

  if (!payment) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  // Tenant isolation — an admin may only touch their own academy's invoices.
  if (payment.organisation_id !== orgId) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
  }

  if (payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'waived') {
    return NextResponse.json({ error: 'This invoice is already settled.' }, { status: 400 })
  }

  const parent = payment.parent as unknown as { full_name: string | null; email: string | null } | null
  if (!parent?.email) {
    return NextResponse.json({ error: 'No email on file for this parent.' }, { status: 400 })
  }

  const remaining = Number(payment.amount) - Number(payment.amount_paid || 0)
  if (!(remaining > 0)) {
    return NextResponse.json({ error: 'There is nothing left to pay on this invoice.' }, { status: 400 })
  }

  const { data: org } = await db
    .from('organisations')
    .select('name, primary_color, contact_email')
    .eq('id', orgId)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  const payUrl = `${appUrl}/pay/${payment.id}`
  const primary = org?.primary_color || '#4ecde6'
  const academyName = org?.name || 'your academy'
  const firstName = (parent.full_name || '').split(' ')[0] || 'there'
  const amountLabel = `£${remaining.toFixed(2)}`
  const what = payment.description || 'Amount due'

  const html = `
<!DOCTYPE html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;">
    <div style="padding:26px 32px;background:${primary};color:#0a0a0a;">
      <h1 style="margin:0;font-size:19px;font-weight:800;">${escapeHtml(academyName)}</h1>
    </div>
    <div style="padding:28px 32px;color:#1a1a1a;line-height:1.6;">
      <p style="margin:0 0 14px;font-size:15px;">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 20px;font-size:15px;">${escapeHtml(academyName)} has sent you a payment request.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 22px;font-size:15px;">
        <tr>
          <td style="padding:12px 0;border-top:1px solid #ececec;color:#555;">${escapeHtml(what)}</td>
          <td style="padding:12px 0;border-top:1px solid #ececec;text-align:right;font-weight:700;">${amountLabel}</td>
        </tr>
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="${payUrl}" style="background:${primary};color:#0a0a0a;padding:14px 34px;text-decoration:none;border-radius:999px;font-weight:700;display:inline-block;font-size:15px;">Pay ${amountLabel}</a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#888;">Paying takes about 30 seconds — no account needed. Questions? Just reply to this email.</p>
    </div>
  </div>
</body></html>`

  try {
    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: parent.email,
      subject: `${academyName}: ${amountLabel} payment request`,
      html,
      fromName: academyName,
      replyTo: org?.contact_email || undefined,
    })
  } catch (err) {
    console.error('[payments/send-link] email failed:', err)
    return NextResponse.json({ error: 'Could not send the email. Please try again.' }, { status: 502 })
  }

  // Audit trail — append to notes so the academy can see it was sent and when.
  const stamp = `Payment link emailed to ${parent.email} on ${new Date().toISOString().split('T')[0]}`
  await db
    .from('payments')
    .update({
      notes: payment.notes ? `${payment.notes}\n${stamp}` : stamp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  return NextResponse.json({ status: 'sent', to: parent.email })
}
