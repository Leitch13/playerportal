import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Admin-only check
    const supabase = await createClient()
    const { data: role } = await supabase.rpc('get_my_role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const hasSecretKey = !!process.env.STRIPE_SECRET_KEY
    const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET

    const result: {
      stripe_secret_key: boolean
      stripe_webhook_secret: boolean
      webhook_url: string
      webhooks: Array<{
        id: string
        url: string
        status: string
        enabled_events: string[]
      }>
      recent_events: Array<{
        id: string
        type: string
        created: string
      }>
      error?: string
    } = {
      stripe_secret_key: hasSecretKey,
      stripe_webhook_secret: hasWebhookSecret,
      webhook_url: 'https://playerportallive.vercel.app/api/stripe/webhooks',
      webhooks: [],
      recent_events: [],
    }

    if (!hasSecretKey) {
      return NextResponse.json(result)
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    })

    // List registered webhook endpoints
    try {
      const endpoints = await stripe.webhookEndpoints.list({ limit: 10 })
      result.webhooks = endpoints.data.map((ep) => ({
        id: ep.id,
        url: ep.url,
        status: ep.status,
        enabled_events: ep.enabled_events,
      }))
    } catch {
      // Some accounts may not have permission to list webhook endpoints
    }

    // Fetch recent events
    try {
      const events = await stripe.events.list({ limit: 10 })
      result.recent_events = events.data.map((ev) => ({
        id: ev.id,
        type: ev.type,
        created: new Date(ev.created * 1000).toISOString(),
      }))
    } catch {
      // Ignore if events cannot be listed
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
