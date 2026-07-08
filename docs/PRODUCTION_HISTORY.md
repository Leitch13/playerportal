# Production History

Chronological append-only log of every production deployment. Newest at the top.

Every entry captures: **date · commit · deployment id · purpose · rollback commit**.

The production deploy mechanism is Vercel's GitHub git integration (reconnected 2026-07-08) — the `playerportallive` project auto-deploys pushes to `Leitch13/playerportal main`. Previously (through 2026-07-07) the mechanism was `vercel deploy --prod` from local `main` with no git integration. Existing entries below reflect the old CLI-deploy mechanism; 2026-07-08 entries and onward reflect the git-integrated push-to-deploy flow.

Live production: `www.theplayerportal.net` (also aliased: `theplayerportal.net`, `playerportallive.vercel.app`, `playitloveit.com`).

---

## 2026-07-08

### `f7808c0` — Flexible Camp Booking Mode — global rollout (Phases 0 → 3E + pilot bypass)

- **Vercel build hash**: `af_ccSHHAkg0Q7CfQkXDi`
- **Deployment mechanism**: Vercel GitHub git integration (reconnected today — see below)
- **Commits shipped** (14 total, all landed on `main`):
  - `dc71ef9` Phase 0 — DB foundation: `booking_mode` column on camps + camp_bookings, new `camp_days` + `camp_booking_days` tables, feature flag
  - `5d85d6e` Phase 1 — admin creation form: mode picker + per-day fields + publish lock
  - `37376c3` Phase 2 — parent day-picker view (blocked, view-only)
  - `fb101c5` Phase 3A — checkout backend: `/api/stripe/flexible-camp-checkout` + atomic `book_flexible_camp_days` RPC
  - `063b80d` Phase 3B — webhook + confirmation flow: extended camp branch to fetch selected days for emails + payments-row
  - `082ef9d` Phase 3D — parent UI wired to backend (staging-testable end-to-end)
  - `324a6a2` Phase 3E — admin visibility: roster Days column + per-day breakdown + print register per-day pages
  - `fb01211` Phase 3E follow-up — pilot allowlist gate (`FLEXIBLE_CAMPS_PUBLISH_ALLOWLIST`)
  - `bf017b1` `f34c6a6` `afe7d95` `6dc1f89` `f28ca3d` — deploy-trigger chore commits (see notes below)
  - `f7808c0` **global publish bypass** — new `FLEXIBLE_CAMPS_ALLOW_ALL` env var; when true bypasses the allowlist so every academy can publish flexible-days camps
- **Migrations applied to production Supabase**:
  - `supabase/095_flexible_camps_phase_0.sql` — schema foundation (columns, tables, RLS, indexes). Every existing row implicitly gets `booking_mode='whole_camp'` via DB default. Zero data migration. Sanity SELECT green.
  - `supabase/096_flexible_camp_booking_rpc.sql` — `book_flexible_camp_days()` atomic RPC (SECURITY INVOKER, granted to `service_role`). Sanity SELECT: `book_flexible_camp_days_installed = true`.
