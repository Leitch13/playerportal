# Production History

Chronological append-only log of every production deployment. Newest at the top.

Every entry captures: **date · commit · deployment id · purpose · rollback commit**.

The production deploy mechanism is `vercel deploy --prod` from local `main` — the Vercel project `playerportallive` is not git-integrated with either GitHub repo (empty `gitSource` / `meta` on every deployment). Only commits merged into `main` and then CLI-deployed reach production.

Live production: `www.theplayerportal.net` (also aliased: `theplayerportal.net`, `playerportallive.vercel.app`, `playitloveit.com`).

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
