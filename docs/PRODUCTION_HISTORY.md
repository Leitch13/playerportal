# Production History

Chronological append-only log of every production deployment. Newest at the top.

Every entry captures: **date · commit · deployment id · purpose · rollback commit**.

The production deploy mechanism is `vercel deploy --prod` from local `main` — the Vercel project `playerportallive` is not git-integrated with either GitHub repo (empty `gitSource` / `meta` on every deployment). Only commits merged into `main` and then CLI-deployed reach production.

Live production: `www.theplayerportal.net` (also aliased: `theplayerportal.net`, `playerportallive.vercel.app`, `playitloveit.com`).

---

## 2026-07-04

### `0d9a889` — P1 topical-authority landing pages + shared landing template

- **Deployment id**: `dpl_b9visbpta` (full: from `playerportallive-b9visbpta-johnleitch970-1195s-projects.vercel.app`)
- **Deployment URL**: https://playerportallive-b9visbpta-johnleitch970-1195s-projects.vercel.app
- **Purpose**: Phase 2 SEO — build a topical-authority cluster around football-academy keywords. Ships three high-intent landing pages: `/football-academy-management-software`, `/football-booking-system`, `/academy-payment-collection`. Each page has a unique H1, title, meta description, canonical URL, OpenGraph + Twitter metadata, and page-specific JSON-LD (SoftwareApplication + FAQPage with 6 mirrored Q&As). Copy is topic-focused, not a homepage rewrite — booking-only on the booking page, payments-only on the payments page, whole-platform on the management page. Extracts a shared, props-driven landing template into `src/components/marketing/landing/` (Hero, Problem, WhyBar, Solution, FeatureGrid, FAQ, CTA, InternalLinks, plus a `LANDING_PAGES` registry) so Hotfix B's P2 pages can ship as thin `page.tsx` files feeding the same components. Sitemap gets the 3 new URLs at priority 0.9; Footer gets a new Solutions column linking only to live P1 pages. Homepage code and copy are untouched.
- **Files**: 15 changed (12 new, 3 modified). New: 3 landing `page.tsx` files + 9 files under `src/components/marketing/landing/` (`types.ts`, `LandingHero`, `LandingProblem`, `LandingWhyBar`, `LandingSolution`, `LandingFeatureGrid`, `LandingFAQ`, `LandingCTA`, `LandingInternalLinks`). Modified: `src/app/sitemap.ts`, `src/components/marketing/homepage/Footer.tsx`, `src/lib/supabase/middleware.ts`.
- **Protected system touched**: Middleware — `isPublicRoute` allowlist inside `updateSession()`. Added exactly three exact paths (`/football-academy-management-software`, `/football-booking-system`, `/academy-payment-collection`). Without this, unauthenticated crawler requests to the new pages 307-redirect to `/auth/signin` (Google would index the sign-in page instead of the copy — verified: before-change 307, after-change 200). Auth logic is bit-identical for every other path; no change to `getUser()`, cookie handling, or the redirect target.
- **Rollback**: `git revert 0d9a889 && vercel deploy --prod`

### `f1bd9f4` — SEO hotfix: homepage discoverability (canonical, OG, JSON-LD, robots, sitemap)