- **Env vars set in Vercel production**: `FLEXIBLE_CAMPS_ENABLED=true`, `FLEXIBLE_CAMPS_ALLOW_ALL=true`. (Not set: `FLEXIBLE_CAMPS_PUBLISH_ALLOWLIST` — bypassed by ALLOW_ALL.)
- **Purpose**: Ship the Flexible Camp Booking mode alongside the existing whole-camp model. Admins can create either mode at camp creation; parents on flexible camps pick which days to attend and pay per day. Whole-camp booking behaviour is byte-identical across every touched surface — parent form, Stripe checkout, webhook, emails, payments-row, roster, print register, reports. Phase 0/3E scope-locked all whole-camp code paths to zero diff vs the previous release baseline. Every new UI surface is gated behind `FLEXIBLE_CAMPS_ENABLED`; every new render inside admin surfaces is additionally gated on the specific row's `booking_mode`. Rollout is global from day one (via `FLEXIBLE_CAMPS_ALLOW_ALL`) rather than the originally-planned Gold & Gray pilot; the pilot allowlist code stays in place as the fallback path if `ALLOW_ALL` is unset.
- **Deploy-mechanism change (release-shaping issue)**: This release was scheduled to deploy via the existing `vercel deploy --prod` CLI flow. During the release attempt, Vercel silently dropped multiple pushes to `main` because a billing warning had temporarily blocked new deployments. After billing was sorted, the GitHub → Vercel webhook remained disabled (GitHub had auto-disabled after repeated 4xx retries during the block window). Diagnosis + resolution consumed the second half of the release day: (1) confirmed via GitHub 200/404 test that Vercel actually deploys from `Leitch13/playerportal`, not `Leitch13/playerportallive` despite the Settings page showing the latter (Vercel UI displays stale/incorrect connected repo). (2) Disconnected + reconnected the Git integration to `Leitch13/playerportal`, production branch = `main`. (3) One fresh commit push (`f28ca3d`) confirmed the webhook was working again; a subsequent bypass commit (`f7808c0`) deployed cleanly in under a minute. The 5 chore trigger commits (`bf017b1` `f34c6a6` `afe7d95` `6dc1f89` `f28ca3d`) are the visible sediment of this diagnosis — safe no-op / documentation-only commits pushed while working through the webhook issue. All are on `main`; none touch application code except `afe7d95` which added a single comment line to `src/lib/flexible-camps.ts`.
- **Files** (application code changed in the Flexible Camps chain, excluding trigger chores):
  - `src/lib/flexible-camps.ts` (new; +104 initial Phase 0 + +75 Phase 1 additions for publish lock + +55 Phase 3E allowlist + +14 today for ALLOW_ALL bypass)
  - `src/app/dashboard/camps/CampForm.tsx`, `CampActions.tsx`, `CampEditForm.tsx`, `page.tsx`, `[campId]/page.tsx`, `[campId]/RosterClient.tsx`, `[campId]/print/page.tsx`
  - `src/app/book/[slug]/camps/[campId]/CampFlexibleDayPicker.tsx` (new), `page.tsx`
  - `src/app/api/stripe/flexible-camp-checkout/route.ts` (new)
  - `src/app/api/stripe/webhooks/route.ts` (Phase 3B camp-branch extensions)
  - `src/lib/email-templates.ts` (optional `selectedDays` prop on both camp templates)
  - `supabase/095_*.sql` (new), `supabase/096_*.sql` (new)
- **Whole-camp regression checks (post-deploy, `af_ccSHHAkg0Q7CfQkXDi`)**:
  - `POST /api/stripe/camp-checkout {}` → `400 "Missing required fields"` — byte-identical to yesterday
  - Homepage 200
  - `/dashboard/camps` 307 → signin (auth gate intact)
  - Public booking landing 200
  - `POST /api/stripe/flexible-camp-checkout {}` → `400 "Missing required fields"` — flag ON, route now validating instead of returning flag-off 404
- **Protected systems touched**: Whole-camp booking flow, Stripe camp-checkout route, whole-camp CampBookingForm — all confirmed 0 diff vs pre-release baseline. Existing camp webhook branch extended to be booking-mode-aware but retains byte-identical output for whole-camp bookings (`selectedDays` prop is undefined for whole-camp callers). Existing camp confirmation + admin notification email templates gained an optional `selectedDays?: string[]` prop; whole-camp callers pass nothing, template output is byte-identical.
- **Rollback**:
  1. **Fastest (feature kill switch, ~3 min)**: Vercel → Settings → Environment Variables → remove `FLEXIBLE_CAMPS_ENABLED` (or set to `false`) → Deployments → Redeploy top row. Feature UI + checkout route go silent globally. DB migrations stay applied (safe — new columns default `whole_camp`, tables stay empty). Whole-camp booking continues normally throughout.
  2. **Code rollback (~5 min)**: `git revert f7808c0` (bypass) or `git revert fb01211..f7808c0` (Phase 3E allowlist + bypass + trigger chores). Push. Auto-deploy fires. Migrations stay applied.
  3. **Full rollback (~10 min)**: `git revert dc71ef9..f7808c0` reverts every Flexible Camps commit. Migrations 095 + 096 can be dropped if desired (`DROP TABLE camp_booking_days, camp_days; ALTER TABLE camps DROP COLUMN booking_mode, DROP COLUMN flex_price_per_day, DROP COLUMN flex_min_days; ALTER TABLE camp_bookings DROP COLUMN booking_mode; DROP FUNCTION public.book_flexible_camp_days(...);`). Recommended to leave migrations in place — they are inert without the code.

