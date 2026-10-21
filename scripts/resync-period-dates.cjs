// Correct subscriptions.current_period_start/end from Stripe (dry run unless APPLY=1).
const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')
const st = new Stripe(process.env.STRIPE_SECRET_KEY)
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const period = (x) => { const it = (x.items?.data || []).filter(i => typeof i.current_period_end === 'number').sort((a, b) => a.current_period_end - b.current_period_end)[0]; return { start: it?.current_period_start ?? x.current_period_start ?? null, end: it?.current_period_end ?? x.current_period_end ?? null } }
;(async () => {
  const { data: orgs } = await s.from('organisations').select('id,name,stripe_account_id'); const org = Object.fromEntries(orgs.map(o => [o.id, o]))
  const { data: rows } = await s.from('subscriptions').select('id,organisation_id,stripe_subscription_id,status,current_period_start,current_period_end').in('status', ['active', 'trialing', 'past_due', 'paused', 'incomplete']).not('stripe_subscription_id', 'is', null)
  const out = { checked: 0, same: 0, fixed: 0, missing: 0, byOrg: {} }
  for (const r of rows) {
    out.checked++
    let x = null
    try { x = await st.subscriptions.retrieve(r.stripe_subscription_id) } catch { try { if (org[r.organisation_id]?.stripe_account_id) x = await st.subscriptions.retrieve(r.stripe_subscription_id, {}, { stripeAccount: org[r.organisation_id].stripe_account_id }) } catch {} }
    if (!x) { out.missing++; continue }
    const p = period(x); if (!p.end) { out.missing++; continue }
    const want = new Date(p.end * 1000).toISOString(), have = r.current_period_end ? new Date(r.current_period_end).toISOString() : null
    if (have && Math.abs(Date.parse(have) - p.end * 1000) < 60000) { out.same++; continue }
    const n = org[r.organisation_id]?.name || r.organisation_id; out.byOrg[n] = (out.byOrg[n] || 0) + 1
    if (out.fixed < 6) console.log('  ', n, '|', (have || 'none').slice(0, 10), '->', want.slice(0, 10))
    out.fixed++
    if (process.env.APPLY === '1') {
      const { error } = await s.from('subscriptions').update({ current_period_end: want, ...(p.start ? { current_period_start: new Date(p.start * 1000).toISOString() } : {}) }).eq('id', r.id).eq('stripe_subscription_id', r.stripe_subscription_id)
      if (error) console.log('update failed', r.id, error.message)
    }
  }
  console.log(process.env.APPLY === '1' ? 'APPLIED' : 'DRY RUN', JSON.stringify(out, null, 1))
})()
