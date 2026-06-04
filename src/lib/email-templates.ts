// Base layout wrapper — premium dark theme.
// Email clients vary wildly in CSS support, so this uses inline styles + tables
// where needed for maximum compatibility (Gmail, Outlook, iOS Mail, Spark, etc.)
//
// `academyName` lets transactional emails branded for a specific academy
// show that academy's name in the header + footer instead of generic
// "Player Portal". The platform tag ("by JSL Sports") stays on the header
// for trust, and the footer always carries the legal entity for compliance.
function baseLayout(content: string, accentColor = '#4ecde6', academyName?: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  const heroName = academyName ? escapeHtml(academyName) : 'Player Portal'
  const footerName = academyName ? escapeHtml(academyName) : 'Player Portal'
  const platformTag = academyName ? 'Powered by Player Portal' : 'by JSL Sports'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060606;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#060606">
<tr><td align="center" style="padding:24px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px">

<!-- Header card -->
<tr><td style="background:linear-gradient(135deg, #0a0a0a 0%, #141414 60%, ${accentColor}15 100%);border-radius:20px 20px 0 0;padding:32px 36px;text-align:center;border:1px solid #1e1e1e;border-bottom:0">
<div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:${accentColor};margin:0">⚽ ${heroName}</div>
<div style="margin:8px 0 0;color:#666;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600">${platformTag}</div>
</td></tr>

<!-- Brand accent line -->
<tr><td style="height:3px;background:linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%);font-size:0;line-height:0">&nbsp;</td></tr>

<!-- Main content -->
<tr><td style="background:#141414;padding:36px;border:1px solid #1e1e1e;border-top:0;border-bottom:0;color:#e5e5e5;line-height:1.6">
${content}
</td></tr>

<!-- Bottom rounded corner -->
<tr><td style="background:#141414;height:20px;border-radius:0 0 20px 20px;border:1px solid #1e1e1e;border-top:0;font-size:0;line-height:0">&nbsp;</td></tr>

<!-- Footer -->
<tr><td align="center" style="padding:20px 16px 0">
<div style="color:#777;font-size:13px;font-weight:500">Sent by <a href="${appUrl}" style="color:${accentColor};text-decoration:none;font-weight:600">${footerName}</a></div>
<div style="margin:8px 0 0;color:#444;font-size:11px;line-height:1.5">You&apos;re receiving this because you have an account with ${footerName}.</div>
<div style="margin:6px 0 0;color:#333;font-size:11px">&copy; 2026 JSL Sports Technology Ltd. All rights reserved.</div>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

// Minimal HTML escape so academy names with <, >, &, ", ' don't break the
// markup or open injection holes via the (admin-set) academy name.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Day 1 — Message-notification email.
 *
 * Sent when an academy admin/coach sends an in-app message to a parent.
 * The parent receives the actual message content in their inbox so they
 * don't need to log into the dashboard to read it.
 *
 * Replies are NOT yet wired (no inbound email parsing). The CTA links to
 * the parent's dashboard messages where they can read context + reply
 * in-app.
 */
export function messageNotificationEmail(params: {
  senderName: string
  recipientName: string
  subject: string | null
  body: string
  academyName: string
  dashboardUrl: string
  accentColor?: string
}): { subject: string; html: string } {
  const accent = params.accentColor || '#4ecde6'
  const escapedBody = escapeHtml(params.body).replace(/\n/g, '<br>')
  const displaySubject = params.subject?.trim() || `New message from ${params.academyName}`
  const content = `
    <p style="margin:0 0 8px;color:#999;font-size:13px;font-weight:500">Hi ${escapeHtml(params.recipientName)},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#e5e5e5">
      <strong style="color:${accent}">${escapeHtml(params.senderName)}</strong> sent you a message via <strong>${escapeHtml(params.academyName)}</strong>.
    </p>
    ${params.subject ? `<div style="margin:0 0 8px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#666;font-weight:600">Subject</div><h2 style="margin:0 0 24px;font-size:18px;color:#fff;font-weight:700;line-height:1.4">${escapeHtml(params.subject)}</h2>` : ''}
    <div style="background:#0a0a0a;border-left:3px solid ${accent};border-radius:0 12px 12px 0;padding:20px 24px;margin:0 0 28px;font-size:15px;color:#e5e5e5;line-height:1.65">${escapedBody}</div>
    ${ctaButton('Open in Player Portal', params.dashboardUrl, accent)}
    <p style="margin:24px 0 0;color:#666;font-size:12px;line-height:1.5;text-align:center">Replies are not yet supported by return email. Tap the button above to reply in-app.</p>
  `
  return {
    subject: displaySubject,
    html: baseLayout(content, accent, params.academyName),
  }
}

/**
 * Helper to render a premium-styled CTA button inside an email.
 * White background + brand-color glow — matches the in-app button pattern.
 * Use this instead of inline links for primary CTAs.
 */
function ctaButton(text: string, href: string, accentColor = '#4ecde6'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto"><tr><td style="border-radius:999px;background:#ffffff;box-shadow:0 8px 32px ${accentColor}66"><a href="${href}" style="display:inline-block;padding:14px 32px;color:#0a0a0a;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:-0.2px;border-radius:999px">${text} &rarr;</a></td></tr></table>`
}

export function trialConfirmationEmail(params: {
  parentName: string
  childName: string
  academyName: string
  className?: string
  date?: string
}) {
  return {
    subject: `Trial session confirmed — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">You're booked in!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">We've received your free trial booking for <strong>${params.childName}</strong> at <strong>${params.academyName}</strong>.</p>
      ${params.className ? `<div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#aaa"><strong>Class:</strong> ${params.className}</p>
        ${params.date ? `<p style="margin:8px 0 0;font-size:14px;color:#aaa"><strong>Preferred date:</strong> ${params.date}</p>` : ''}
      </div>` : ''}
      <p style="color:#aaa;line-height:1.6">The academy will be in touch to confirm the details. Just turn up, have fun, and see if it's the right fit!</p>
      <p style="color:#666;font-size:13px;margin-top:24px">No payment required for the trial session.</p>
    `),
  }
}

export function waitlistOfferEmail(params: {
  parentName: string
  childName: string
  className: string
  expiresAt: string
  dashboardUrl: string
}) {
  return {
    subject: `A spot has opened up for ${params.childName}!`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Good news!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">A spot has opened up in <strong>${params.className}</strong> for <strong>${params.childName}</strong>!</p>
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#92400e"><strong>You have 48 hours to accept.</strong> This offer expires ${params.expiresAt}.</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">Accept Spot</a>
      </div>
      <p style="color:#666;font-size:13px">If you don't respond in time, the spot will be offered to the next family.</p>
    `),
  }
}

export function waitlistSpotAvailableEmail(params: {
  parentName: string
  childName: string
  className: string
  acceptUrl: string
  declineUrl: string
  expiryDate: string
}) {
  return {
    subject: `A spot has opened up in ${params.className}!`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Great news!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">A spot has opened up in <strong>${params.className}</strong> for <strong>${params.childName}</strong>!</p>
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#92400e"><strong>You have 48 hours to accept this offer.</strong></p>
        <p style="margin:8px 0 0;font-size:13px;color:#92400e">Expires: ${params.expiryDate}</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.acceptUrl}" style="display:inline-block;background:#22c55e;color:#ffffff;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px;margin-right:12px">Accept Spot</a>
        <a href="${params.declineUrl}" style="display:inline-block;background:#333;color:#aaa;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">Decline</a>
      </div>
      <p style="color:#666;font-size:13px">If you don't respond in time, the spot will be offered to the next family on the waitlist.</p>
    `),
  }
}

export function waitlistAcceptedEmail(params: {
  parentName: string
  childName: string
  className: string
}) {
  return {
    subject: `You're in! ${params.childName} is enrolled in ${params.className}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">You're in!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong> has been successfully enrolled in <strong>${params.className}</strong>.</p>
      <div style="background:#052e16;border:1px solid #22c55e;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#86efac"><strong>Enrolment confirmed.</strong> You can view details in your dashboard.</p>
      </div>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:14px;color:#ddd;font-weight:600">What to bring</p>
        <p style="margin:0 0 4px;font-size:14px;color:#aaa">Football boots, shin pads, water bottle, and a good attitude!</p>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">See you on the pitch!</p>
    `),
  }
}

