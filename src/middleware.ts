import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // SEO: robots.txt and sitemap.xml MUST be excluded here — otherwise
  // updateSession() below sees Google's crawler with no cookie, treats the
  // path as protected, and 307-redirects to /auth/signin. Adding them to
  // this negative lookahead is a matcher-only change; the auth logic in
  // updateSession is unchanged.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