---

## 2026-07-07

### `0cab8ca` — PWA Phase 1d: refresh app icons with brand ring

- **Deployment id**: `dpl_etfupeuqd` (full: from `playerportallive-etfupeuqd-johnleitch970-1195s-projects.vercel.app`)
- **Deployment URL**: https://playerportallive-etfupeuqd-johnleitch970-1195s-projects.vercel.app
- **Purpose**: Replaced the placeholder "PP + star" app-icon mark with the segmented Player Portal ring (the "O" from the horizontal "THE PLAYER PORTAL" logo). Ring only — no text, no wordmark, no decoration — centred on a flat `#0a0a0a` background with the `#4ecde6` brand accent. Same brand identity now renders on every install surface: browser favicon, iOS home-screen (apple-touch-icon), Android install ("any" purpose), Android adaptive icon (maskable purpose). Also delivers the original Phase 1d scope of adding maskable variants for Android adaptive-icon support — segments fit inside the 40%-radius safe zone with a 28.8 px margin, guaranteed to render whole under any Android launcher mask (circle, squircle, teardrop).
- **Files**: 8 assets under `public/` (7 icon files + `manifest.json`). Regenerated `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png` from the single new canonical SVG source. Added `icon-maskable-192.png` + `icon-maskable-512.png`. Manifest updated to declare both maskable entries alongside the existing three `any` entries (icons array now has 5 total; 3 `any` + 2 `maskable`).
- **Protected system touched**: None. **Zero application code changed** — every touched file is under `public/`. No changes to service worker logic, authentication, middleware, dashboard, booking, billing, Stripe, onboarding, emails, API routes, database, or `src/app/layout.tsx`.
- **Note**: Existing installed PWAs will continue to show the previous launcher icon until they are re-installed or their OS refreshes the icon opportunistically. This is standard Android/iOS behaviour — home-screen icons are cached at install time. New installations show the new ring icon immediately.
- **Rollback**: `git revert 0cab8ca && vercel deploy --prod`

### `588b4b6` — Mobile App Phase 1 foundation release (PWA install + offline + mobile UX)

