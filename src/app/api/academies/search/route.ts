import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('organisations')
    .select('id, name, slug, logo_url, location')
    .ilike('name', `%${q}%`)
    .limit(5)

  return NextResponse.json(data || [])
}
