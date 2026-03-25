import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`onboard:${ip}`, 3, 3600000) // 3 per hour
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    // Use service role client — no user auth during onboarding
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      name,
      slug,
      description,
      contactEmail,
      contactPhone,
      location,
      primaryColor,
      logoUrl,
      heroImageUrl,
      className,
      classDay,
      classTime,
      classCapacity,
      plans,
    } = await request.json()

    if (!name || !slug || !contactEmail) {
      return NextResponse.json(
        { error: 'Name, slug, and contact email are required' },
        { status: 400 }
      )
    }

    // Check if slug is already taken
    const { data: existing } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This slug is already taken. Please choose a different one.' },
        { status: 409 }
      )
    }

    // Create the organisation
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({
        name,
        slug,
        description: description || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        location: location || null,
        primary_color: primaryColor || '#4ecde6',
        logo_url: logoUrl || null,
        hero_image_url: heroImageUrl || null,
      })
      .select('id')
      .single()

    if (orgError) {
      console.error('Organisation creation error:', orgError)
      return NextResponse.json(
        { error: orgError.message },
        { status: 500 }
      )
    }

    // If class details provided, create the first training group
    if (className && classDay && classTime) {
      const { error: groupError } = await supabase
        .from('training_groups')
        .insert({
          organisation_id: org.id,
          name: className,
          day_of_week: classDay,
          time_slot: classTime,
          max_capacity: classCapacity ? parseInt(classCapacity, 10) : 20,
        })

      if (groupError) {
        console.error('Training group creation error:', groupError)
        // Non-fatal: org was created, class can be added later
      }
    }

    // Create subscription plans — use custom plans if provided, otherwise defaults
    const customPlans = Array.isArray(plans) && plans.length > 0 ? plans : [
      { name: '1 Session / Week', amount: 30, sessions_per_week: 1 },
      { name: '2 Sessions / Week', amount: 50, sessions_per_week: 2 },
      { name: 'Unlimited', amount: 70, sessions_per_week: 7 },
    ]

    await supabase.from('subscription_plans').insert(
      customPlans.map((plan: { name: string; amount: number; sessions_per_week: number }, i: number) => ({
        name: plan.name,
        amount: plan.amount,
        sessions_per_week: plan.sessions_per_week,
        sort_order: i + 1,
        organisation_id: org.id,
        active: true,
      }))
    )

    return NextResponse.json({ orgId: org.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Onboard error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