export function waitlistExpiredEmail(params: {
  parentName: string
  childName: string
  className: string
}) {
  return {
    subject: `Your waitlist offer for ${params.className} has expired`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Offer Expired</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">Unfortunately, the 48-hour window to accept the spot in <strong>${params.className}</strong> for <strong>${params.childName}</strong> has passed.</p>
      <div style="background:#1c1917;border:1px solid #78716c;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#a8a29e">The spot has been offered to the next family on the waitlist.</p>
      </div>
      <p style="color:#aaa;line-height:1.6">If you'd still like a place, you can rejoin the waitlist from your dashboard. We'll let you know as soon as another spot opens up.</p>
      <p style="color:#666;font-size:13px;text-align:center">We hope to see ${params.childName} on the pitch soon!</p>
    `),
  }
}

export function waitlistDeclinedEmail(params: {
  parentName: string
  childName: string
  className: string
}) {
  return {
    subject: `Waitlist spot declined — ${params.className}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">No worries!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">We've noted that you've declined the spot in <strong>${params.className}</strong> for <strong>${params.childName}</strong>. No problem at all.</p>
      <p style="color:#aaa;line-height:1.6">If you change your mind or would like to join a different class, you can always browse available options in your dashboard.</p>
      <p style="color:#666;font-size:13px;text-align:center">We hope to see ${params.childName} at a future session!</p>
    `),
  }
}

export function paymentReminderEmail(params: {
  parentName: string
  amount: string
  daysOverdue: number
  planName: string
  dashboardUrl: string
}) {
  const urgency = params.daysOverdue >= 14 ? 'final' : params.daysOverdue >= 7 ? 'second' : 'friendly'
  const colors = {
    friendly: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    second: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    final: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  }
  const c = colors[urgency]

  return {
    subject: urgency === 'final'
      ? `Final reminder: Payment overdue — ${params.planName}`
      : `Payment reminder — ${params.planName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">${urgency === 'friendly' ? 'Payment Reminder' : urgency === 'second' ? 'Payment Overdue' : 'Final Notice'}</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <div style="background:${c.bg};border:1px solid ${c.border};border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:${c.text}"><strong>${params.amount}</strong> is overdue for <strong>${params.planName}</strong> (${params.daysOverdue} days).</p>
      </div>
      <p style="color:#aaa;line-height:1.6">Please update your payment to keep your child's place in the class.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">Make Payment</a>
      </div>
      <p style="color:#666;font-size:13px">If you've already paid, please ignore this email.</p>
    `),
  }
}

export function announcementEmail(params: {
  parentName: string
  title: string
  body: string
  priority: string
  academyName: string
  dashboardUrl: string
}) {
  const borderColor = params.priority === 'urgent' ? '#ef4444' : params.priority === 'important' ? '#f59e0b' : '#4ecde6'
  return {
    subject: `${params.title} — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">${params.title}</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <div style="border-left:4px solid ${borderColor};padding:16px;background:#f8f9fa;border-radius:0 12px 12px 0;margin:20px 0">
        <p style="margin:0;color:#333;line-height:1.6;white-space:pre-wrap">${params.body}</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:12px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px">View in Dashboard</a>
      </div>
      <p style="color:#999;font-size:12px">From ${params.academyName}</p>
    `, borderColor),
  }
}

export function welcomeEmail(params: {
  parentName: string
  academyName: string
  dashboardUrl: string
  academyLogoUrl?: string
  academyContactEmail?: string
  firstName?: string  // Just first name for greeting
}) {
  const greetingName = params.firstName || params.parentName.split(' ')[0] || params.parentName
  return {
    subject: `Welcome to ${params.academyName} ⚽`,
    html: baseLayout(`
      ${params.academyLogoUrl ? `<div style="text-align:center;margin-bottom:24px"><img src="${params.academyLogoUrl}" alt="${params.academyName}" style="max-width:120px;max-height:120px;border-radius:16px" /></div>` : ''}
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:24px">Welcome, ${greetingName}! 👋</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.6">You're in. Your <strong style="color:#fff">${params.academyName}</strong> account is set up and ready to go.</p>

      <div style="background:linear-gradient(135deg,rgba(78,205,230,0.08),rgba(78,205,230,0.02));border:1px solid rgba(78,205,230,0.2);border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 14px;font-size:14px;color:#4ecde6;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Get started in 3 steps</p>
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr>
            <td style="width:28px;vertical-align:top;padding-right:8px"><span style="display:inline-block;width:24px;height:24px;background:#4ecde6;color:#0a0a0a;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px">1</span></td>
            <td style="color:#ddd;line-height:1.5"><strong style="color:#fff">Add your child's details</strong><br><span style="color:#999;font-size:13px">Photo, age group, anything the coach should know.</span></td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding-right:8px"><span style="display:inline-block;width:24px;height:24px;background:#4ecde6;color:#0a0a0a;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px">2</span></td>
            <td style="color:#ddd;line-height:1.5"><strong style="color:#fff">Pick a class &amp; subscription</strong><br><span style="color:#999;font-size:13px">Browse the timetable, choose what works for you.</span></td>
          </tr>
          <tr>
            <td style="vertical-align:top;padding-right:8px"><span style="display:inline-block;width:24px;height:24px;background:#4ecde6;color:#0a0a0a;border-radius:50%;text-align:center;line-height:24px;font-weight:700;font-size:12px">3</span></td>
            <td style="color:#ddd;line-height:1.5"><strong style="color:#fff">Show up &amp; have fun</strong><br><span style="color:#999;font-size:13px">We'll send reminders before every session.</span></td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:28px 0 12px">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:16px 36px;border-radius:14px;font-weight:700;text-decoration:none;font-size:16px;box-shadow:0 8px 24px rgba(78,205,230,0.3)">Open your dashboard →</a>
      </div>

      <p style="color:#777;font-size:13px;line-height:1.6;margin:24px 0 0;text-align:center">
        💡 <strong style="color:#aaa">Pro tip:</strong> Add Player Portal to your home screen so it works like an app.
      </p>

      ${params.academyContactEmail ? `<p style="color:#666;font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center;padding-top:16px;border-top:1px solid #1e1e1e">Questions? Email the academy direct at <a href="mailto:${params.academyContactEmail}" style="color:#4ecde6">${params.academyContactEmail}</a>.</p>` : ''}
    `),
  }
}

/**
 * Billing context for subscriptionStartedEmail.
 *
 * - 'bridge': parent paid an upfront bridge charge at Checkout (session-bridge
 *   plans). Body explains the bridge covers N sessions until the anchor and
 *   the recurring monthly amount kicks in on the 1st.
 * - 'prorated': parent paid a calendar-day prorated charge today (Stage 2
 *   immediate_prorated path). Body explains the proration and the £X/month
 *   anchor on the 1st.
 * - undefined: legacy behaviour — just shows "Charged: £X".
 */
export type SubscriptionStartedBillingContext =
  | {
      kind: 'bridge'
      sessionsRemaining: number
      bridgeUntilLabel: string  // e.g. "30 June 2026" (day BEFORE anchor)
      anchorLabel: string       // e.g. "1 July 2026"
      monthlyAmount: string     // e.g. "£120.00"
    }
  | {
      kind: 'prorated'
      anchorLabel: string       // e.g. "1 July 2026"
      monthlyAmount: string
    }

export function subscriptionStartedEmail(params: {
  parentName: string
  childName?: string
  academyName: string
  planName: string
  amount: string
  nextClass?: { name: string; day: string; time: string; location?: string }
  dashboardUrl: string
  academyLogoUrl?: string
  academyContactEmail?: string
  billingContext?: SubscriptionStartedBillingContext
}) {
  const greetingName = params.parentName.split(' ')[0] || params.parentName
  const bc = params.billingContext

  // Billing-context-aware breakdown panel. Renders one of three variants:
  //   - bridge: "Today £X covers N sessions before <anchor>, then £Y/mo"
  //   - prorated: "Today £X is a pro-rata charge until <anchor>, then £Y/mo"
  //   - undefined: legacy "Charged: £X" single-row table
  const breakdownPanel = (() => {
    if (bc?.kind === 'bridge') {
      const s = bc.sessionsRemaining === 1 ? 'session' : 'sessions'
      return `
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:12px;color:#4ecde6;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">💳 Your billing</p>
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Plan</td><td style="color:#fff;text-align:right;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#888">Paid today</td><td style="color:#fff;text-align:right;font-weight:600">${params.amount}</td></tr>
          <tr><td colspan="2" style="color:#aaa;padding-top:0;padding-bottom:8px;font-size:13px">↳ covers your ${bc.sessionsRemaining} remaining ${s} until ${bc.bridgeUntilLabel}</td></tr>
          <tr><td style="color:#888;border-top:1px solid #2a2a2a;padding-top:12px">From ${bc.anchorLabel}</td><td style="color:#fff;text-align:right;font-weight:600;border-top:1px solid #2a2a2a;padding-top:12px">${bc.monthlyAmount}/month</td></tr>
          <tr><td colspan="2" style="color:#aaa;padding-top:0;font-size:13px">↳ then ${bc.monthlyAmount} on the 1st of every month after that</td></tr>
        </table>
      </div>`
    }
    if (bc?.kind === 'prorated') {
      return `
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:12px;color:#4ecde6;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">💳 Your billing</p>
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Plan</td><td style="color:#fff;text-align:right;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#888">Paid today</td><td style="color:#fff;text-align:right;font-weight:600">${params.amount}</td></tr>
          <tr><td colspan="2" style="color:#aaa;padding-top:0;padding-bottom:8px;font-size:13px">↳ pro-rata for today through ${bc.anchorLabel}</td></tr>
          <tr><td style="color:#888;border-top:1px solid #2a2a2a;padding-top:12px">From ${bc.anchorLabel}</td><td style="color:#fff;text-align:right;font-weight:600;border-top:1px solid #2a2a2a;padding-top:12px">${bc.monthlyAmount}/month</td></tr>
          <tr><td colspan="2" style="color:#aaa;padding-top:0;font-size:13px">↳ then ${bc.monthlyAmount} on the 1st of every month after that</td></tr>
        </table>
      </div>`
    }
    return `
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:120px">Plan</td><td style="color:#fff;text-align:right;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#888">Charged</td><td style="color:#fff;text-align:right;font-weight:600">${params.amount}</td></tr>
          ${params.childName ? `<tr><td style="color:#888">Player</td><td style="color:#fff;text-align:right">${params.childName}</td></tr>` : ''}
          <tr><td style="color:#888">Academy</td><td style="color:#fff;text-align:right">${params.academyName}</td></tr>
        </table>
      </div>`
  })()

  return {
    subject: `${params.childName ? `${params.childName} is in! ` : ''}🎉 Subscription active — ${params.academyName}`,
    html: baseLayout(`
      ${params.academyLogoUrl ? `<div style="text-align:center;margin-bottom:20px"><img src="${params.academyLogoUrl}" alt="${params.academyName}" style="max-width:96px;max-height:96px;border-radius:14px" /></div>` : ''}
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:24px">You're in! ⚽🎉</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.6">
        Hi ${greetingName} — your subscription to <strong style="color:#fff">${params.academyName}</strong> is active.
        ${params.childName ? `Welcome to the squad, <strong style="color:#fff">${params.childName}</strong>!` : ''}
      </p>

      ${breakdownPanel}

      ${params.nextClass ? `
      <div style="background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.02));border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:12px;color:#10b981;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">⚡ Your next session</p>
        <p style="margin:0 0 4px;font-size:18px;color:#fff;font-weight:700">${params.nextClass.name}</p>
        <p style="margin:0;font-size:14px;color:#aaa">${params.nextClass.day} at ${params.nextClass.time}${params.nextClass.location ? ` · ${params.nextClass.location}` : ''}</p>
      </div>
      ` : ''}

      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:16px 36px;border-radius:14px;font-weight:700;text-decoration:none;font-size:16px;box-shadow:0 8px 24px rgba(78,205,230,0.3)">View dashboard →</a>
      </div>

      <p style="color:#777;font-size:13px;line-height:1.6;margin:24px 0 0">
        🔔 We'll send reminders before every session. You can cancel anytime from your dashboard, no questions asked.
      </p>

      ${params.academyContactEmail ? `<p style="color:#666;font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center;padding-top:16px;border-top:1px solid #1e1e1e">Questions? Email <a href="mailto:${params.academyContactEmail}" style="color:#4ecde6">${params.academyContactEmail}</a>.</p>` : ''}
    `),
  }
}

export function paymentReceiptEmail(params: {
  parentName: string
  amount: string
  planName: string
  date: string
  receiptId: string
  academyName: string
}) {
  return {
    subject: `Payment receipt — ${params.amount} — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Payment Received</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">Thank you for your payment. Here's your receipt:</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#999">Amount</td><td style="text-align:right;font-weight:600">${params.amount}</td></tr>
          <tr><td style="color:#999">Plan</td><td style="text-align:right">${params.planName}</td></tr>
          <tr><td style="color:#999">Date</td><td style="text-align:right">${params.date}</td></tr>
          <tr><td style="color:#999">Receipt #</td><td style="text-align:right;font-family:monospace;font-size:12px">${params.receiptId}</td></tr>
          <tr><td style="color:#999">Academy</td><td style="text-align:right">${params.academyName}</td></tr>
        </table>
      </div>
      <p style="color:#999;font-size:12px;text-align:center">Keep this email for your records.</p>
    `),
  }
}

export function winBackEmail(params: { parentName: string; planName: string; originalAmount: string; discountedAmount: string; academyName: string; dashboardUrl: string }) {
  return {
    subject: `We miss you! Here's 25% off to come back — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">We miss you! 😢</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">It's been a week since you cancelled your <strong>${params.planName}</strong> subscription at <strong>${params.academyName}</strong>.</p>
      <p style="color:#aaa;line-height:1.6">We'd love to have you back — and we've got a special offer just for you:</p>
      <div style="background:linear-gradient(135deg,#f0fdff,#e0f7ff);border:2px solid #4ecde6;border-radius:16px;padding:24px;margin:24px 0;text-align:center">
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-decoration:line-through">${params.originalAmount}/month</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#4ecde6">${params.discountedAmount}/month</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#059669">25% off — forever</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:16px 40px;border-radius:14px;font-weight:700;text-decoration:none;font-size:16px">Come Back & Save 25% →</a>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">This offer won't last forever. We'd love to see your child back on the pitch!</p>
    `),
  }
}

export function cancellationConfirmEmail(params: { parentName: string; planName: string; endDate: string; academyName: string }) {
  return {
    subject: `Your subscription has been cancelled — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Subscription Cancelled</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">Your <strong>${params.planName}</strong> subscription at <strong>${params.academyName}</strong> has been cancelled.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#ddd">📅 <strong>Access until:</strong> ${params.endDate}</p>
        <p style="margin:8px 0 0;font-size:14px;color:#ddd">💳 <strong>No further charges</strong> will be made</p>
      </div>
      <p style="color:#aaa;line-height:1.6">You can re-subscribe any time from your dashboard. We hope to see you again soon!</p>
      <p style="color:#666;font-size:13px;margin-top:24px">If you didn't request this cancellation, please contact your academy.</p>
    `),
  }
}

/**
 * Cancellation retention flow — admin notification.
 *
 * Sent when a parent completes the cancel flow (either after declining the
 * save-offer, or when no offer was shown). Tells the academy: who left,
 * why, whether a save-offer was attempted, and when their access ends.
 *
 * Pairs with cancellationConfirmEmail (which goes to the parent).
 */
export function cancellationAdminNotifyEmail(params: {
  academyName: string
  parentName: string
  parentEmail: string | null
  reasonLabel: string
  reasonDetail: string | null
  offerOutcome: 'declined' | 'not_shown' | 'accepted'
  endDate: string
  orphaned?: boolean
  dashboardUrl: string
}) {
  const offerLine = (() => {
    if (params.offerOutcome === 'accepted') return '<span style="color:#10b981;font-weight:600">Accepted</span> the save-offer'
    if (params.offerOutcome === 'declined') return '<span style="color:#fca5a5;font-weight:600">Declined</span> the save-offer'
    return '<span style="color:#aaa">Save-offer not shown</span>'
  })()
  const orphanNote = params.orphaned
    ? `<p style="background:#451a03;border:1px solid #f59e0b40;border-radius:10px;padding:12px;margin:18px 0;color:#fcd34d;font-size:13px;line-height:1.5">
        ⚠ The parent's Stripe subscription was already unreachable. Their dashboard subscription has been cleared locally. No further Stripe action is needed but you may want to follow up if billing seemed off.
       </p>`
    : ''
  return {
    subject: `Cancellation: ${params.parentName} at ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">A family cancelled</h2>
      <p style="color:#aaa;margin:0 0 18px;line-height:1.6">
        <strong style="color:#fff">${params.parentName}</strong> just cancelled their subscription at <strong style="color:#fff">${params.academyName}</strong>.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:18px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Parent</td><td style="color:#fff;font-weight:600">${params.parentName}</td></tr>
          ${params.parentEmail ? `<tr><td style="color:#888">Email</td><td><a href="mailto:${params.parentEmail}" style="color:#4ecde6">${params.parentEmail}</a></td></tr>` : ''}
          <tr><td style="color:#888">Reason</td><td style="color:#fff">${params.reasonLabel}</td></tr>
          ${params.reasonDetail ? `<tr><td style="color:#888">Detail</td><td style="color:#ddd;font-style:italic">"${params.reasonDetail}"</td></tr>` : ''}
          <tr><td style="color:#888">Save-offer</td><td>${offerLine}</td></tr>
          <tr><td style="color:#888">Access ends</td><td style="color:#fff">${params.endDate}</td></tr>
        </table>
      </div>
      ${orphanNote}
      <p style="color:#aaa;line-height:1.6;font-size:14px;margin:0 0 18px">
        💡 <strong style="color:#ddd">Worth a quick check-in?</strong> A short, kind follow-up message often surfaces a fixable problem — and sometimes wins the family back.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Open billing dashboard →</a>
      </div>
    `),
  }
}

/**
 * Cancellation retention flow — admin notification when the parent
 * ACCEPTED the save-offer. Tells the academy they retained the family.
 */
export function retentionAcceptedAdminNotifyEmail(params: {
  academyName: string
  parentName: string
  parentEmail: string | null
  discountPercent: number
  durationLabel: string  // e.g. "one month", "3 months", "forever"
  dashboardUrl: string
}) {
  return {
    subject: `Retained: ${params.parentName} accepted ${params.discountPercent}% save-offer`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">A family stayed 🎉</h2>
      <p style="color:#aaa;margin:0 0 18px;line-height:1.6">
        <strong style="color:#fff">${params.parentName}</strong> was about to cancel at <strong style="color:#fff">${params.academyName}</strong> but accepted your save-offer instead.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:18px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Parent</td><td style="color:#fff;font-weight:600">${params.parentName}</td></tr>
          ${params.parentEmail ? `<tr><td style="color:#888">Email</td><td><a href="mailto:${params.parentEmail}" style="color:#4ecde6">${params.parentEmail}</a></td></tr>` : ''}
          <tr><td style="color:#888">Discount applied</td><td style="color:#10b981;font-weight:700">${params.discountPercent}% off</td></tr>
          <tr><td style="color:#888">Duration</td><td style="color:#fff">${params.durationLabel}</td></tr>
        </table>
      </div>
      <p style="color:#aaa;line-height:1.6;font-size:14px;margin:0 0 18px">
        Their subscription continues uninterrupted. The discount applies automatically on their next invoice; no action needed from you.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#10b981;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Open billing dashboard →</a>
      </div>
    `),
  }
}

