import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/auth/signin'

  // Use the request's own origin to build the redirect URL
  const url = request.nextUrl.clone()
  url.pathname = redirectTo.split('?')[0]
  url.search = redirectTo.includes('?') ? '?' + redirectTo.split('?')[1] : ''

  const response = NextResponse.redirect(url)

  // Get the Supabase project ref for cookie names
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || ''

  // Clear ALL possible Supabase auth cookie variations
  const cookiePrefixes = [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token.0`,
    `sb-${projectRef}-auth-token.1`,
  ]

  for (const name of cookiePrefixes) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }

  return response
}