- **Deployment id**: `dpl_7785800pc` (full: from `playerportallive-7785800pc-johnleitch970-1195s-projects.vercel.app`)
- **Deployment URL**: https://playerportallive-7785800pc-johnleitch970-1195s-projects.vercel.app
- **Purpose**: First-class mobile foundation for Player Portal — a single-codebase release designed so an iOS + Android Capacitor wrap becomes a straightforward Phase 2 project. Ships as a 4-commit branch (`62770a1` foundation → `5930565` install+offline → `d9cf71f` mobile UX → `588b4b6` production hardening). 18 files, +713 / -72. Included in one release:
  1. **PWA foundation assets** — full icon set (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png`), manifest expansion (`id`, `scope`, PNG entries), viewport metadata (`viewport-fit=cover`, `interactive-widget=resizes-content`), safe-area utility classes.
  2. **Middleware matcher exclusions** — `manifest.json`, `sw.js`, and `offline$` added to the negative-lookahead. Fixes a pre-existing production defect where `/sw.js` was auth-guarded (returning 307), which meant service-worker registration had been silently failing for all users since it was originally added. Push notifications, offline caching, and the install flow all become genuinely functional for the first time. `updateSession()` auth logic is byte-identical.
  3. **iOS install flow** — dedicated Add-to-Home-Screen instruction card that iOS Safari users see (Safari doesn't fire `beforeinstallprompt`). Android's native install prompt behaviour is preserved byte-identical.
  4. **Service worker v2** — precache for `/offline` + `/manifest.json` + icons; cache-first for `/_next/static/*` and root icons + fonts; stale-while-revalidate for other images; network-first navigations. **`/api/**` is always pass-through** — authenticated data never touches Cache Storage. Push notification handler preserved; `notificationclick` now focuses an existing tab instead of always opening a new window.
  5. **Offline page rewrite** — branded Player Portal mark, clearer messaging, "While you're offline" 3-item checklist, larger cyan retry button.
  6. **SW update safety** — `controllerchange` no longer auto-reloads visible tabs. Reload is deferred until `document.hidden`. Users mid-payment / mid-onboarding are never interrupted; they pick up new SW assets on their next natural navigation or when they background the tab.
  7. **Mobile UX** — top nav gets `safe-top` (fixes iOS notch collision in installed standalone); universal `100dvh` upgrade via `@supports` gate; `KeyboardAwareBottomNav` client fallback + `interactive-widget=resizes-content` for soft-keyboard behaviour; capability-based `.hover-only` / `.hover-only-btn-corner` utilities that reveal hover-only UI on touch tablets (previously `sm:` breakpoint gate left iPads with hover-only UI unreachable).
- **Files**: 18 changed (5 new + 13 modified). New: 4 PNG icons + `KeyboardAwareBottomNav.tsx`. Modified: `public/{manifest.json,sw.js}`, `src/middleware.ts`, `src/app/{layout,globals.css,offline/page}.tsx`, `src/components/{InstallPrompt,Navigation,ServiceWorkerRegister,UpsellCard}.tsx`, `src/app/dashboard/{cpd/CoachCPD,leads/LeadsPipeline,messages/MessagingHub}.tsx` (last three are class-swap only from `sm:opacity-0 sm:group-hover:opacity-100` → `hover-only`).
- **Protected system touched**: Middleware — matcher-only exclusions extended (same shape as prior SEO hotfix + manifest.json change). `updateSession()` auth logic unchanged. Verified in prod smoke: `/offline-legacy` and other `offline*` siblings correctly 307 → `/auth/signin`; `/dashboard` still auth-guarded; `/sw.js`, `/manifest.json`, `/offline` all serve 200.
- **Note**: `.safe-bottom` retroactively activates on existing `SessionMode.tsx` usage (that file has been referencing `.safe-bottom` since before this release; the class had no CSS until Phase 1a defined it). On notched iOS the coach's live-session mode fixed bottom bar now respects the home-indicator zone. This is a positive change but was not in the explicit change list of any single commit; flagging for awareness.
- **Rollback**: `git revert 588b4b6 d9cf71f 5930565 62770a1 && vercel deploy --prod` (4-commit revert; the branch is a single logical release). If a partial revert is ever needed, revert just `62770a1` first (the middleware exclusions) to restore the pre-Phase-1a auth-guard-on-`/sw.js` behaviour.

### `d54d104` — Homepage: genericise ClassForKids copy to "any provider"

- **Deployment id**: `dpl_llylsn0hr` (full: from `playerportallive-llylsn0hr-johnleitch970-1195s-projects.vercel.app`)
- **Deployment URL**: https://playerportallive-llylsn0hr-johnleitch970-1195s-projects.vercel.app
- **Purpose**: The homepage over-indexed on ClassForKids as the assumed prior tool. Genericised 7 mentions across 6 components so academies coming from LoveAdmin, TeamFeePay, Coacha, spreadsheets or anything else feel equally welcome. Changes: (1) FinalCTA "Bring your ClassForKids members over" → "Bring your existing members over". (2) BentoGrid Migration tagline: same treatment. (3) MigrationTeaser section headline "Coming from ClassForKids?" → "Coming from another provider?" — provider chip list at line 29 explicitly preserved (`['ClassForKids', 'LoveAdmin', 'TeamFeePay', 'Coacha']`) as positive "we support these" evidence. (4) PricingTeaser Starter feature "Migration from ClassForKids" → "Free migration included". (5) FAQ.tsx Q + A genericised to "migrate my members from another provider" / "Export your current provider's CSV". (6) `src/app/page.tsx` JSON-LD FAQPage schema mirrored to the same wording so structured data matches visible copy. (7) ProblemSection Before-card chaos-icon "ClassForKids — bookings" → "Booking provider — bookings". Copy-only.
- **Files**: `src/app/page.tsx`, `src/components/marketing/homepage/{BentoGrid,FAQ,FinalCTA,MigrationTeaser,PricingTeaser,ProblemSection}.tsx` (7 files, +9 / -9)
- **Protected system touched**: None. Copy-only. No touches on migration functionality, provider chip list, styling, layout, analytics, API, DB, auth, billing or Stripe.
- **Note**: The meta-keywords list in `src/app/layout.tsx` still includes "ClassForKids alternative" as an SEO signal for people Googling for a ClassForKids replacement. Out of scope for this hotfix; positive SEO signal, not visible copy.
- **Rollback**: `git revert d54d104 && vercel deploy --prod`

### `3090a64` — Hide cancelled enrolments from parents on player-detail page

- **Deployment id**: `dpl_av718midm` (full: from `playerportallive-av718midm-johnleitch970-1195s-projects.vercel.app`)
- **Deployment URL**: https://playerportallive-av718midm-johnleitch970-1195s-projects.vercel.app
- **Purpose**: The "Classes" card on `/dashboard/players/[id]` was rendering a "N cancelled enrolments" collapsible unconditionally. Parents can access this page for their own children (line 79 permits `parent → own kid`), so they were seeing the admin-only class-swap audit trail — e.g. Debbie Harley (parent) was seeing Craig Harley's two cancelled mis-slotted enrolments (Monday 5:15 · Michael Woods, Friday 3:45 · Bayview) alongside the one real active class (Friday 4:30 · Bayview). Gated the render block on the existing `isStaff` flag (already used to gate the sibling "Move class" action on line 753, plus 14 other staff-only controls in the same file). `isStaff = role === 'admin' || role === 'coach'`. Effect: parents see only active class rows and the "No active class enrolment found" fallback; admin/coach behaviour is unchanged (still see the collapsible with the full history for audit). The `ended` array (line 726) is still computed regardless of role — only the render is gated.
- **Files**: `src/app/dashboard/players/[id]/page.tsx` (+1 / -1)
- **Protected system touched**: None. Pure UI visibility gate. No changes to the DB query, `ended` construction, or any other file.
- **Rollback**: `git revert 3090a64 && vercel deploy --prod`

---

## 2026-07-05

### `b2b5fda` — Homepage pricing teaser: match live product truth

- **Deployment id**: `dpl_qee6asxbi` (full: from `playerportallive-qee6asxbi-johnleitch970-1195s-projects.vercel.app`)
- **Deployment URL**: https://playerportallive-qee6asxbi-johnleitch970-1195s-projects.vercel.app
- **Purpose**: Aligned the homepage `PricingTeaser` with the live `platform_plans` table + the onboard `PLATFORM_PLANS` constant, which had drifted since the 2026-05-25 tier redesign (migration 046). (1) **Prices**: £29 / £59 / £119 → **£20 / £35 / £60**. (2) **Plan names**: Starter / Growth / Pro → **Starter / Pro / Enterprise**. (3) **Killed the fake "Up to N members" caps** — there is no member cap on any tier — replaced with feature-based positioning ("Everything to go live" / "Retention & growth" / "White-label & scale"). (4) **Rewrote the 3-bullet-per-card copy** to reflect the actual feature ladder from `platform_plans.feature_keys` (Starter 8 keys → Pro adds 10 → Enterprise adds 8). (5) **Section headline** "No booking fees. Ever." → **"No player limits."** — transaction fees (3.5%/2.5%/2%) DO exist on every tier, so the old copy was effectively false advertising. Copy-only change; zero touches on Stripe, billing, onboarding, DB, feature gates, API, middleware, auth, dashboard, or the 3 P1 landing pages (they carry the same drift and will be aligned in a follow-up hotfix).
- **Files**: `src/components/marketing/homepage/PricingTeaser.tsx` (+15 / -13)
- **Protected system touched**: None. Copy-only change to a static React component.
- **Rollback**: `git revert b2b5fda && vercel deploy --prod`

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