export function bookingConfirmationEmail(params: {
  parentName: string
  childName: string
  className: string
  dayTime: string
  location: string
  academyName: string
  dashboardUrl: string
}) {
  return {
    subject: `You're all booked in! ${params.className} — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">You're all booked in!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong> is now enrolled in <strong>${params.className}</strong> at <strong>${params.academyName}</strong>.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#999">Class</td><td style="text-align:right;font-weight:600">${params.className}</td></tr>
          <tr><td style="color:#999">When</td><td style="text-align:right">${params.dayTime}</td></tr>
          <tr><td style="color:#999">Where</td><td style="text-align:right">${params.location}</td></tr>
        </table>
      </div>
      <div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:14px;color:#1e40af;font-weight:600">What to bring</p>
        <p style="margin:0;font-size:14px;color:#1e40af">Football boots, shin pads, water bottle, and a good attitude!</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">View in Dashboard</a>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">See you on the pitch!</p>
    `),
  }
}

export function sessionReminderEmail(params: {
  parentName: string
  childName: string
  className: string
  dayTime: string
  location: string
  academyName: string
}) {
  return {
    subject: `Tomorrow's session — ${params.className} — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Tomorrow's session</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">Just a reminder that <strong>${params.childName}</strong> has a session tomorrow with <strong>${params.academyName}</strong>.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#999">Class</td><td style="text-align:right;font-weight:600">${params.className}</td></tr>
          <tr><td style="color:#999">When</td><td style="text-align:right">${params.dayTime}</td></tr>
          <tr><td style="color:#999">Where</td><td style="text-align:right">${params.location}</td></tr>
        </table>
      </div>
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px;font-size:14px;color:#92400e;font-weight:600">Don't forget</p>
        <p style="margin:0 0 4px;font-size:14px;color:#92400e">⚽ Football boots</p>
        <p style="margin:0 0 4px;font-size:14px;color:#92400e">💧 Water bottle</p>
        <p style="margin:0;font-size:14px;color:#92400e">🦵 Shin pads</p>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">See you there!</p>
    `),
  }
}

export function postSessionFollowUpEmail(params: {
  parentName: string
  childName: string
  className: string
  academyName: string
  dashboardUrl: string
}) {
  return {
    subject: `How was today's session? — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">How was today's session?</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">We hope <strong>${params.childName}</strong> enjoyed today's <strong>${params.className}</strong> session at <strong>${params.academyName}</strong>!</p>
      <p style="color:#aaa;line-height:1.6">You can view your child's progress and any coach notes in the dashboard.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">View Progress</a>
      </div>
      <p style="color:#aaa;line-height:1.6;font-size:14px">We'd love to hear how it went — leave a quick rating or feedback from your dashboard.</p>
      <p style="color:#666;font-size:13px;text-align:center">Thank you for choosing ${params.academyName}!</p>
    `),
  }
}

