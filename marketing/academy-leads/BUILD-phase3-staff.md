# Build doc — Phase 3: the Staff engine + Staff hub

Extends the base again: the academy hires, onboards, trains and keeps coaches
without anything living in the owner's head. Pairs with **`coach-application.html`**
(the front door) the same way Phase 1 pairs with `trial-funnel.html`.

**Prerequisites:** Phases 1–2 built. Everything below is additive.

**What you end up with:** three new tables (Staff, Onboarding tasks, Resources),
the coach-application page wired in, six automations (10–15), and a staff hub
link every coach bookmarks on their phone. ~1.5 hrs in Airtable + page hosting.

> **Free-tier note:** Airtable's free plan caps automation runs per base per month.
> A quiet academy fits easily; a busy one (lots of leads + staff + trials) may need
> the first paid tier. Flag this honestly in the sales sheet — it's still pennies.

---

## Part 1 — The Staff table

**Add a table** → **Staff** → fields:

| Field name           | Field type            | Notes / options                                                  |
|----------------------|-----------------------|------------------------------------------------------------------|
| `Name`               | Single line text      | Primary field.                                                   |
| `Email`              | Email                 |                                                                  |
| `Phone`              | Phone number          |                                                                  |
| `Status`             | Single select         | Pipeline, in order: `Applied` (grey) · `Chat booked` (yellow) · `Trial session` (orange) · `Offer made` (blue) · `Onboarding` (purple) · `Active` (green) · `Not now` (red) |
| `Qualification`      | Single select         | `No badges yet` · `Grassroots / intro award` · `UEFA C` · `UEFA B` · `UEFA A or above` · `Other` — **must match the page's dropdown exactly** |
| `Experience`         | Single select         | `None yet` · `Under 1 year` · `1 - 3 years` · `3 - 5 years` · `5+ years` — match the page |
| `Availability`       | Single line text      | Arrives as a comma list from the page.                           |
| `Message`            | Long text             | The "anything else" box.                                         |
| `Start date`         | Date                  | Set when they go Active — powers milestone check-ins.            |
| `Session rate`       | Currency (£)          |                                                                  |
| `PVG expiry`         | Date                  | (or DBS in England)                                              |
| `First aid expiry`   | Date                  |                                                                  |
| `Safeguarding expiry`| Date                  |                                                                  |
| `Onboarding`         | Link to record        | → Onboarding tasks (created in Part 2).                          |
| `Open tasks`         | Count                 | Count of linked Onboarding tasks where `Done` is unchecked (use the count field's condition option). |
| `Next expiry days`   | Formula               | See below — days until the soonest certificate expiry.           |
| `Notes`              | Long text             |                                                                  |

**`Next expiry days` formula** (paste as-is):

```
IF(
  MIN(
    IF({PVG expiry}, DATETIME_DIFF({PVG expiry}, TODAY(), 'days'), 9999),
    IF({First aid expiry}, DATETIME_DIFF({First aid expiry}, TODAY(), 'days'), 9999),
    IF({Safeguarding expiry}, DATETIME_DIFF({Safeguarding expiry}, TODAY(), 'days'), 9999)
  ) = 9999,
  BLANK(),
  MIN(
    IF({PVG expiry}, DATETIME_DIFF({PVG expiry}, TODAY(), 'days'), 9999),
    IF({First aid expiry}, DATETIME_DIFF({First aid expiry}, TODAY(), 'days'), 9999),
    IF({Safeguarding expiry}, DATETIME_DIFF({Safeguarding expiry}, TODAY(), 'days'), 9999)
  )
)
```

**Views:**
1. **Hiring pipeline** — Kanban, stacked by `Status`. The owner's drag-and-drop board.
2. **Active coaches** — Grid, filter `Status = Active`.
3. **Cert watch** — Grid, filter `Next expiry days ≤ 45`, sorted ascending. Anyone on this list needs a renewal in motion.

---

## Part 2 — The Onboarding tasks table

**Add a table** → **Onboarding tasks** → fields:

| Field name | Field type           | Notes                                   |
|------------|----------------------|-----------------------------------------|
| `Task`     | Single line text     | Primary field.                          |
| `Coach`    | Link to record → Staff |                                       |
| `Due`      | Date                 |                                         |
| `Done`     | Checkbox             |                                         |
| `Notes`    | Long text            |                                         |

**View:** **Open tasks** — Grid, filter `Done` is unchecked, grouped by `Coach`,
sorted by `Due`. This is what the daily briefing reads from in Phase 4.

---

## Part 3 — The Resources table (the staff hub)

**Add a table** → **Resources** → fields:

| Field name | Field type      | Notes / options                                                        |
|------------|-----------------|------------------------------------------------------------------------|
| `Title`    | Single line text| Primary field.                                                         |
| `Type`     | Single select   | `Canva doc` · `PDF` · `Video` · `Link`                                 |
| `Category` | Single select   | `Coaching` · `Safeguarding` · `Admin` · `Playbooks`                    |
| `Link`     | URL             | Canva view link / Loom / unlisted YouTube / any URL.                   |
| `File`     | Attachment      | For PDFs uploaded directly.                                            |
| `Added`    | Created time    |                                                                        |
| `Notes`    | Long text       | One line on what it is / when to use it.                               |

### Make it the "staff hub"
1. Create a Grid view called **Staff hub**, grouped by `Category`, hide `Notes` if messy.
2. View menu → **Share view** → copy the **view share link**. Turn OFF "allow viewers
   to copy data" if offered.
3. That link **is** the staff hub. Coaches bookmark it on their phone — read-only,
   no login, always current. It goes in the welcome email (Automation 11).

### Content rules per type
- **Canva doc:** in Canva → Share → "Anyone with the link → can view" → paste into `Link`.
  Edit the design any time; the hub is never stale.
- **Video:** record in Loom (free) or upload unlisted to YouTube; paste the link.
- **PDF:** attach to `File` (session plans, policies, playbook cards).

### Seed content checklist (load before handover)
- [ ] The Academy Bible / coach handbook (PDF)
- [ ] 2–3 session plans (PDF or Canva)
- [ ] "Your first session here" walkthrough video
- [ ] Playbook cards: injury · safeguarding · missing child · angry parent (PDFs — Phase 4 writes these)

---

## Part 4 — Wire the coach-application page

Same drill as Phase 1, Part 4:

1. **Automations** → **Create automation** → trigger **When webhook received** → copy the webhook URL.
2. Open `coach-application.html` → paste it into `CONFIG.formEndpoint`. Submit a test
   application so Airtable captures the payload shape.
3. Add action → **Create record** in **Staff**, mapping:
   `Name←name` · `Email←email` · `Phone←phone` · `Qualification←qualification` ·
   `Experience←experience` · `Availability←availability` · `Message←message` ·
   `Status` ← hard-set `Applied`.
4. Turn it **On**.

Payload → field map (for reference): `name, email, phone, qualification, experience,
availability, message, academy, source (coach-application), page`.

---

## Part 5 — The six automations

Numbering continues from Phase 2 (5–9).

### Automation 10 — Application in → alert + auto-reply
- **Trigger:** When record created (Staff).
- **Action 1:** Send email → owner.
  - **Subject:** `New coach application: {Name}`
  - **Body:**
    > **{Name}** wants to coach. {Qualification} · {Experience} · available {Availability}.
    > Phone: {Phone} · Email: {Email}
    > "{Message}"
    > Reply today — good coaches get taken fast.
- **Action 2:** Send email → `{Email}`.
  - **Subject:** `Got your application — [Academy name]`
  - **Body:**
    > Thanks {Name} — your application's in. We reply to every one, usually the same
    > day. If it looks like a fit we'll ring you for a relaxed chat first. Speak soon!

### Automation 11 — Offer made → onboarding launches itself
- **Trigger:** When record matches conditions (Staff) → `Status` is `Offer made`.
- **Action 1–7:** Create record (Onboarding tasks) ×7, each linked to the triggering
  coach via `Coach`, `Due` = 14 days from now unless noted:
  1. `Contract sent & signed`
  2. `PVG / DBS submitted` — Due = **7 days from now**
  3. `Safeguarding certificate uploaded`
  4. `First-aid certificate uploaded`
  5. `Bank details for payroll`
  6. `Kit ordered`
  7. `Handbook read + walkthrough videos watched`
- **Action 8:** Update record → `Status` = `Onboarding`.
- **Action 9:** Send email → `{Email}`.
  - **Subject:** `Welcome aboard, {Name} 🎉`
  - **Body:**
    > Delighted to have you. Two links to save:
    > • **Staff hub** (bookmark this): [staff hub share link]
    > • Your handbook is in there under Admin — have a read before your first session.
    > Your onboarding checklist is underway — we'll nudge you (and us) about the
    > PVG and first-aid bits. Any questions, just reply.

### Automation 12 — Checklist complete → Active
- **Trigger:** When record matches conditions (Staff) → `Open tasks` = 0 **and** `Status` is `Onboarding`.
- **Action 1:** Update record → `Status` = `Active`, `Start date` = today (if blank).
- **Action 2:** Send email → owner: `✅ {Name} is fully onboarded and ready to coach.`

### Automation 13 — Certificate expiry: the 30-day warning
- **Trigger:** At scheduled time → **daily, 8am**.
- **Action 1:** Find records (Staff) → `Next expiry days` = 30 **and** `Status` is `Active`.
- **Action 2:** Send email → owner (repeating per record):
  - **Subject:** `Cert expiring in 30 days: {Name}`
  - **Body:** > One of {Name}'s certificates (PVG / first aid / safeguarding) expires in
    30 days — check the Cert watch view and get the renewal booked.
- **Action 3:** Send email → `{Email}`: a friendly "time to renew" note.

### Automation 14 — Certificate expiry: the 7-day red flag
Duplicate Automation 13 → condition `Next expiry days` = 7 →
- **Subject:** `🚨 7 DAYS: {Name}'s certificate expires`
- **Body:** > If this is the PVG, {Name} cannot coach alone once it lapses. Sort it this week.

### Automation 15 — Coach milestones → keep your keepers
- **Trigger:** At scheduled time → **daily, 8am**.
- **Action 1:** Find records (Staff) → `Status` is `Active` **and** `Start date` is exactly
  **91 days ago** (3 months) — *(duplicate this automation for 182 and 365 days)*.
- **Action 2:** Send email → owner:
  - **Subject:** `{Name} hits 3 months this week — book a check-in`
  - **Body:** > Ten minutes over a coffee: how's it going, what do they need, where do
    they want to grow? Staff retention is cheaper than staff recruitment.
- **For the 365-day copy**, add: > A year in — say thank you properly, and review their rate.

---

## Test checklist

- [ ] Submit a test application on the page → row appears as `Applied`, owner alert + auto-reply arrive.
- [ ] Drag the test coach to `Offer made` → 7 tasks appear, status flips to `Onboarding`, welcome email arrives with the hub link.
- [ ] Tick all 7 tasks → status flips to `Active`, `Start date` fills, owner gets the ✅ email.
- [ ] Set a cert expiry 30 days out → run/wait for the daily automation → both emails arrive.
- [ ] Open the staff hub share link on a phone — logged out — and confirm every resource opens.
- [ ] Delete the test coach + tasks.

---

## Client handoff delta

- [ ] Fill `coach-application.html`'s CONFIG block (name, colour, perks, webhook URL), publish it.
- [ ] Paste the staff hub share link into Automation 11's welcome email.
- [ ] Load the seed content checklist into Resources.
- [ ] Set owner email in automations 10, 12, 13, 14, 15.
- [ ] Run the test checklist end-to-end.
