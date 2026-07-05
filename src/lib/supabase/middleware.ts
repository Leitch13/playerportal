import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars are missing, skip auth checks and just pass through
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // If not signed in and trying to access protected routes, redirect to sign-in
    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
    const isApiRoute = request.nextUrl.pathname.startsWith('/api')
    // Public marketing surfaces. Landing-page slugs must be listed here or
    // updateSession() 307-redirects unauthenticated crawler traffic to
    // /auth/signin and Google indexes the sign-in page instead of the copy.
    // When a new Hotfix B landing page ships, add its slug here.
    const LANDING_SLUGS = [
      '/football-academy-management-software',
      '/football-booking-system',
      '/academy-payment-collection',
    ]
    const path = request.nextUrl.pathname
    const isPublicRoute =
      path === '/' ||
      path.startsWith('/book') ||
      path.startsWith('/embed') ||
      path.startsWith('/terms') ||
      path.startsWith('/onboard') ||
      path.startsWith('/how-it-works') ||
      path.startsWith('/privacy') ||
      path.startsWith('/dpa') ||
      path.startsWith('/cookies') ||
      path.startsWith('/demo') ||
      path.startsWith('/confirm-subscription') ||
      LANDING_SLUGS.includes(path)

    if (!user && !isAuthRoute && !isPublicRoute && !isApiRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/signin'
      return NextResponse.redirect(url)
    }

    // If signed in and on auth routes, redirect to dashboard
    // BUT allow:
    //  - signout route
    //  - signin with email param (switching accounts)
    //  - signup with org param (subscribing to a new class from a logged-in
    //    parent session — the signup page handles this case by skipping the
    //    account-creation step and jumping straight to child/plan selection)
    const isSignout = request.nextUrl.pathname === '/auth/signout'
    const isSigninWithParams = request.nextUrl.pathname === '/auth/signin' && request.nextUrl.searchParams.has('email')
    const isSignupWithOrg = request.nextUrl.pathname === '/auth/signup' && request.nextUrl.searchParams.has('org')

    if (user && isAuthRoute && !isSignout && !isSigninWithParams && !isSignupWithOrg) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch {
    // If Supabase auth fails, just pass through
  }

  return supabaseResponse
}