export function trialFollowUpEmail(params: {
  parentName: string
  childName: string
  academyName: string
  signupUrl: string
  className: string
}) {
  return {
    subject: `Did ${params.childName} enjoy it? — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Did ${params.childName} enjoy it?</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">We hope <strong>${params.childName}</strong> had a great time at the <strong>${params.className}</strong> trial session with <strong>${params.academyName}</strong>!</p>
      <p style="color:#aaa;line-height:1.6">If they loved it, why not sign up for regular classes? We've got a special offer just for trial families:</p>
      <div style="background:linear-gradient(135deg,#f0fdff,#e0f7ff);border:2px solid #4ecde6;border-radius:16px;padding:24px;margin:24px 0;text-align:center">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#059669">First month</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#4ecde6">20% off</p>
        <p style="margin:4px 0 0;font-size:13px;color:#666">When you sign up within 7 days</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.signupUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:16px 40px;border-radius:14px;font-weight:700;text-decoration:none;font-size:16px">Sign Up Now</a>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">Questions? Just reply to this email.</p>
    `),
  }
}

export function missedSessionEmail(params: {
  parentName: string
  childName: string
  className: string
  date: string
  dashboardUrl: string
}) {
  return {
    subject: `We missed ${params.childName} today — ${params.className}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">We missed ${params.childName} today</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">We noticed <strong>${params.childName}</strong> wasn't at today's <strong>${params.className}</strong> session. We hope everything is okay!</p>
      <p style="color:#aaa;line-height:1.6">If something came up, no worries at all — you can check the upcoming schedule and make sure you don't miss the next one.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">View Schedule</a>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">We look forward to seeing ${params.childName} next time!</p>
    `),
  }
}

export function subscriptionExpiringEmail(params: {
  parentName: string
  amount: string
  renewalDate: string
  planName: string
  dashboardUrl: string
}) {
  return {
    subject: `Subscription renewing soon — ${params.planName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Renewal Reminder</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">Just a heads-up that your subscription is renewing soon.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#999">Plan</td><td style="text-align:right;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#999">Amount</td><td style="text-align:right;font-weight:600">${params.amount}</td></tr>
          <tr><td style="color:#999">Renewal date</td><td style="text-align:right">${params.renewalDate}</td></tr>
        </table>
      </div>
      <p style="color:#aaa;line-height:1.6">If you'd like to make any changes, you can manage your subscription from the dashboard.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">Manage Subscription</a>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">No action needed if you'd like to continue as normal.</p>
    `),
  }
}

export function progressReportEmail(params: {
  parentName: string
  childName: string
  academyName: string
  overallScore: number
  scores: { category: string; score: number }[]
  strengths: string[]
  focusAreas: string[]
  attendanceRate: number
  sessionsAttended: number
  coachComment?: string
  reportUrl: string
}) {
  const starRating = '★'.repeat(Math.round(params.overallScore)) + '☆'.repeat(5 - Math.round(params.overallScore))

  const scoresHtml = params.scores
    .map(s => {
      const barWidth = (s.score / 5) * 100
      return `<tr>
        <td style="padding:8px 0;font-size:13px;color:#ccc;width:140px">${s.category}</td>
        <td style="padding:8px 0">
          <div style="background:#1e1e1e;border-radius:6px;height:8px;width:100%">
            <div style="background:#4ecde6;border-radius:6px;height:8px;width:${barWidth}%"></div>
          </div>
        </td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;color:#fff;text-align:right;width:30px">${s.score.toFixed(1)}</td>
      </tr>`
    })
    .join('')

  const strengthsHtml = params.strengths.length > 0
    ? params.strengths.map(s => `<li style="margin:4px 0;font-size:13px;color:#ccc">&#9989; ${s}</li>`).join('')
    : '<li style="margin:4px 0;font-size:13px;color:#666">No strengths highlighted yet</li>'

  const focusHtml = params.focusAreas.length > 0
    ? params.focusAreas.map(s => `<li style="margin:4px 0;font-size:13px;color:#ccc">&#127919; ${s}</li>`).join('')
    : '<li style="margin:4px 0;font-size:13px;color:#666">No focus areas highlighted yet</li>'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'

  return {
    subject: `${params.childName}'s progress report — ${params.academyName}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px">
<div style="background:#4ecde6;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center">
<h1 style="margin:0;color:#0a0a0a;font-size:20px;font-weight:800;letter-spacing:-0.5px">${params.academyName}</h1>
<p style="margin:6px 0 0;color:#0a0a0a;opacity:0.7;font-size:12px;letter-spacing:1px;text-transform:uppercase">Progress Report</p>
</div>
<div style="background:#141414;padding:32px;border:1px solid #1e1e1e;border-top:none">
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">Here's the latest progress update for <strong style="color:#fff">${params.childName}</strong>.</p>

      <!-- Overall Score -->
      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:20px;margin:20px 0;text-align:center">
        <p style="margin:0 0 4px;font-size:13px;color:#666">Overall Rating</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#4ecde6">${params.overallScore.toFixed(1)}<span style="font-size:16px;color:#666">/5</span></p>
        <p style="margin:4px 0 0;font-size:18px;letter-spacing:2px;color:#f59e0b">${starRating}</p>
      </div>

      <!-- Attendance -->
      <div style="background:#0c2d48;border:1px solid #1e4d6e;border-radius:12px;padding:14px 16px;margin:16px 0">
        <p style="margin:0;font-size:13px;color:#7dd3fc">&#128197; <strong>${params.sessionsAttended} sessions</strong> attended &middot; <strong>${params.attendanceRate}%</strong> attendance rate</p>
      </div>

      <!-- Skill Scores -->
      <p style="font-size:14px;font-weight:600;color:#fff;margin:20px 0 8px">Skills Breakdown</p>
      <table style="width:100%;border-collapse:collapse" cellpadding="0">
        ${scoresHtml}
      </table>

      <!-- Strengths -->
      <p style="font-size:14px;font-weight:600;color:#fff;margin:20px 0 8px">Strengths</p>
      <ul style="padding-left:0;list-style:none;margin:0">${strengthsHtml}</ul>

      <!-- Focus Areas -->
      <p style="font-size:14px;font-weight:600;color:#fff;margin:20px 0 8px">Areas to Develop</p>
      <ul style="padding-left:0;list-style:none;margin:0">${focusHtml}</ul>

      ${params.coachComment ? `
      <!-- Coach Comment -->
      <div style="border-left:3px solid #4ecde6;padding:12px 16px;background:#1a1a1a;border-radius:0 12px 12px 0;margin:20px 0">
        <p style="margin:0 0 4px;font-size:12px;color:#666;font-weight:600">Coach's Note</p>
        <p style="margin:0;font-size:13px;color:#ccc;line-height:1.5">${params.coachComment}</p>
      </div>` : ''}

      <div style="text-align:center;margin:24px 0">
        <a href="${params.reportUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">View Full Report</a>
      </div>
</div>
<div style="background:#0f0f0f;border-radius:0 0 16px 16px;border:1px solid #1e1e1e;border-top:none;padding:20px 32px;text-align:center">
<p style="margin:0;color:#555;font-size:12px">Powered by <a href="${appUrl}" style="color:#4ecde6;text-decoration:none;font-weight:600">Player Portal</a></p>
<p style="margin:8px 0 0;color:#333;font-size:11px">You received this because your child is enrolled at ${params.academyName}.</p>
<p style="margin:4px 0 0;color:#333;font-size:11px">To stop receiving progress reports, contact your academy directly.</p>
</div>
</div></body></html>`,
  }
}

