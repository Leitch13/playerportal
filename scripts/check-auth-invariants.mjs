#!/usr/bin/env node
// Runs before every build (package.json "prebuild"). Fails the build if the
// password-link fix is undone: signed-in users must be able to reach
// /auth/confirm and /auth/reset-password, and the middleware must use the
// shared rule in src/lib/auth-routes.ts rather than an inlined copy.
// Broke before — see the comment at the top of src/lib/auth-routes.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs'

const fail = []
const routes = readFileSync('src/lib/auth-routes.ts', 'utf8')
for (const path of ['/auth/confirm', '/auth/reset-password']) {
  if (!routes.includes(`'${path}'`)) fail.push(`src/lib/auth-routes.ts no longer lets signed-in users reach ${path}`)
}
const mw = readFileSync('src/lib/supabase/middleware.ts', 'utf8')
if (!/signedInMayStayOnAuthRoute\(/.test(mw)) {
  fail.push('src/lib/supabase/middleware.ts no longer uses signedInMayStayOnAuthRoute() — the password-link rule must live in src/lib/auth-routes.ts')
}

// Forgot-password and email-login links must work on any device: Player Portal sends them
// itself (src/lib/auth-email-links.ts). The login system's own browser-only emails failed when
// opened on another phone or inside the Mail app (WLFA parent, 19 Oct 2026). Never go back.
const walk = (d) => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : [p] })
for (const f of walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))) {
  const src = readFileSync(f, 'utf8')
  if (/resetPasswordForEmail\(|signInWithOtp\(/.test(src)) fail.push(`${f} sends a browser-only login email (resetPasswordForEmail / signInWithOtp). Use /api/auth/email-link instead, so the link works on any device.`)
}
for (const [f, needle] of [['src/app/auth/forgot-password/page.tsx', "/api/auth/email-link"], ['src/app/auth/signin/page.tsx', "/api/auth/email-link"], ['src/lib/auth-email-links.ts', 'generateLink(']]) {
  if (!readFileSync(f, 'utf8').includes(needle)) fail.push(`${f} no longer uses ${needle}`)
}

// Opening an emailed link must not use it up: Hotmail/Outlook scanners open links first and the
// parent's own tap then said "expired" (No.1 GK, 29 Oct 2026). GET shows a button; POST signs in.
const confirmRoute = readFileSync('src/app/auth/confirm/route.ts', 'utf8')
if (!confirmRoute.includes('if (tokenHash && type) return continuePage(') || !/export async function POST/.test(confirmRoute)) {
  fail.push('src/app/auth/confirm/route.ts uses up the one-time link when it is merely opened. Opening must show the button page; only the POST may call verifyOtp.')
}
if (/export async function GET[\s\S]*verifyOtp[\s\S]*export async function POST/.test(confirmRoute)) fail.push('src/app/auth/confirm/route.ts calls verifyOtp on GET')

if (fail.length) {
  console.error('\n✖ Auth invariants broken — password reset / set-password links would stop working:\n')
  for (const f of fail) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log('✓ auth invariants ok (password links reach the set-password page and work on any device)')
