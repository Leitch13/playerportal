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

  // Clear ALL cookies that start with 'sb-' to ensure complete session wipe
  const allCookies = request.cookies.getAll()
  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' })
    }
  }

  return response
}