export function upsellAddClassEmail(params: { parentName: string; childName: string; className: string; academyName: string; bookingUrl: string }) {
  return {
    subject: `${params.childName} loved ${params.className} — add another class?`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Great booking!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong> is now booked into <strong>${params.className}</strong> at <strong>${params.academyName}</strong>.</p>
      <div style="background:linear-gradient(135deg,#f0fdff,#e0f7ff);border:2px solid #4ecde6;border-radius:16px;padding:24px;margin:24px 0;text-align:center">
        <p style="margin:0 0 4px;font-size:14px;color:#aaa">Want to add another class?</p>
        <p style="margin:0;font-size:28px;font-weight:800;color:#4ecde6">15% OFF</p>
        <p style="margin:4px 0 0;font-size:13px;color:#059669;font-weight:600">your second class — applied automatically</p>
      </div>
      <p style="color:#aaa;line-height:1.6">The more they train, the faster they improve. Add a second session and save 15%.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.bookingUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">Browse Classes</a>
      </div>
    `),
  }
}

export function upsellSubscriptionEmail(params: { parentName: string; childName: string; className: string; academyName: string; monthlyPrice: string; dashboardUrl: string }) {
  return {
    subject: `Save money on ${params.childName}'s classes — switch to monthly`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">${params.childName} is on a roll!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong> has been training at <strong>${params.academyName}</strong> for a month now.</p>
      <div style="background:#f8f9fa;border-radius:16px;padding:20px;margin:20px 0;text-align:center">
        <p style="margin:0 0 8px;font-size:14px;color:#999">Switch to a monthly subscription</p>
        <p style="margin:0;font-size:28px;font-weight:800;color:#0a0a0a">${params.monthlyPrice}<span style="font-size:14px;color:#999">/month</span></p>
        <div style="margin-top:12px;display:inline-block;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;padding:4px 12px;border-radius:99px">Never miss a session + save vs pay-as-you-go</div>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">View Subscription Plans</a>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">Cancel anytime. No lock-in contracts.</p>
    `),
  }
}

export function upsellSiblingEmail(params: { parentName: string; childName: string; academyName: string; dashboardUrl: string }) {
  return {
    subject: `10% sibling discount at ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Got a sibling?</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong> is doing great at <strong>${params.academyName}</strong>. If you've got another child who'd love to join:</p>
      <div style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border:2px solid #f59e0b;border-radius:16px;padding:24px;margin:24px 0;text-align:center">
        <p style="margin:0;font-size:28px;font-weight:800;color:#f59e0b">10% OFF</p>
        <p style="margin:4px 0 0;font-size:14px;color:#92400e;font-weight:600">for every additional child you enrol</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">Add Another Child</a>
      </div>
    `),
  }
}

export function birthdayParentEmail(params: {
  parentName: string
  childName: string
  turningAge: number
  academyName: string
  dashboardUrl: string
  academyLogoUrl?: string
  academyContactEmail?: string
}) {
  return {
    subject: `🎂 Happy birthday ${params.childName}!`,
    html: baseLayout(`
      ${params.academyLogoUrl ? `<div style="text-align:center;margin-bottom:20px"><img src="${params.academyLogoUrl}" alt="${params.academyName}" style="max-width:96px;max-height:96px;border-radius:14px" /></div>` : ''}
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;font-size:48px">🎂🎉🎈</div>
      </div>
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:26px;text-align:center">Happy birthday, ${params.childName}!</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.7;text-align:center;font-size:15px">
        Everyone at <strong style="color:#fff">${params.academyName}</strong> wants to wish ${params.childName} a fantastic
        <strong style="color:#a855f7">${params.turningAge}${params.turningAge === 1 ? 'st' : params.turningAge === 2 ? 'nd' : params.turningAge === 3 ? 'rd' : 'th'} birthday</strong>!
      </p>
      <div style="background:linear-gradient(135deg,rgba(168,85,247,0.1),rgba(236,72,153,0.05));border:1px solid rgba(168,85,247,0.3);border-radius:16px;padding:24px;margin:24px 0;text-align:center">
        <p style="margin:0 0 4px;font-size:13px;color:#a855f7;text-transform:uppercase;letter-spacing:1px;font-weight:700">${params.childName} is turning</p>
        <p style="margin:0;font-size:48px;font-weight:800;background:linear-gradient(135deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${params.turningAge}</p>
      </div>
      <p style="color:#888;line-height:1.6;text-align:center;font-size:14px;margin:24px 0">
        Hi ${params.parentName} — your coach will give ${params.childName} a special mention at the next session. 🏆
      </p>
      ${params.academyContactEmail ? `<p style="color:#666;font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center;padding-top:16px;border-top:1px solid #1e1e1e">From everyone at ${params.academyName} · <a href="mailto:${params.academyContactEmail}" style="color:#4ecde6">${params.academyContactEmail}</a></p>` : ''}
    `),
  }
}

export function paymentFailedAdminEmail(params: {
  academyName: string
  parentName: string
  parentEmail?: string
  childName?: string
  planName: string
  amount: string
  dashboardUrl: string
}) {
  return {
    subject: `💳 Payment failed — ${params.parentName} at ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">💳 Payment failed</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.6">
        A parent payment at <strong style="color:#fff">${params.academyName}</strong> just failed.
        Usually means an expired card. Worth a quick check-in.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:120px">Parent</td><td style="color:#fff;font-weight:600">${params.parentName}</td></tr>
          ${params.parentEmail ? `<tr><td style="color:#888">Email</td><td><a href="mailto:${params.parentEmail}" style="color:#4ecde6">${params.parentEmail}</a></td></tr>` : ''}
          ${params.childName ? `<tr><td style="color:#888">Child</td><td style="color:#fff">${params.childName}</td></tr>` : ''}
          <tr><td style="color:#888">Plan</td><td style="color:#fff">${params.planName}</td></tr>
          <tr><td style="color:#888">Amount</td><td style="color:#f59e0b;font-weight:700">${params.amount}</td></tr>
        </table>
      </div>
      <p style="color:#aaa;line-height:1.6;font-size:14px;margin:0 0 20px">
        💡 <strong style="color:#ddd">Suggested action:</strong>
        Reach out personally before the parent notices the charge bounced — feels like service, not a chase.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}/dashboard/payments" style="display:inline-block;background:#f59e0b;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">View payments dashboard →</a>
      </div>
      <p style="color:#666;font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center">
        Stripe will automatically retry the payment over the next 5-7 days. The subscription is marked &quot;past_due&quot; in the meantime.
      </p>
    `),
  }
}

/**
 * Day 2 — Parent failed-payment recovery email.
 *
 * Sent when Stripe fires invoice.payment_failed on a parent's subscription.
 * The brief: the parent must know their payment failed BEFORE their
 * membership silently lapses. Previously they got only an in-app
 * notification — unseen unless they logged in.
 *
 * Includes:
 *   • Plain-English explanation ("your card was declined")
 *   • Failure reason from Stripe when available
 *   • Stripe-hosted update link (one-click card update + retry — official Stripe-hosted page, no auth needed)
 *   • Clear timeline ("we'll retry over the next 5-7 days; please update before then")
 */
export function paymentFailedParentEmail(params: {
  academyName: string
  parentName: string
  childName?: string
  planName: string
  amount: string
  failureReason?: string | null    // e.g. "Your card was declined" — pulled from invoice.last_finalization_error or charge
  updatePaymentUrl: string         // Stripe hosted_invoice_url — parent updates card and retries inline
  dashboardUrl: string
  accentColor?: string
  /** Sprint 6 — optional wa.me URL with pre-filled message. Renders a
      small "Reply on WhatsApp" line at the bottom when set. Hidden
      gracefully when the academy has no contact_phone. */
  whatsappUrl?: string | null
}) {
  const accent = (params.accentColor || '#f59e0b').replace(/[^#0-9a-fA-F]/g, '')
  const reasonLine = params.failureReason
    ? `<p style="color:#aaa;margin:0 0 18px;line-height:1.6;font-size:14px"><strong style="color:#fca5a5">Reason:</strong> ${params.failureReason}</p>`
    : ''
  return {
    subject: `Action needed: payment for ${params.academyName} couldn't be processed`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Your payment couldn't be processed</h2>
      <p style="color:#aaa;margin:0 0 18px;line-height:1.6">
        Hi ${params.parentName} — we tried to take payment for your <strong style="color:#fff">${params.academyName}</strong> membership${params.childName ? ` (for ${params.childName})` : ''} but the charge didn't go through.
      </p>
      ${reasonLine}
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:18px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:120px">Academy</td><td style="color:#fff;font-weight:600">${params.academyName}</td></tr>
          <tr><td style="color:#888">Plan</td><td style="color:#fff">${params.planName}</td></tr>
          ${params.childName ? `<tr><td style="color:#888">For</td><td style="color:#fff">${params.childName}</td></tr>` : ''}
          <tr><td style="color:#888">Amount</td><td style="color:#${accent};font-weight:700">${params.amount}</td></tr>
        </table>
      </div>
      <p style="color:#ddd;line-height:1.6;font-size:14px;margin:0 0 18px">
        <strong>What to do next:</strong> tap the button below to securely update your card. You'll go to a Stripe-hosted page — no Player Portal login needed. Once your card is updated, we'll retry the payment automatically and your membership will continue uninterrupted.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.updatePaymentUrl}" style="display:inline-block;background:#${accent};color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Update payment method →</a>
      </div>
      <p style="color:#aaa;font-size:13px;line-height:1.6;margin:18px 0 0">
        <strong style="color:#ddd">Common reasons:</strong> expired card, insufficient funds, or your bank flagged the charge. Updating to a new card resolves all three.
      </p>
      <p style="color:#666;font-size:12px;line-height:1.6;margin:18px 0 0">
        We'll automatically retry the payment over the next 5–7 days. If we can't collect, your subscription will be paused — please update before then to keep your child's place. Questions? Reply to this email and your academy will help.
      </p>
      <p style="color:#555;font-size:11px;line-height:1.5;margin:16px 0 0;text-align:center">
        <a href="${params.dashboardUrl}/dashboard/payments" style="color:#666;text-decoration:underline">View this in your Player Portal dashboard</a>
      </p>
      ${params.whatsappUrl ? `
      <div style="background:rgba(37,211,102,0.06);border:1px solid rgba(37,211,102,0.25);border-radius:12px;padding:14px;margin:18px 0 0;text-align:center">
        <a href="${params.whatsappUrl}" style="color:#25D366;text-decoration:none;font-weight:600;font-size:13px">💬 Or reply on WhatsApp →</a>
      </div>` : ''}
    `),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Day-2-4 sprint follow-up: PLATFORM-billing emails (academy → Player Portal)
//
// These four close the trust loop on the academy's own Player Portal
// subscription. Before this batch, every platform-billing event updated
// DB state silently — the academy never received an email confirming
// what happened.
//
// All four are mailed to the academy's admin users. None affect Stripe
// Connect parent-billing math.
// ═══════════════════════════════════════════════════════════════════════════

export function platformSubscriptionActivatedEmail(params: {
  academyName: string
  adminFirstName: string
  planName: string
  monthlyAmount: string
  nextBillingDate: string
  dashboardUrl: string
}) {
  return {
    subject: `Your Player Portal ${params.planName} plan is active`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">You're live on Player Portal 🎉</h2>
      <p style="color:#aaa;margin:0 0 18px;line-height:1.6">
        Hi ${params.adminFirstName} — your Player Portal subscription for <strong style="color:#fff">${params.academyName}</strong> is active. Your public booking page is live and parents can subscribe.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:18px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Plan</td><td style="color:#fff;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#888">Monthly</td><td style="color:#4ecde6;font-weight:700">${params.monthlyAmount}</td></tr>
          <tr><td style="color:#888">Next charge</td><td style="color:#fff">${params.nextBillingDate}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}/dashboard" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Open dashboard →</a>
      </div>
      <p style="color:#666;font-size:12px;line-height:1.6;margin:18px 0 0;text-align:center">
        Manage billing or change plan from <a href="${params.dashboardUrl}/dashboard/settings" style="color:#888;text-decoration:underline">Settings</a> at any time. Your trial period has now ended and your subscription is rolling monthly.
      </p>
    `),
  }
}

