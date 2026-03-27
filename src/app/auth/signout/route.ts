import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'global' })

  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/auth/signin'

  const url = request.nextUrl.clone()
  url.pathname = redirectTo.split('?')[0]
  url.search = redirectTo.includes('?') ? '?' + redirectTo.split('?')[1] : ''

  const response = NextResponse.redirect(url)

  // Nuclear cookie clearing — delete ALL sb- cookies on every possible path
  const allCookies = request.cookies.getAll()
  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-')) {
      // Clear on root path
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' })
      // Clear on /auth path
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/auth' })
      // Clear on /dashboard path
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/dashboard' })
    }
  }

  // Also try common Supabase cookie patterns
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] || ''
  if (projectRef) {
    const baseName = `sb-${projectRef}-auth-token`
    for (let i = 0; i < 5; i++) {
      const cookieName = i === 0 ? baseName : `${baseName}.${i}`
      response.cookies.set(cookieName, '', { maxAge: 0, path: '/' })
    }
  }

  return response
}
