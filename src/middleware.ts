import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // SEO + PWA: robots.txt, sitemap.xml, manifest.json, sw.js, and /offline
  // MUST be excluded here — otherwise updateSession() below sees Google's
  // crawler / Chrome's manifest fetch / an anonymous PWA install with no
  // cookie, treats the path as protected, and 307-redirects to /auth/signin.
  // For manifest.json / sw.js specifically that would silently block PWA
  // install and service-worker registration entirely (registration follows
  // the redirect and fails because the signin HTML isn't valid JS). For
  // /offline the SW would cache the redirected signin page as the offline
  // fallback. Adding them to this negative lookahead is a matcher-only
  // change; the auth logic in updateSession is unchanged.
  matcher: [
    // `offline$` is end-anchored — matches only the exact `/offline` route
    // (the SW's offline fallback page). Without the `$`, the alternation
    // would also exempt siblings like `/offline-legacy` from auth, which
    // would be a silent bypass if anyone ever added such a route.
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|sw\\.js|offline$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