export function platformPaymentFailedEmail(params: {
  academyName: string
  adminFirstName: string
  planName: string
  amount: string
  failureReason?: string | null
  updatePaymentUrl: string
  dashboardUrl: string
}) {
  const reasonLine = params.failureReason
    ? `<p style="color:#aaa;margin:0 0 18px;line-height:1.6;font-size:14px"><strong style="color:#fca5a5">Reason:</strong> ${params.failureReason}</p>`
    : ''
  return {
    subject: `Action needed: your Player Portal payment couldn't be processed`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Your Player Portal payment didn't go through</h2>
      <p style="color:#aaa;margin:0 0 18px;line-height:1.6">
        Hi ${params.adminFirstName} — we tried to renew your Player Portal subscription for <strong style="color:#fff">${params.academyName}</strong> but the charge didn't go through.
      </p>
      ${reasonLine}
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:18px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Plan</td><td style="color:#fff;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#888">Amount</td><td style="color:#f59e0b;font-weight:700">${params.amount}</td></tr>
        </table>
      </div>
      <p style="color:#ddd;line-height:1.6;font-size:14px;margin:0 0 18px">
        <strong>Quick fix:</strong> tap the button below to update your card. You'll go to a Stripe-hosted page — once your card is updated, we'll retry automatically and your dashboard stays unlocked.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.updatePaymentUrl}" style="display:inline-block;background:#f59e0b;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Update payment method →</a>
      </div>
      <p style="color:#aaa;font-size:13px;line-height:1.6;margin:18px 0 0">
        Stripe will retry over the next 5–7 days. If we can't collect, your dashboard will be temporarily locked until you update — parents and existing bookings stay live throughout. Your public booking page is unaffected.
      </p>
    `),
  }
}

export function platformCancellationConfirmEmail(params: {
  academyName: string
  adminFirstName: string
  planName: string
  endDate: string
  dashboardUrl: string
}) {
  return {
    subject: `Your Player Portal subscription has been cancelled`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Cancellation confirmed</h2>
      <p style="color:#aaa;margin:0 0 18px;line-height:1.6">
        Hi ${params.adminFirstName} — your Player Portal subscription for <strong style="color:#fff">${params.academyName}</strong> has been cancelled.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:18px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Plan cancelled</td><td style="color:#fff;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#888">Access ends</td><td style="color:#fff">${params.endDate}</td></tr>
        </table>
      </div>
      <p style="color:#aaa;line-height:1.6;font-size:14px;margin:0 0 18px">
        <strong style="color:#ddd">What happens now:</strong> your admin dashboard will be locked once your current period ends. Existing parent subscriptions and your public booking page stay live throughout — parents continue to be charged and attend classes uninterrupted.
      </p>
      <p style="color:#aaa;line-height:1.6;font-size:14px;margin:0 0 18px">
        Changed your mind? You can resubscribe at any time and pick up where you left off — all your data, players, classes, and parents are preserved.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}/dashboard/settings" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Resubscribe →</a>
      </div>
      <p style="color:#666;font-size:12px;line-height:1.6;margin:18px 0 0;text-align:center">
        We're sorry to see you go. Reply to this email if there's anything we can do.
      </p>
    `),
  }
}

export function platformPaymentRecoveredEmail(params: {
  academyName: string
  adminFirstName: string
  planName: string
  dashboardUrl: string
}) {
  return {
    subject: `Your Player Portal payment is sorted — dashboard unlocked`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">You're back — payment recovered ✓</h2>
      <p style="color:#aaa;margin:0 0 18px;line-height:1.6">
        Hi ${params.adminFirstName} — great news. Your Player Portal subscription for <strong style="color:#fff">${params.academyName}</strong> is back to active. Your dashboard is fully unlocked.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:18px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Plan</td><td style="color:#fff;font-weight:600">${params.planName}</td></tr>
          <tr><td style="color:#888">Status</td><td style="color:#10b981;font-weight:700">Active</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}/dashboard" style="display:inline-block;background:#10b981;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Open dashboard →</a>
      </div>
      <p style="color:#666;font-size:12px;line-height:1.6;margin:18px 0 0;text-align:center">
        No action required. Your next renewal will follow your normal billing schedule.
      </p>
    `),
  }
}

export function firstSaleEmail(params: {
  academyName: string
  academySlug: string
  parentName: string
  childName?: string
  planName: string
  amount: string
  dashboardUrl: string
}) {
  return {
    subject: `🎉 First sale for ${params.academyName}!`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:24px">🎉 First sale!</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.6">
        <strong style="color:#fff">${params.academyName}</strong> just received their first paying parent.
        ${params.childName ? `${params.parentName} signed up <strong style="color:#fff">${params.childName}</strong>` : params.parentName + ' signed up'}
        on the <strong style="color:#fff">${params.planName}</strong> plan.
      </p>
      <div style="background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.02));border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:20px;margin:20px 0;text-align:center">
        <p style="margin:0;font-size:28px;font-weight:800;color:#10b981">${params.amount}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#10b981;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">First revenue · ${params.planName}</p>
      </div>
      <p style="color:#aaa;line-height:1.6;margin:24px 0 16px">
        💡 <strong style="color:#ddd">Next steps for the academy:</strong>
      </p>
      <ol style="color:#aaa;line-height:1.8;font-size:14px;margin:0 0 24px;padding-left:20px">
        <li>Reach out personally — first-customer moment</li>
        <li>Make sure the kid&apos;s first session is great</li>
        <li>Ask for a testimonial after 3 weeks</li>
      </ol>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}/platform" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">View in Platform Admin →</a>
      </div>
    `),
  }
}

export function adminWelcomeEmail(params: { adminName: string; academyName: string; dashboardUrl: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  return {
    subject: `🏟️ ${params.academyName} is LIVE on Player Portal!`,
    html: baseLayout(`
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:linear-gradient(135deg, #4ecde6, #2ba8c3);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;margin-bottom:12px">🏟️</div>
        <h2 style="margin:0 0 4px;color:#ffffff;font-size:24px;font-weight:800">You're live!</h2>
        <p style="margin:0;color:#4ecde6;font-size:16px;font-weight:600">${params.academyName}</p>
      </div>
      <p style="color:#aaa;margin:0 0 20px;text-align:center">Hi ${params.adminName}, your academy is set up and ready for parents.</p>

      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0;border-left:3px solid #4ecde6">
        <p style="margin:0 0 16px;font-size:15px;color:#fff;font-weight:700">🚀 Quick Start Checklist</p>
        <table style="width:100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;color:#aaa;font-size:14px">
            <span style="display:inline-block;width:28px;height:28px;background:#4ecde6;color:#0a0a0a;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:13px;margin-right:10px">1</span>
            <a href="${params.dashboardUrl}/groups" style="color:#4ecde6;text-decoration:none;font-weight:500">Create your first class</a>
          </td></tr>
          <tr><td style="padding:8px 0;color:#aaa;font-size:14px">
            <span style="display:inline-block;width:28px;height:28px;background:#4ecde6;color:#0a0a0a;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:13px;margin-right:10px">2</span>
            <a href="${params.dashboardUrl}/settings" style="color:#4ecde6;text-decoration:none;font-weight:500">Set up pricing & connect Stripe</a>
          </td></tr>
          <tr><td style="padding:8px 0;color:#aaa;font-size:14px">
            <span style="display:inline-block;width:28px;height:28px;background:#4ecde6;color:#0a0a0a;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:13px;margin-right:10px">3</span>
            <span style="color:#aaa">Share your booking link with parents</span>
          </td></tr>
          <tr><td style="padding:8px 0;color:#aaa;font-size:14px">
            <span style="display:inline-block;width:28px;height:28px;background:#4ecde6;color:#0a0a0a;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:13px;margin-right:10px">4</span>
            <a href="${params.dashboardUrl}/players/import" style="color:#4ecde6;text-decoration:none;font-weight:500">Import existing players</a>
          </td></tr>
        </table>
      </div>

      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0;text-align:center">
        <p style="margin:0 0 4px;color:#aaa;font-size:13px">Your booking page</p>
        <p style="margin:0;color:#4ecde6;font-size:14px;font-weight:600;font-family:monospace">${appUrl}/book/${params.academyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</p>
      </div>

      <div style="text-align:center;margin:28px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg, #4ecde6, #2ba8c3);color:#0a0a0a;padding:16px 40px;border-radius:12px;font-weight:700;text-decoration:none;font-size:16px;letter-spacing:-0.3px">Open Your Dashboard →</a>
      </div>

      <div style="text-align:center;padding:16px;border-top:1px solid #1e1e1e;margin-top:20px">
        <p style="margin:0;color:#555;font-size:12px">🎉 Your 14-day free trial has started. No credit card required.</p>
        <p style="margin:8px 0 0;color:#444;font-size:11px">Need help? Reply to this email — we read every message.</p>
      </div>
    `),
  }
}

export function enrolmentConfirmationEmail(params: { parentName: string; childName: string; className: string; dayTime: string; academyName: string; dashboardUrl: string }) {
  return {
    subject: `${params.childName} is enrolled! — ${params.className}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Enrolment confirmed ✅</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong> is now enrolled in <strong>${params.className}</strong> at <strong>${params.academyName}</strong>.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#999">Class</td><td style="text-align:right;font-weight:600">${params.className}</td></tr>
          <tr><td style="color:#999">Schedule</td><td style="text-align:right">${params.dayTime}</td></tr>
          <tr><td style="color:#999">Player</td><td style="text-align:right">${params.childName}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:12px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px">View Schedule</a>
      </div>
    `),
  }
}

