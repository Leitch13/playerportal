import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { splitChildName } from '@/lib/trial-join'

/**
 * What sign-up fills in for a parent arriving from a trial's joining link:
 * the details they already gave when they booked the trial. Reached only with
 * the trial's own id, which is in the link the academy sent them and nowhere
 * else. Nothing is returned once the family has joined, or after 180 days.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false }, { status: 400 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: t } = await sb
    .from('trial_bookings')
    .select('parent_name, parent_email, parent_phone, child_name, converted, created_at, training_group:training_groups(name)')
    .eq('id', id)
    .maybeSingle()
  if (!t || t.converted || Date.now() - new Date(t.created_at).getTime() > 180 * 86_400_000) return NextResponse.json({ ok: false }, { status: 404 })
  const child = splitChildName(t.child_name)
  return NextResponse.json({
    ok: true,
    parentName: t.parent_name || '', email: t.parent_email || '', phone: t.parent_phone || '',
    childFirst: child.first, childLast: child.last,
    className: (t.training_group as unknown as { name: string } | null)?.name || null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
