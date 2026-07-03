# Release Backlog

Every fix discovered outside `main` is tracked here. Update on every branch audit or protocol Phase 8 review.

Status values (exactly one per item):
- **Live** — the fix (or an equivalent) is on `main` and has been deployed to production
- **Reimplemented** — the fix was rewritten against `main`'s current shape and shipped as a different commit; the original SHA is superseded
- **Outstanding** — still on a non-main branch, not yet on `main`; needs review/adaptation/deploy
- **Rejected** — reviewed and decided against; either no longer needed, superseded by other work, or unsafe
- **Superseded** — a newer or different fix on `main` covers the same ground

Never rely on memory. This file and `docs/PRODUCTION_HISTORY.md` are the source of truth.

---

## Long-lived branches (reference only — never merge wholesale)

### `release/prod-recovery-consolidated`

Contains ~16 commits ahead of `main` from the 2026-06-27 → 2026-06-30 recovery pass. Some depend on state that never landed on `main` (see the reimplementation of `2fb70a0` below). Cherry-pick individually, adapting to `main` shape.

### `hotfix/payment-recovery-discoverability`

Contaminated / archive. 65 commits ahead of `main`, 38 behind. Contains unrelated Stripe, migration, homepage, and UI work all mixed together. **Do not merge.** Cherry-pick individual fixes only if a specific one is required, and only after full audit against current `main`.

---

## Backlog items

### From `release/prod-recovery-consolidated`

| Item | Origin commit | Status | Notes |
|---|---|---|---|
| Multi-batch migration button | `2fb70a0` | **Reimplemented** as `6785c9b` | Original referenced three `useState` setters that don't exist on `main` (`setProgress` / `setSendResults` / `setFatalError`); reimplemented with only the four setters that do exist. |
| SEO robots fix | `46d3b31` | Outstanding | "correct robots.txt sitemap URL and canonicalise sitemap fallback to www" — needs review; earlier session did an SEO Phase 1 hotfix, verify no overlap. |
| Branding: manifest + opengraph unblock | `dd05843` | Outstanding | "unblock manifest and opengraph image" — check current asset paths on main. |
| Terms → classes → parent surfaces | `0b70ff1` | Outstanding | "connect terms to classes and parent surfaces" — sizeable feature. Full scope review before adapting. |
| Pending migration subscription status fix | `da4ab38` | Outstanding | "restore pending migration subscription status" — DB-adjacent. Protected-system: needs approval. |
| Stripe write-path: use booked academy | `4ba6ed6` | Outstanding | "use booked academy for subscription write path" — Stripe / billing. Protected-system: needs approval. |
| Bulk imports + invitation tracking hardening | `660b619` | Outstanding | Introduces the three additional `useState` setters (`progress` / `sendResults` / `fatalError`) that `2fb70a0` relied on. Migration engine change — protected system. |
| Migrate-member review + share flow | `993dd4d` | Outstanding | UI enhancement to migrate-member workflow. |
| Mobile polish + brand consistency | `7a8d9bd` | Outstanding | Broad UI sweep. |
| Unified logo across templates | `33e701c` | Outstanding | Email template cosmetic. |
| Other commits (6+) | various | Outstanding | Enumerate in next audit pass. |

### From `hotfix/payment-recovery-discoverability`

| Item | Status | Notes |
|---|---|---|
| Homepage V3 (marketing rewrite) | Outstanding | Preserved in `stash@{0}`. Fresh `src/app/page.tsx` (44 lines) + 15 components in `src/components/marketing/homepage/` + 3 planning docs (`ACADEMY_HOME_*.md`). Not yet extracted onto a clean main-based branch. |
| Onboard signup WIP | Outstanding | Preserved in `stash@{1}`. Small onboard/signup change. |
| Everything else on this branch | Rejected | Contaminated with 65 commits of mixed scope. Cherry-pick specific fixes on request only, do not consider the branch as a whole. |

---

## How to update this file

- When a backlog item is deployed, change status to **Live** and add a link to its entry in `PRODUCTION_HISTORY.md`.
- When a fix is reimplemented against `main`, change status to **Reimplemented** and record the new SHA.
- When a fix becomes irrelevant, mark **Rejected** or **Superseded** with a one-line reason.
- On every Phase 8 audit, add any newly-discovered off-`main` fixes as new rows.
