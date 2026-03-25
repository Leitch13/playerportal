import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = rateLimit(`onboard:${ip}`, 3, 3600000) // 3 per hour
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const supabase = await createClient()

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
          start_time: classTime,
          max_capacity: classCapacity ? parseInt(classCapacity, 10) : 20,
        })

      if (groupError) {
        console.error('Training group creation error:', groupError)
        // Non-fatal: org was created, class can be added later
      }
    }

    return NextResponse.json({ orgId: org.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Onboard error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
