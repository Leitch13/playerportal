#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Player Portal MCP server (internal admin, v1 — READ ONLY).
//
// Connects Claude (or any MCP client) to production Player Portal data:
// Supabase REST (service role) + Stripe. Credentials are pulled FRESH from
// Vercel at startup via `npx vercel env pull` into a temp file that is
// deleted immediately after parsing — nothing persists on disk.
//
// v1 is deliberately read-only: no tool mutates anything, anywhere.
// ─────────────────────────────────────────────────────────────────────────────
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ── credentials (in-memory only) ─────────────────────────────────────────────
function loadEnv() {
  const dir = mkdtempSync(join(tmpdir(), 'ppmcp-'))
  const envFile = join(dir, 'env')
  try {
    execFileSync('npx', ['-y', 'vercel', 'env', 'pull', envFile, '--environment=production', '--yes'], {
      cwd: REPO, stdio: ['ignore', 'ignore', 'ignore'], timeout: 120000,
    })
    const text = readFileSync(envFile, 'utf8')
    const get = (k) => (text.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.replace(/^["']|["']$/g, '')
    return {
      url: get('NEXT_PUBLIC_SUPABASE_URL'),
      key: get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_KEY'),
      stripe: get('STRIPE_SECRET_KEY'),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const ENV = loadEnv()
if (!ENV.url || !ENV.key) {
  console.error('pp-mcp: could not load production credentials (is `npx vercel` logged in?)')
  process.exit(1)
}

// ── helpers ──────────────────────────────────────────────────────────────────
const H = { apikey: ENV.key, Authorization: `Bearer ${ENV.key}` }

async function db(query) {
  const res = await fetch(`${ENV.url}/rest/v1/${query}`, { headers: { ...H, Prefer: 'count=exact' } })
  const count = (res.headers.get('content-range') || '').split('/')[1] || null
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`DB ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  return { rows: Array.isArray(json) ? json : [], count }
}

async function stripe(path, account) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${ENV.stripe}`, ...(account ? { 'Stripe-Account': account } : {}) },
  })
  const json = await res.json()
  if (json.error) throw new Error(`Stripe: ${json.error.message}`)
  return json
}

async function resolveOrg(nameOrSlug) {
  const q = encodeURIComponent(`%${nameOrSlug}%`)
  const { rows } = await db(`organisations?select=id,name,slug&or=(name.ilike.${q},slug.ilike.${q})&limit=5`)
  if (!rows.length) throw new Error(`No academy matching "${nameOrSlug}"`)
  return rows[0]
}

const json = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] })
const fail = (err) => ({ content: [{ type: 'text', text: `ERROR: ${err.message}` }], isError: true })

// ── server ───────────────────────────────────────────────────────────────────
const server = new McpServer({ name: 'playerportal', version: '1.0.0' })

server.registerTool('platform_overview', {
  description: 'Every academy at a glance: players, subscriptions by status, enrolments, platform trial deadlines. Start here for "how is everything doing?"',
  inputSchema: {},
}, async () => {
  try {
    const { rows: orgs } = await db('organisations?select=id,name,slug,platform_subscription_status,platform_trial_ends_at,created_at&order=created_at.asc')
    const out = []
    for (const o of orgs) {
      const [players, subs, enr] = await Promise.all([
        db(`players?select=id&organisation_id=eq.${o.id}&limit=1`),
        db(`subscriptions?select=status&organisation_id=eq.${o.id}&limit=1000`),
        db(`enrolments?select=id&organisation_id=eq.${o.id}&status=in.(active,pending)&limit=1`),
      ])
      const byStatus = {}
      for (const s of subs.rows) byStatus[s.status] = (byStatus[s.status] || 0) + 1
      out.push({
        academy: o.name, slug: o.slug,
        platform_status: o.platform_subscription_status,
        trial_ends: o.platform_trial_ends_at,
        players: Number(players.count), live_enrolments: Number(enr.count),
        subscriptions: byStatus,
      })
    }
    return json(out)
  } catch (e) { return fail(e) }
})

server.registerTool('academy_health', {
  description: 'Deep health check for ONE academy: subscription statuses, enrolment counts, paying-but-not-enrolled players, trialing subs. Pass any part of the academy name or slug.',
  inputSchema: { academy: z.string().describe('Academy name or slug (partial ok), e.g. "jamie" or "gold"') },
}, async ({ academy }) => {
  try {
    const org = await resolveOrg(academy)
    const [subs, enr, groups, plans] = await Promise.all([
      db(`subscriptions?select=id,player_id,status,current_period_end&organisation_id=eq.${org.id}&limit=2000`),
      db(`enrolments?select=player_id,status&organisation_id=eq.${org.id}&limit=5000`),
      db(`training_groups?select=id,is_published&organisation_id=eq.${org.id}&limit=500`),
      db(`subscription_plans?select=id,is_active,class_type&organisation_id=eq.${org.id}&limit=200`),
    ])
    const subStatus = {}
    for (const s of subs.rows) subStatus[s.status] = (subStatus[s.status] || 0) + 1
    const enrolled = new Set(enr.rows.filter((e) => ['active', 'pending'].includes(e.status)).map((e) => e.player_id))
    const orphans = subs.rows.filter((s) => s.status === 'active' && s.player_id && !enrolled.has(s.player_id))
    const orphanNames = []
    for (const o of orphans.slice(0, 15)) {
      const { rows } = await db(`players?select=first_name,last_name&id=eq.${o.player_id}`)
      if (rows[0]) orphanNames.push(`${rows[0].first_name} ${rows[0].last_name}`.trim())
    }
    return json({
      academy: org.name, slug: org.slug,
      subscriptions: subStatus,
      enrolments: { live: enrolled.size, total_rows: Number(enr.count) },
      classes: { total: groups.rows.length, published: groups.rows.filter((g) => g.is_published !== false).length },
      plans: { total: plans.rows.length, active: plans.rows.filter((p) => p.is_active).length },
      paying_but_not_enrolled: orphanNames,
    })
  } catch (e) { return fail(e) }
})

