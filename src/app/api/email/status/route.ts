import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configured = !!process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL || 'Player Portal <noreply@playerportal.app>'

  return NextResponse.json({ configured, from })
}
