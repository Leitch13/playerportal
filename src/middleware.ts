import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // SEO + PWA: robots.txt, sitemap.xml, and manifest.json MUST be excluded
  // here — otherwise updateSession() below sees Google's crawler / Chrome's
  // manifest fetch with no cookie, treats the path as protected, and 307-
  // redirects to /auth/signin. For manifest.json specifically that would
  // silently block PWA install on Android because Chrome can't fetch the
  // manifest. Adding them to this negative lookahead is a matcher-only
  // change; the auth logic in updateSession is unchanged.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
