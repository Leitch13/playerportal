import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Verify the request is from an authorized source via a secret header
    const authHeader = req.headers.get('x-push-secret')
    const pushSecret = process.env.PUSH_SECRET
    if (!pushSecret || authHeader !== pushSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { profileId, title, body, url, tag } = await req.json()

    if (!profileId || !title) {
      return NextResponse.json({ error: 'profileId and title are required' }, { status: 400 })
    }

    // Check VAPID keys
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:hello@playerportal.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      )
    }

    // Dynamic import to avoid build issues if web-push isn't needed
    const webpush = await import('web-push')
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

    // Get all subscriptions for this profile
    const supabase = await createClient()
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('profile_id', profileId)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscriptions found' })
    }

    const payload = JSON.stringify({ title, body: body || '', url: url || '/dashboard', tag })

    let sent = 0
    const expired: string[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        sent++
      } catch (pushErr: unknown) {
        const statusCode = (pushErr as { statusCode?: number })?.statusCode
        // 404 or 410 means the subscription is no longer valid
        if (statusCode === 404 || statusCode === 410) {
          expired.push(sub.id)
        }
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }

    return NextResponse.json({ sent, expired: expired.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