- **Deployment id**: `dpl_m2aoSn8froPsB1UUd165vgos9kSD`
- **Deployment URL**: https://playerportallive-sv155shzx-johnleitch970-1195s-projects.vercel.app
- **Purpose**: Fixed the four things that were keeping the marketing homepage off Google: (1) `/robots.txt` and `/sitemap.xml` were being 307-redirected to `/auth/signin` by the middleware matcher — added both to the negative-lookahead so `updateSession()` no longer sees crawler requests as protected paths. (2) `public/robots.txt` was pointing its `Sitemap:` directive at the wrong domain (`playerportal.app`); now points at `https://www.theplayerportal.net/sitemap.xml`. (3) `src/app/sitemap.ts` was reading `NEXT_PUBLIC_APP_URL` (which drifts) and only listed 5 URLs; now hardcodes the www canonical base and lists all 8 public marketing pages (`/`, `/onboard`, `/how-it-works`, `/demo`, `/terms`, `/privacy`, `/dpa`, `/cookies`). (4) Root layout + homepage OG/Twitter metadata refreshed to Homepage V3 messaging ("The Operating System for Football Academies"), homepage canonical `<link>` added, and 3 JSON-LD blocks added on `/` (SoftwareApplication, Organization, FAQPage — FAQPage mirrors the 6 on-page FAQ answers verbatim so Google's rich-result eligibility check matches).
- **Files**: `public/robots.txt`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/sitemap.ts`, `src/middleware.ts`
- **Protected system touched**: Middleware — matcher-regex only. `updateSession()` auth logic is bit-identical. Change extends the existing exclusion list from `_next/static|_next/image|favicon.ico|*.(svg|png|jpg|jpeg|gif|webp)` to also include `robots\.txt|sitemap\.xml`.
- **Rollback**: `git revert f1bd9f4 && vercel deploy --prod`

---

## 2026-07-03

### `6785c9b` — Migration wizard: allow admins to import additional batches

- **Deployment id**: `dpl_313AqqNTn79r6sLdRUip6KVixeGp`
- **Deployment URL**: https://playerportallive-ff0gyk01l-johnleitch970-1195s-projects.vercel.app
- **Purpose**: Removed the client-side lock that hid the "Start new migration" button once any invitation existed. Button now always renders and switches label dynamically to "Import another batch" when invitations exist. UI-only change; `/api/migration/import` route unchanged.
- **Files**: `src/app/dashboard/migration/MigrationWizard.tsx`
- **Origin**: Adapted on `main` from the recovery-branch commit `2fb70a0`. The original referenced three `useState` setters that don't exist on `main` (`setProgress` / `setSendResults` / `setFatalError`), so the reset handler on `main` covers only the four setters that do exist.
- **Rollback**: `git revert 6785c9b && vercel deploy --prod`

### `469acee` — Admin messaging: Email button routes through in-app composer

- **Deployment id**: `dpl_HGSmWQogAYDR9nmEkmbWb8uamUor`
- **Deployment URL**: https://playerportallive-bma4fi391-johnleitch970-1195s-projects.vercel.app
- **Purpose**: `mailto:` only worked when the browser had a default mail client — most Chrome/Safari setups treated the click as a no-op. Switched both 📧 Email surfaces (`ParentsTable` row action + `CommunicationPanel` chip) to `/dashboard/messages?to=<parentId>`, which auto-emails via Resend on send.
- **Files**: `src/app/dashboard/parents/ParentsTable.tsx`, `src/app/dashboard/parents/[id]/CommunicationPanel.tsx`
- **Rollback**: `git revert 469acee && vercel deploy --prod`

### `55450de` — Admin messaging: `?to=` deep-link + UK `07…` WhatsApp transform

- **Deployment id**: `dpl_rqHf9amCNJAf2PCnyYCbrSx4w97o`
- **Deployment URL**: https://playerportallive-pbq4my5km-johnleitch970-1195s-projects.vercel.app
- **Purpose**: (1) `/dashboard/messages?to=<parentId>` was silently dropped, leaving the Send button disabled with no recipient. Now validated against the allowed recipient set and passed to `ComposeButton` as `preSelectedRecipientId` + `autoOpen`. (2) `CommunicationPanel` `wa.me` URLs missed the leading-0-→-44 transform that `ParentsTable` applied, breaking WhatsApp for UK-domestic-format phones.
- **Files**: `src/app/dashboard/messages/page.tsx`, `src/app/dashboard/messages/ComposeButton.tsx`, `src/app/dashboard/parents/[id]/CommunicationPanel.tsx`
- **Rollback**: `git revert 55450de && vercel deploy --prod`

### `449397e` — Scheduled signup email: term + class context

- **Deployment id**: `dpl_6w1cpUNU6nMf5r3c8Z4zTBvPTtW7`
- **Deployment URL**: https://playerportallive-pbq4my5km-johnleitch970-1195s-projects.vercel.app (superseded)
- **Purpose**: `scheduledSignupConfirmationEmail` (fired for future-start setup-mode signups in the `future_prorated` webhook branch) now surfaces term name + start/end dates + optional parent message + class day/time/venue/coach + explicit first-session date. All new template params are optional so legacy callers produce the same email as before.
- **Files**: `src/app/api/stripe/webhooks/route.ts`, `src/lib/email-templates.ts`
- **Protected system touched**: Stripe webhook — approved in advance, narrow scope (only `future_prorated` branch of `sendSignupEmails`, signature verification / event dispatch / other handlers all bit-identical).
- **Rollback**: `git revert 449397e && vercel deploy --prod`

---

## Earlier deployments

Not backfilled. This file starts as the source of truth on 2026-07-03. Prior production state is captured implicitly by `git log main` (commits before `449397e`).
