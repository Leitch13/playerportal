#!/usr/bin/env node
// Runs before every build (package.json "prebuild"). Fails the build if the
// password-link fix is undone: signed-in users must be able to reach
// /auth/confirm and /auth/reset-password, and the middleware must use the
// shared rule in src/lib/auth-routes.ts rather than an inlined copy.
// Broke before — see the comment at the top of src/lib/auth-routes.ts.
import { readFileSync } from 'node:fs'

const fail = []
const routes = readFileSync('src/lib/auth-routes.ts', 'utf8')
for (const path of ['/auth/confirm', '/auth/reset-password']) {
  if (!routes.includes(`'${path}'`)) fail.push(`src/lib/auth-routes.ts no longer lets signed-in users reach ${path}`)
}
const mw = readFileSync('src/lib/supabase/middleware.ts', 'utf8')
if (!/signedInMayStayOnAuthRoute\(/.test(mw)) {
  fail.push('src/lib/supabase/middleware.ts no longer uses signedInMayStayOnAuthRoute() — the password-link rule must live in src/lib/auth-routes.ts')
}

if (fail.length) {
  console.error('\n✖ Auth invariants broken — password reset / set-password links would stop working:\n')
  for (const f of fail) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log('✓ auth invariants ok (password links reach the set-password page)')