export function reviewPromptEmail(params: {
  parentName: string
  childName: string
  academyName: string
  sessionCount: number
  dashboardUrl: string
}) {
  return {
    subject: `How's ${params.childName} doing at ${params.academyName}?`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">We'd love your feedback!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong> has now completed <strong>${params.sessionCount} sessions</strong> at <strong>${params.academyName}</strong> — what a milestone!</p>
      <p style="color:#aaa;line-height:1.6">We'd love to know how things are going. It only takes a moment.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Share Your Feedback</a>
      </div>
      <p style="color:#666;font-size:13px;margin-top:24px;text-align:center">Your feedback helps us improve and helps other parents find us.</p>
    `),
  }
}

export function certExpiryEmail(params: {
  coachName: string
  certName: string
  certType: string
  expiryDate: string
  daysUntilExpiry: number
  dashboardUrl: string
}) {
  const isExpired = params.daysUntilExpiry < 0
  const urgencyColor = isExpired ? '#ef4444' : params.daysUntilExpiry <= 7 ? '#ef4444' : '#f59e0b'
  return {
    subject: isExpired
      ? `Certification expired: ${params.certName}`
      : `Certification expiring in ${params.daysUntilExpiry} days: ${params.certName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">${isExpired ? 'Certification Expired' : 'Certification Expiring Soon'}</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.coachName},</p>
      <p style="color:#aaa;line-height:1.6">${
        isExpired
          ? `Your <strong>${params.certName}</strong> certification has expired. Please renew it as soon as possible to remain compliant.`
          : `Your <strong>${params.certName}</strong> certification is expiring in <strong style="color:${urgencyColor}">${params.daysUntilExpiry} days</strong>. Please arrange renewal before it expires.`
      }</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#ddd">
          <tr><td style="color:#999;padding:4px 0">Certificate</td><td style="text-align:right;font-weight:600">${params.certName}</td></tr>
          <tr><td style="color:#999;padding:4px 0">Type</td><td style="text-align:right">${params.certType}</td></tr>
          <tr><td style="color:#999;padding:4px 0">${isExpired ? 'Expired' : 'Expires'}</td><td style="text-align:right;color:${urgencyColor};font-weight:600">${params.expiryDate}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:12px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px">Update Certifications</a>
      </div>
    `),
  }
}

// ─── Trial Funnel Emails ────────────────────────────────────────────────────

export function trialReminder48hEmail(params: {
  parentName: string
  childName: string
  academyName: string
  className: string
  date: string
  location: string
}) {
  return {
    subject: `See you on ${params.date}! — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">See you on ${params.date}!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">We're excited to welcome <strong>${params.childName}</strong> to their free taster session at <strong>${params.academyName}</strong>!</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#999">Class</td><td style="text-align:right;font-weight:600">${params.className}</td></tr>
          <tr><td style="color:#999">Date</td><td style="text-align:right;font-weight:600">${params.date}</td></tr>
          <tr><td style="color:#999">Location</td><td style="text-align:right">${params.location}</td></tr>
        </table>
      </div>
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0;border-left:3px solid #4ecde6">
        <p style="margin:0 0 8px;font-size:14px;color:#4ecde6;font-weight:700">What to bring</p>
        <ul style="padding-left:18px;margin:0;color:#aaa;font-size:13px;line-height:1.8">
          <li>Comfortable sports kit &amp; trainers (astro boots if outdoors)</li>
          <li>Water bottle</li>
          <li>A positive attitude!</li>
        </ul>
      </div>
      <p style="color:#aaa;line-height:1.6">No pressure, no commitment — just turn up, have fun, and see if it's the right fit. We can't wait to meet ${params.childName}!</p>
      <p style="color:#666;font-size:13px;text-align:center;margin-top:24px">Questions? Just reply to this email.</p>
    `),
  }
}

export function trialReminder24hEmail(params: {
  parentName: string
  childName: string
  academyName: string
  className: string
  date: string
  location: string
  mapUrl?: string
}) {
  return {
    subject: `Tomorrow's the day! — ${params.childName}'s taster session`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Tomorrow's the day!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong>'s free taster session at <strong>${params.academyName}</strong> is <strong>tomorrow</strong>. Here's everything you need:</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#999">Class</td><td style="text-align:right;font-weight:600">${params.className}</td></tr>
          <tr><td style="color:#999">Date</td><td style="text-align:right;font-weight:600">${params.date}</td></tr>
          <tr><td style="color:#999">Location</td><td style="text-align:right">${params.location}</td></tr>
        </table>
      </div>
      ${params.mapUrl ? `<div style="text-align:center;margin:20px 0">
        <a href="${params.mapUrl}" style="display:inline-block;background:#1a1a1a;color:#4ecde6;padding:12px 24px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px;border:1px solid #333">📍 Get Directions</a>
      </div>` : ''}
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0;border-left:3px solid #f59e0b">
        <p style="margin:0 0 8px;font-size:14px;color:#f59e0b;font-weight:700">Quick reminders</p>
        <ul style="padding-left:18px;margin:0;color:#aaa;font-size:13px;line-height:1.8">
          <li>Arrive 5-10 minutes early so ${params.childName} can settle in</li>
          <li>Bring comfortable sports kit, trainers &amp; a water bottle</li>
          <li>Parents are welcome to stay and watch</li>
        </ul>
      </div>
      <p style="color:#666;font-size:13px;text-align:center;margin-top:24px">Can't make it? Just reply to this email and we'll rearrange.</p>
    `),
  }
}