server.registerTool('find_player', {
  description: 'Find a player by name (partial ok) and get their full state: academy, enrolments with class names, subscriptions with status. The "what\'s the deal with X?" tool.',
  inputSchema: { name: z.string().describe('Player name or part of it, e.g. "luca" or "bailey scott"') },
}, async ({ name }) => {
  try {
    const parts = name.trim().split(/\s+/)
    const filter = parts.length > 1
      ? `and=(first_name.ilike.${encodeURIComponent('%' + parts[0] + '%')},last_name.ilike.${encodeURIComponent('%' + parts.slice(1).join(' ') + '%')})`
      : `or=(first_name.ilike.${encodeURIComponent('%' + name + '%')},last_name.ilike.${encodeURIComponent('%' + name + '%')})`
    const { rows: players } = await db(`players?select=id,first_name,last_name,organisation_id,archived_at&${filter}&limit=10`)
    const out = []
    for (const p of players) {
      const [org, enr, subs] = await Promise.all([
        db(`organisations?select=name&id=eq.${p.organisation_id}`),
        db(`enrolments?select=status,is_trial,group:training_groups(name)&player_id=eq.${p.id}`),
        db(`subscriptions?select=status,stripe_subscription_id,current_period_end,plan:subscription_plans(name,amount)&player_id=eq.${p.id}`),
      ])
      out.push({
        player: `${p.first_name} ${p.last_name}`.trim(),
        archived: !!p.archived_at,
        academy: org.rows[0]?.name,
        enrolments: enr.rows.map((e) => ({ class: e.group?.name?.trim(), status: e.status, trial: e.is_trial || false })),
        subscriptions: subs.rows.map((s) => ({ plan: s.plan?.name, amount: s.plan?.amount, status: s.status, next_bill: s.current_period_end })),
      })
    }
    return json(out.length ? out : { message: `No player matching "${name}"` })
  } catch (e) { return fail(e) }
})

server.registerTool('revenue_summary', {
  description: 'Live Stripe revenue over the last N days: paid charge count, gross volume, refunds. Real money, not projections.',
  inputSchema: { days: z.number().min(1).max(365).default(30).describe('Look-back window in days (default 30)') },
}, async ({ days }) => {
  try {
    const since = Math.floor(Date.now() / 1000) - days * 86400
    let sum = 0, n = 0, refunded = 0, after = ''
    while (true) {
      const page = await stripe(`charges?limit=100&created[gte]=${since}${after}`)
      for (const c of page.data) {
        if (c.paid && !c.refunded) { sum += c.amount; n++ }
        if (c.refunded) refunded += c.amount_refunded
      }
      if (!page.has_more) break
      after = '&starting_after=' + page.data[page.data.length - 1].id
    }
    return json({
      window_days: days,
      paid_charges: n,
      gross_volume: `£${(sum / 100).toFixed(2)}`,
      refunded: `£${(refunded / 100).toFixed(2)}`,
      daily_average: `£${(sum / 100 / days).toFixed(2)}`,
    })
  } catch (e) { return fail(e) }
})

server.registerTool('paying_not_enrolled', {
  description: 'Platform-wide audit: players with an ACTIVE subscription but no live enrolment (paying for nothing). These need fixing by re-pointing the sub or reactivating the enrolment.',
  inputSchema: {},
}, async () => {
  try {
    const [subs, enr] = await Promise.all([
      db('subscriptions?select=player_id,organisation_id&status=eq.active&limit=2000'),
      db('enrolments?select=player_id,status&limit=10000'),
    ])
    const enrolled = new Set(enr.rows.filter((e) => ['active', 'pending'].includes(e.status)).map((e) => e.player_id))
    const orphans = subs.rows.filter((s) => s.player_id && !enrolled.has(s.player_id))
    const out = []
    for (const o of orphans) {
      const [p, org] = await Promise.all([
        db(`players?select=first_name,last_name&id=eq.${o.player_id}`),
        db(`organisations?select=name&id=eq.${o.organisation_id}`),
      ])
      if (p.rows[0]) out.push({ player: `${p.rows[0].first_name} ${p.rows[0].last_name}`.trim(), academy: org.rows[0]?.name })
    }
    return json({ count: out.length, players: out })
  } catch (e) { return fail(e) }
})

server.registerTool('webhook_health', {
  description: 'Stripe webhook health: endpoint status on Stripe, total events processed, most recent events, and any failed processing ever.',
  inputSchema: {},
}, async () => {
  try {
    const [eps, recent, fails] = await Promise.all([
      stripe('webhook_endpoints?limit=10'),
      db('stripe_events?select=event_type,status,first_seen_at&order=first_seen_at.desc&limit=5'),
      db('stripe_events?select=event_type,error_message,first_seen_at&status=neq.success&order=first_seen_at.desc&limit=5'),
    ])
    return json({
      endpoints: eps.data.map((w) => ({ url: w.url, status: w.status, events: w.enabled_events.length })),
      recent_events: recent.rows,
      recent_failures: fails.rows.filter((f) => !f.event_type.startsWith('webhook_diagnostic')),
      note: 'webhook_diagnostic_* rows are old manual tests, not real failures',
    })
  } catch (e) { return fail(e) }
})

const transport = new StdioServerTransport()
await server.connect(transport)
