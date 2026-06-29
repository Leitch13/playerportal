import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Branding hotfix — previous matcher excluded only image-extension files,
  // which meant /manifest.json, /opengraph-image, /twitter-image, /robots.txt,
  // /sw.js and /widget.js were all routed through the Supabase auth check
  // and 307-redirected to /auth/signin. That broke:
  //   • PWA install (manifest 307 → Android can't read theme/icon)
  //   • Social share previews (every Facebook/WhatsApp/Slack share sent the
  //     crawler to the signin page instead of the OG image)
  //   • Service worker registration
  //   • Search engine crawling (robots.txt unreadable)
  // The matcher exclusion list now covers Next.js file-convention routes
  // (opengraph-image, twitter-image), the PWA + crawler well-known files,
  // and an additional .ico extension catch.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|opengraph-image|twitter-image|robots.txt|sitemap.xml|sw.js|widget.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