export function trialReminder2hEmail(params: {
  parentName: string
  childName: string
  academyName: string
  className: string
  location: string
}) {
  return {
    subject: `Almost time! — ${params.childName}'s session starts soon`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Almost time!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong>'s taster session is starting soon at <strong>${params.location}</strong>.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0;border-left:3px solid #10b981">
        <p style="margin:0 0 8px;font-size:14px;color:#10b981;font-weight:700">Quick tips for a great first session</p>
        <ul style="padding-left:18px;margin:0;color:#aaa;font-size:13px;line-height:1.8">
          <li>Introduce ${params.childName} to the coach on arrival</li>
          <li>Let them know it's okay to make mistakes — everyone does!</li>
          <li>Encourage them to have fun and try their best</li>
        </ul>
      </div>
      <p style="color:#aaa;line-height:1.6">We'll take care of the rest. See you shortly!</p>
      <p style="color:#666;font-size:13px;text-align:center;margin-top:24px">📍 ${params.location}</p>
    `),
  }
}

export function trialConversionEmail(params: {
  parentName: string
  childName: string
  academyName: string
  className: string
  discountCode: string
  signupUrl: string
}) {
  return {
    subject: `How did ${params.childName} enjoy their session? — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">How did ${params.childName} enjoy it?</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">We hope <strong>${params.childName}</strong> had a brilliant time at the <strong>${params.className}</strong> taster session with <strong>${params.academyName}</strong>!</p>
      <p style="color:#aaa;line-height:1.6">If they loved it, we'd love to have them back. Here's a special offer just for taster families:</p>
      <div style="background:linear-gradient(135deg,#0d2818,#0a1f14);border:2px solid #10b981;border-radius:16px;padding:24px;margin:24px 0;text-align:center">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#10b981">First month</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#4ecde6">20% OFF</p>
        <p style="margin:8px 0 0;font-size:13px;color:#aaa">Sign up within 7 days</p>
        <div style="background:#1a1a1a;border-radius:8px;padding:10px;margin-top:12px;display:inline-block">
          <p style="margin:0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px">Your code</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#4ecde6;letter-spacing:2px;font-family:monospace">${params.discountCode}</p>
        </div>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.signupUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:16px 40px;border-radius:14px;font-weight:700;text-decoration:none;font-size:16px">Sign Up Now</a>
      </div>
      <p style="color:#666;font-size:13px;text-align:center">Questions? Just reply to this email — we'd love to hear from you.</p>
    `),
  }
}

export function certExpiryAdminEmail(params: {
  adminName: string
  coachName: string
  certName: string
  certType: string
  expiryDate: string
  daysUntilExpiry: number
  dashboardUrl: string
}) {
  const isExpired = params.daysUntilExpiry < 0
  return {
    subject: isExpired
      ? `Coach cert expired: ${params.coachName} - ${params.certName}`
      : `Coach cert expiring: ${params.coachName} - ${params.certName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Coach Certification Alert</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.adminName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.coachName}</strong>'s <strong>${params.certName}</strong> ${
        isExpired ? 'has expired' : `is expiring in <strong style="color:#f59e0b">${params.daysUntilExpiry} days</strong>`
      }. Please follow up to ensure compliance.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#ddd">
          <tr><td style="color:#999;padding:4px 0">Coach</td><td style="text-align:right;font-weight:600">${params.coachName}</td></tr>
          <tr><td style="color:#999;padding:4px 0">Certificate</td><td style="text-align:right">${params.certName}</td></tr>
          <tr><td style="color:#999;padding:4px 0">Type</td><td style="text-align:right">${params.certType}</td></tr>
          <tr><td style="color:#999;padding:4px 0">${isExpired ? 'Expired' : 'Expires'}</td><td style="text-align:right;color:${isExpired ? '#ef4444' : '#f59e0b'};font-weight:600">${params.expiryDate}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:12px 28px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px">View Compliance</a>
      </div>
    `),
  }
}

export function monthlyHighlightsEmail(params: {
  parentName: string
  childName: string
  academyName: string
  monthLabel: string
  sessionsAttended: number
  attendanceRate: number
  highlightsUrl: string
}) {
  return {
    subject: `${params.childName}'s ${params.monthLabel} highlights are ready!`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Monthly Highlights Ready!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6"><strong>${params.childName}</strong>'s <strong>${params.monthLabel}</strong> highlight reel is ready to view and share!</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
        <div style="display:inline-block;margin:0 16px">
          <div style="font-size:28px;font-weight:800;color:#4ecde6">${params.sessionsAttended}</div>
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Sessions</div>
        </div>
        <div style="display:inline-block;margin:0 16px">
          <div style="font-size:28px;font-weight:800;color:#4ecde6">${params.attendanceRate}%</div>
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Attendance</div>
        </div>
      </div>
      <p style="color:#aaa;line-height:1.6">Download the highlight card and share it on Instagram, WhatsApp, or anywhere you like!</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.highlightsUrl}" style="display:inline-block;background:linear-gradient(135deg, #a855f7, #ec4899);color:#ffffff;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">View Highlights</a>
      </div>
      <p style="color:#666;font-size:13px">From ${params.academyName}</p>
    `),
  }
}

export function newLeadEmail(params: {
  academyName: string
  leadName: string
  email?: string
  phone?: string
  childName?: string
  interestedIn?: string
  source: string
  dashboardUrl: string
}) {
  const sourceLabel = params.source.replace(/_/g, ' ')
  return {
    subject: `🎯 New enquiry — ${params.leadName}${params.childName ? ` (${params.childName})` : ''}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">🎯 New enquiry just came in</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.6">
        Someone's interested in <strong style="color:#fff">${params.academyName}</strong>. The faster you reply, the more likely they book — try to reach out today.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:120px">Name</td><td style="color:#fff;font-weight:600">${params.leadName}</td></tr>
          ${params.email ? `<tr><td style="color:#888">Email</td><td><a href="mailto:${params.email}" style="color:#4ecde6">${params.email}</a></td></tr>` : ''}
          ${params.phone ? `<tr><td style="color:#888">Phone</td><td><a href="tel:${params.phone}" style="color:#4ecde6">${params.phone}</a></td></tr>` : ''}
          ${params.childName ? `<tr><td style="color:#888">Child</td><td style="color:#fff">${params.childName}</td></tr>` : ''}
          ${params.interestedIn ? `<tr><td style="color:#888">Interested in</td><td style="color:#fff">${params.interestedIn}</td></tr>` : ''}
          <tr><td style="color:#888">Source</td><td style="color:#fff;text-transform:capitalize">${sourceLabel}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}/dashboard/leads" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Open your leads →</a>
      </div>
      <p style="color:#666;font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center">
        Tip: academies that reply within the hour convert far more enquiries than those that wait a day.
      </p>
    `),
  }
}

/**
 * Parent-facing email sent at Checkout for FUTURE-START CALENDAR-MODE signups
 * (Stage 3 useFutureProrated branch — setup mode / SetupIntent only).
 *
 * The session-bridge path uses subscriptionStartedEmail (with the bridge
 * billingContext variant) because Stripe has actually charged the bridge.
 * Setup-mode signups have NO charge today — Stripe never sends a receipt, so
 * without this email the parent gets nothing between checkout and the cron's
 * activation on start_date.
 *
 * The activation cron will eventually trigger a regular subscriptionStartedEmail
 * via the customer.subscription.created webhook chain. This template fills the
 * gap.
 */
export function scheduledSignupConfirmationEmail(params: {
  parentName: string
  childName?: string
  academyName: string
  planName: string
  className?: string
  activatesOnLabel: string   // e.g. "Thu 4 June 2026"
  monthlyAmount: string       // e.g. "£28.00"
  estimatedFirstCharge?: string // optional, the cron will charge the prorated amount; if known, show it
  anchorLabel?: string         // first of month AFTER activatesOn, e.g. "1 July 2026"
  dashboardUrl: string
  academyLogoUrl?: string
  academyContactEmail?: string
}) {
  const greetingName = params.parentName.split(' ')[0] || params.parentName
  const firstChargeLine = params.estimatedFirstCharge
    ? `<tr><td style="color:#888;width:140px">First charge</td><td style="color:#fff;text-align:right;font-weight:600">${params.estimatedFirstCharge}</td></tr>
       <tr><td colspan="2" style="color:#aaa;padding-top:0;padding-bottom:8px;font-size:13px">↳ billed on ${params.activatesOnLabel}, pro-rata to ${params.anchorLabel ?? 'the 1st of next month'}</td></tr>`
    : `<tr><td style="color:#888;width:140px">First charge</td><td style="color:#fff;text-align:right;font-weight:600">${params.activatesOnLabel}</td></tr>
       <tr><td colspan="2" style="color:#aaa;padding-top:0;padding-bottom:8px;font-size:13px">↳ pro-rata for the days until ${params.anchorLabel ?? 'the 1st of next month'}</td></tr>`

  return {
    subject: `Your start date is confirmed — ${params.className ?? params.planName} on ${params.activatesOnLabel}`,
    html: baseLayout(`
      ${params.academyLogoUrl ? `<div style="text-align:center;margin-bottom:20px"><img src="${params.academyLogoUrl}" alt="${params.academyName}" style="max-width:96px;max-height:96px;border-radius:14px" /></div>` : ''}
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:24px">Start date locked in 📅</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.6">
        Hi ${greetingName} — we've saved your card for <strong style="color:#fff">${params.academyName}</strong>.
        ${params.childName ? `<strong style="color:#fff">${params.childName}</strong>'s` : 'Your'} first session is <strong style="color:#fff">${params.activatesOnLabel}</strong>.
        <strong style="color:#fff">No charge today</strong> — your subscription kicks off on your start date.
      </p>

      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:12px;color:#4ecde6;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">💳 Your billing</p>
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Plan</td><td style="color:#fff;text-align:right;font-weight:600">${params.planName}</td></tr>
          ${params.className ? `<tr><td style="color:#888">Class</td><td style="color:#fff;text-align:right">${params.className}</td></tr>` : ''}
          <tr><td style="color:#888">Start date</td><td style="color:#fff;text-align:right;font-weight:600">${params.activatesOnLabel}</td></tr>
          ${firstChargeLine}
          <tr><td style="color:#888;border-top:1px solid #2a2a2a;padding-top:12px">From ${params.anchorLabel ?? 'the 1st of next month'}</td><td style="color:#fff;text-align:right;font-weight:600;border-top:1px solid #2a2a2a;padding-top:12px">${params.monthlyAmount}/month</td></tr>
          <tr><td colspan="2" style="color:#aaa;padding-top:0;font-size:13px">↳ then ${params.monthlyAmount} on the 1st of every month after that</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:16px 36px;border-radius:14px;font-weight:700;text-decoration:none;font-size:16px;box-shadow:0 8px 24px rgba(78,205,230,0.3)">View dashboard →</a>
      </div>

      <p style="color:#777;font-size:13px;line-height:1.6;margin:24px 0 0">
        🔔 We'll send a reminder before your first session. You can cancel anytime from your dashboard, no questions asked.
      </p>

      ${params.academyContactEmail ? `<p style="color:#666;font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center;padding-top:16px;border-top:1px solid #1e1e1e">Questions? Email <a href="mailto:${params.academyContactEmail}" style="color:#4ecde6">${params.academyContactEmail}</a>.</p>` : ''}
    `),
  }
}

/**
 * Org-admin notification fired on EVERY new parent signup (any billing model).
 *
 * Distinct from firstSaleEmail (which is a one-time celebration to the
 * PLATFORM admin on the org's first paid signup). This goes to the academy's
 * own admins so they see each new parent come through.
 */
export function newSignupAdminEmail(params: {
  academyName: string
  parentName: string
  parentEmail?: string
  childName?: string
  planName: string
  amount: string
  billingModelLabel: string  // human-readable, e.g. "Starts today (pro-rata)", "Bridge — £90 today, £120/mo from 1 July", "Scheduled — first charge on Thu 4 June"
  activatesOnLabel?: string
  dashboardUrl: string
}) {
  return {
    subject: `New signup: ${params.childName ?? params.parentName} — ${params.planName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">🎉 New signup at ${params.academyName}</h2>
      <p style="color:#aaa;margin:0 0 20px;line-height:1.6">
        ${params.parentName}${params.childName ? ` signed <strong style="color:#fff">${params.childName}</strong> up for` : ' just signed up for'} <strong style="color:#fff">${params.planName}</strong>.
      </p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:140px">Parent</td><td style="color:#fff;font-weight:600">${params.parentName}</td></tr>
          ${params.parentEmail ? `<tr><td style="color:#888">Email</td><td><a href="mailto:${params.parentEmail}" style="color:#4ecde6">${params.parentEmail}</a></td></tr>` : ''}
          ${params.childName ? `<tr><td style="color:#888">Child</td><td style="color:#fff">${params.childName}</td></tr>` : ''}
          <tr><td style="color:#888">Plan</td><td style="color:#fff">${params.planName} (${params.amount}/month)</td></tr>
          ${params.activatesOnLabel ? `<tr><td style="color:#888">Start date</td><td style="color:#fff">${params.activatesOnLabel}</td></tr>` : ''}
          <tr><td style="color:#888">Billing</td><td style="color:#fff">${params.billingModelLabel}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}/dashboard/players" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">Open dashboard →</a>
      </div>
    `),
  }
}

/**
 * Sprint 9 — camp booking confirmation.
 *
 * Fired from the Stripe webhook camp-branch after a successful paid
 * Checkout completion. Includes optional WhatsApp deep-link (Sprint 6).
 *
 * No subscription / billing context — camps are one-off `mode='payment'`
 * charges so this email is strictly transactional ("you're booked in,
 * here's what we have on file, here's how to reach us").
 *
 * Idempotency: the email send is gated by the `stripe_events` table
 * (migration 069) — a re-delivered webhook event short-circuits the
 * entire handler before reaching this branch. No additional dedup is
 * required at the template / send layer.
 */
export function campBookingConfirmationEmail(params: {
  parentName: string
  childName: string
  campName: string
  startDate: string             // already-formatted "Mon 21 Jul 2026"
  endDate: string               // already-formatted; equal to startDate for single-day camps
  amountPaid: string            // already-formatted "£60.00" (or "Free" when £0)
  academyName: string
  academyContactEmail: string | null
  academyContactPhone: string | null
  whatsappUrl?: string | null   // pre-built via @/lib/whatsapp (Sprint 6)
  bookingReference?: string | null   // camp_bookings.id surfaces here for support
}) {
  const sameDay = params.startDate === params.endDate
  const dateRow = sameDay
    ? `<tr><td style="color:#888">Date</td><td style="text-align:right;color:#fff;font-weight:600">${params.startDate}</td></tr>`
    : `<tr><td style="color:#888">Dates</td><td style="text-align:right;color:#fff;font-weight:600">${params.startDate} → ${params.endDate}</td></tr>`

  const contactRows = [
    params.academyContactEmail
      ? `<tr><td style="color:#888">Email</td><td style="text-align:right"><a href="mailto:${params.academyContactEmail}" style="color:#4ecde6;text-decoration:none">${params.academyContactEmail}</a></td></tr>`
      : '',
    params.academyContactPhone
      ? `<tr><td style="color:#888">Phone</td><td style="text-align:right;color:#fff">${params.academyContactPhone}</td></tr>`
      : '',
  ].filter(Boolean).join('')

  return {
    subject: `Your booking for ${params.campName} is confirmed — ${params.childName} ✓`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">You're all booked in! 🎯</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">
        <strong style="color:#fff">${params.childName}</strong> is now booked onto
        <strong style="color:#fff">${params.campName}</strong> at <strong style="color:#fff">${params.academyName}</strong>.
        We can't wait to see them on the pitch.
      </p>

      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:11px;color:#888;letter-spacing:0.05em;text-transform:uppercase;font-weight:600">Booking details</p>
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          <tr><td style="color:#888;width:120px">Camp</td><td style="text-align:right;color:#fff;font-weight:600">${params.campName}</td></tr>
          <tr><td style="color:#888">Child</td><td style="text-align:right;color:#fff">${params.childName}</td></tr>
          ${dateRow}
          <tr><td style="color:#888">Amount paid</td><td style="text-align:right;color:#10b981;font-weight:700">${params.amountPaid}</td></tr>
          ${params.bookingReference ? `<tr><td style="color:#888">Reference</td><td style="text-align:right;color:#aaa;font-family:monospace;font-size:12px">${params.bookingReference.slice(0, 8)}</td></tr>` : ''}
        </table>
      </div>

      ${contactRows ? `
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:11px;color:#888;letter-spacing:0.05em;text-transform:uppercase;font-weight:600">Need to reach ${params.academyName}?</p>
        <table style="width:100%;font-size:14px;color:#ddd" cellpadding="6">
          ${contactRows}
        </table>
      </div>` : ''}

      ${params.whatsappUrl ? `
      <div style="text-align:center;margin:24px 0">
        <a href="${params.whatsappUrl}" style="display:inline-block;background:#25D366;color:#ffffff;padding:14px 28px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px">💬 Message ${params.academyName} on WhatsApp</a>
      </div>` : ''}

      <p style="color:#666;font-size:13px;text-align:center;margin-top:24px">
        Keep this email for your records. We'll be in touch closer to the camp date with any final details.
      </p>
    `),
  }
}
