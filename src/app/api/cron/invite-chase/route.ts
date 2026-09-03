import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

/**
 * Chase unconfirmed payment invites — automatically.
 *
 * Why this exists
 * ---------------
 * A `pending_migration` subscription cannot take money until the parent opens
 * their link and adds a card. Nothing in the platform ever followed those up.
 * On 2026-08-31 there were 95 sitting unconfirmed across two academies — 79 at
 * one, 16 at the other — worth roughly £6,000/month, some invited in June and
 * never chased once. Every one of them was a parent who had simply forgotten,
 * and an academy that had no way of knowing.
 *
 * Cadence is derived from `invite_sent_at`, not stored, so this needs no schema
 * change and cannot double-send within a day:
 *   day 3, 7, 14  -> remind the PARENT, with their own confirm link
 *   day 21        -> tell the ACADEMY who is still outstanding, and what it is
 *                    costing them. The academy owner should not need John to
 *                    tell them this.
 *
 * Never touches Stripe, never changes a subscription's status, never charges
 * anything. It only sends email.
 */

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const PARENT_CHASE_DAYS = [3, 7, 14]
const ACADEMY_ESCALATE_DAY = 21
const MAX_SENDS_PER_RUN = 120

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86400000)
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.theplayerportal.net'

  try {
    const { data: subs, error } = await sb
      .from('subscriptions')
      .select('id, organisation_id, parent_id, player_id, plan_id, invite_token, invite_sent_at')
      .eq('status', 'pending_migration')
      .not('invite_sent_at', 'is', null)
      .is('invite_confirmed_at', null)
      .limit(2000)
    if (error) throw new Error(error.message)

    const outstanding = (subs || []).filter((s) => s.invite_token)
    if (!outstanding.length) {
      return NextResponse.json({ ranAt: new Date().toISOString(), outstanding: 0, parentReminders: 0, academyDigests: 0 })
    }

    const ids = (k: 'organisation_id' | 'parent_id' | 'player_id' | 'plan_id') =>
      [...new Set(outstanding.map((s) => s[k]).filter(Boolean))] as string[]
    const [orgsRes, parentsRes, playersRes, plansRes] = await Promise.all([
      sb.from('organisations').select('id, name, primary_color, contact_email').in('id', ids('organisation_id')),
      sb.from('profiles').select('id, full_name, email').in('id', ids('parent_id')),
      sb.from('players').select('id, first_name, last_name').in('id', ids('player_id')),
      sb.from('subscription_plans').select('id, name, amount').in('id', ids('plan_id')),
    ])
    const orgs = new Map((orgsRes.data || []).map((o) => [o.id, o]))
    const parents = new Map((parentsRes.data || []).map((p) => [p.id, p]))
    const players = new Map((playersRes.data || []).map((p) => [p.id, p]))
    const plans = new Map((plansRes.data || []).map((p) => [p.id, p]))

    let parentReminders = 0
    let academyDigests = 0
    const failures: string[] = []
    const escalate = new Map<string, { name: string; amount: number }[]>()

    for (const s of outstanding) {
      const age = daysSince(s.invite_sent_at)
      if (age === null) continue
      const org = orgs.get(s.organisation_id) as { name?: string; primary_color?: string; contact_email?: string } | undefined
      const parent = parents.get(s.parent_id as string) as { full_name?: string; email?: string } | undefined
      const player = players.get(s.player_id as string) as { first_name?: string; last_name?: string } | undefined
      const plan = plans.get(s.plan_id as string) as { name?: string; amount?: number } | undefined
      const academy = org?.name || 'Your academy'
      const child = (player?.first_name || 'your child').trim()
      const amount = Number(plan?.amount ?? 0)

      // Anything past the escalation point is reported to the academy, every
      // run, until it is dealt with. A problem that gets older must not get
      // quieter — that is exactly how the last 95 went unnoticed.
      if (age >= ACADEMY_ESCALATE_DAY) {
        const list = escalate.get(s.organisation_id) || []
        list.push({ name: `${child} ${(player?.last_name || '').trim()}`.trim(), amount })
        escalate.set(s.organisation_id, list)
        continue
      }

      if (!PARENT_CHASE_DAYS.includes(age)) continue
      if (!parent?.email) continue
      if (parentReminders >= MAX_SENDS_PER_RUN) break

      const brand = org?.primary_color || '#4ecde6'
      const link = `${origin}/confirm-subscription/${s.invite_token}`
      const price = amount > 0 ? `£${amount.toFixed(2)}/month` : 'their place'
      const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff">
  <div style="padding:22px 30px;background:${brand};color:#0a0a0a"><h1 style="margin:0;font-size:19px;font-weight:800">${esc(academy)}</h1></div>
  <div style="padding:28px 30px;color:#1a1a1a;line-height:1.6">
    <p style="font-size:15px;margin:0 0 14px">Hi ${esc(parent.full_name || 'there')},</p>
    <p style="font-size:15px;color:#444;margin:0 0 16px">${esc(child)}'s membership hasn't been set up yet, so their place isn't confirmed.</p>
    <p style="font-size:15px;color:#444;margin:0 0 20px">It takes about 30 seconds — <strong>${price}</strong>, and nothing is taken until you confirm.</p>
    <p style="text-align:center;margin:26px 0">
      <a href="${link}" style="background:${brand};color:#0a0a0a;padding:14px 30px;text-decoration:none;border-radius:999px;font-weight:700;display:inline-block;font-size:15px">Set up ${esc(child)}'s membership</a>
    </p>
    <p style="font-size:13px;color:#777;margin:18px 0 0">Already sorted this, or ${esc(child)} isn't training any more? Just reply and we'll take it off.</p>
  </div>
  <div style="padding:14px 30px;background:#f8f8f8;color:#888;font-size:12px;text-align:center;border-top:1px solid #eee">${esc(academy)} · Powered by Player Portal</div>
</div>`
      const res = await sendEmail({
        to: parent.email,
        subject: `${academy}: ${child}'s place isn't confirmed yet`,
        html,
        fromName: academy,
        replyTo: org?.contact_email || undefined,
      })
      if (res.success && !('skipped' in res && res.skipped)) parentReminders++
      else failures.push(`${parent.email}: send failed`)
    }

    // ── Escalation: tell the ACADEMY, not John ──
    for (const [orgId, list] of escalate) {
      const org = orgs.get(orgId) as { name?: string; contact_email?: string } | undefined
      const to = org?.contact_email
      if (!to || academyDigests >= 20) continue
      const total = list.reduce((s, x) => s + x.amount, 0)
      const html = `<div style="font-family:-apple-system,sans-serif;max-width:620px;color:#111">
  <h2 style="margin:0 0 6px">${list.length} ${list.length === 1 ? 'family has' : 'families have'} not set up payment</h2>
  <p style="color:#555;margin:0 0 14px">These places aren't confirmed and no money is being collected for them${total > 0 ? ` — about <strong>£${total.toFixed(2)}/month</strong>` : ''}. They were invited more than three weeks ago and reminded since.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${list.map((x) => `<tr><td style="padding:5px 0;border-bottom:1px solid #eee">${esc(x.name)}</td><td style="padding:5px 0;border-bottom:1px solid #eee;text-align:right;color:#555">${x.amount > 0 ? `£${x.amount.toFixed(2)}/mo` : '—'}</td></tr>`).join('')}
  </table>
  <p style="color:#666;font-size:13px;margin:16px 0 0">Either chase them directly, or remove them from their class if they've stopped. Leaving it as-is means they keep training for free.</p>
</div>`
      const res = await sendEmail({
        to,
        subject: `${list.length} ${list.length === 1 ? 'family has' : 'families have'} not set up payment${total > 0 ? ` — £${total.toFixed(0)}/mo` : ''}`,
        html,
        fromName: 'Player Portal',
      })
      if (res.success && !('skipped' in res && res.skipped)) academyDigests++
      else failures.push(`${to}: academy digest failed`)
    }

    return NextResponse.json({
      ranAt: new Date().toISOString(),
      outstanding: outstanding.length,
      parentReminders,
      academyDigests,
      ...(failures.length ? { failures } : {}),
    }, { status: failures.length ? 500 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[invite-chase] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
