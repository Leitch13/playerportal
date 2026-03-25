import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/auth/signin'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playerportallive.vercel.app'

  const response = NextResponse.redirect(new URL(redirectTo, baseUrl))

  // Get the Supabase project ref for cookie names
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || ''

  // Clear ALL possible Supabase auth cookie variations
  const cookiePrefixes = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token.0`,
    `sb-${projectRef}-auth-token.1`,
    'sb-access-token',
    'sb-refresh-token',
  ]

  for (const name of cookiePrefixes) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }

  // Nuclear option: tell browser to clear all cookies for this site
  response.headers.set('Clear-Site-Data', '"cookies", "storage"')

  return response
}
