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
    const isPublicRoute = request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/book') || request.nextUrl.pathname.startsWith('/terms') || request.nextUrl.pathname.startsWith('/onboard') || request.nextUrl.pathname.startsWith('/how-it-works') || request.nextUrl.pathname.startsWith('/privacy')

    if (!user && !isAuthRoute && !isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/signin'
      return NextResponse.redirect(url)
    }

    // If signed in and on auth routes, redirect to dashboard
    if (user && isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch {
    // If Supabase auth fails, just pass through
  }

  return supabaseResponse
}
