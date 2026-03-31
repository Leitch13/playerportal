// Base layout wrapper with Player Portal branding
function baseLayout(content: string, accentColor = '#4ecde6'): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://theplayerportal.net'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px">
<div style="background:linear-gradient(135deg, #0a0a0a 0%, #141414 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;border:1px solid #1e1e1e;border-bottom:none">
<h1 style="margin:0;color:${accentColor};font-size:22px;font-weight:800;letter-spacing:-0.5px">⚽ Player Portal</h1>
<p style="margin:6px 0 0;color:#666;font-size:12px;letter-spacing:1px;text-transform:uppercase">by playit loveit</p>
</div>
<div style="background:#141414;padding:32px;border-radius:0 0 16px 16px;border:1px solid #1e1e1e;border-top:none">
${content}
</div>
<div style="text-align:center;padding:16px;color:#555;font-size:12px">
<p style="margin:0">Sent by Player Portal &bull; <a href="${appUrl}" style="color:${accentColor};text-decoration:none">Visit Dashboard</a></p>
<p style="margin:6px 0 0;color:#333;font-size:11px">You&apos;re receiving this because you have an account on Player Portal.</p>
<p style="margin:6px 0 0;color:#333;font-size:11px">&copy; 2026 Play It Love It Ltd. All rights reserved.</p>
</div>
</div></body></html>`
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
}) {
  return {
    subject: `Welcome to ${params.academyName}!`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:#ffffff;font-size:22px">Welcome aboard!</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">You've successfully signed up to <strong>${params.academyName}</strong> on Player Portal.</p>
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0 0 12px;font-size:14px;color:#ddd;font-weight:600">What's next?</p>
        <p style="margin:0 0 8px;font-size:14px;color:#aaa">1. Add your child's profile</p>
        <p style="margin:0 0 8px;font-size:14px;color:#aaa">2. Browse available classes</p>
        <p style="margin:0;font-size:14px;color:#aaa">3. Choose a plan and get started</p>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${params.dashboardUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">Go to Dashboard</a>
      </div>
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
        <td style="padding:6px 0;font-size:13px;color:#333;width:140px">${s.category}</td>
        <td style="padding:6px 0">
          <div style="background:#f0f0f0;border-radius:6px;height:8px;width:100%">
            <div style="background:#4ecde6;border-radius:6px;height:8px;width:${barWidth}%"></div>
          </div>
        </td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;color:#333;text-align:right;width:30px">${s.score.toFixed(1)}</td>
      </tr>`
    })
    .join('')

  const strengthsHtml = params.strengths.length > 0
    ? params.strengths.map(s => `<li style="margin:4px 0;font-size:13px;color:#333">✅ ${s}</li>`).join('')
    : '<li style="margin:4px 0;font-size:13px;color:#999">No strengths highlighted yet</li>'

  const focusHtml = params.focusAreas.length > 0
    ? params.focusAreas.map(s => `<li style="margin:4px 0;font-size:13px;color:#333">🎯 ${s}</li>`).join('')
    : '<li style="margin:4px 0;font-size:13px;color:#999">No focus areas highlighted yet</li>'

  return {
    subject: `${params.childName}'s progress report — ${params.academyName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 4px;color:#ffffff;font-size:22px">Progress Report</h2>
      <p style="color:#aaa;margin:0 0 20px">Hi ${params.parentName},</p>
      <p style="color:#aaa;line-height:1.6">Here's the latest progress update for <strong>${params.childName}</strong> at <strong>${params.academyName}</strong>.</p>

      <!-- Overall Score -->
      <div style="background:#f8f9fa;border-radius:16px;padding:20px;margin:20px 0;text-align:center">
        <p style="margin:0 0 4px;font-size:13px;color:#999">Overall Rating</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#4ecde6">${params.overallScore.toFixed(1)}<span style="font-size:16px;color:#999">/5</span></p>
        <p style="margin:4px 0 0;font-size:18px;letter-spacing:2px;color:#f59e0b">${starRating}</p>
      </div>

      <!-- Attendance -->
      <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;margin:16px 0">
        <p style="margin:0;font-size:13px;color:#1e40af">📅 <strong>${params.sessionsAttended} sessions</strong> attended · <strong>${params.attendanceRate}%</strong> attendance rate</p>
      </div>

      <!-- Skill Scores -->
      <p style="font-size:14px;font-weight:600;color:#333;margin:20px 0 8px">Skills Breakdown</p>
      <table style="width:100%;border-collapse:collapse" cellpadding="0">
        ${scoresHtml}
      </table>

      <!-- Strengths -->
      <p style="font-size:14px;font-weight:600;color:#333;margin:20px 0 8px">Strengths</p>
      <ul style="padding-left:0;list-style:none;margin:0">${strengthsHtml}</ul>

      <!-- Focus Areas -->
      <p style="font-size:14px;font-weight:600;color:#333;margin:20px 0 8px">Areas to Develop</p>
      <ul style="padding-left:0;list-style:none;margin:0">${focusHtml}</ul>

      ${params.coachComment ? `
      <!-- Coach Comment -->
      <div style="border-left:3px solid #4ecde6;padding:12px 16px;background:#f8f9fa;border-radius:0 12px 12px 0;margin:20px 0">
        <p style="margin:0 0 4px;font-size:12px;color:#999;font-weight:600">Coach's Note</p>
        <p style="margin:0;font-size:13px;color:#333;line-height:1.5">${params.coachComment}</p>
      </div>` : ''}

      <div style="text-align:center;margin:24px 0">
        <a href="${params.reportUrl}" style="display:inline-block;background:#4ecde6;color:#0a0a0a;padding:14px 32px;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px">View Full Report</a>
      </div>
      <p style="color:#999;font-size:12px;text-align:center">This report was generated by ${params.academyName} on Player Portal.</p>
    `),
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
