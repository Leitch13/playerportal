# Build doc — Phase 2: the Conversion module

Extends the **Academy Leads** base from `BUILD-airtable-base.md` into the first slice
of the Academy OS: nothing between "trial booked" and "enrolled" gets forgotten,
and every won lead lands in a proper Members table.

**Prerequisite:** the Phase 1 base (Leads table + Pipeline board + 4 automations),
built and working. Everything below is additive — no existing field or automation
changes, so live clients can upgrade in place.

**What you end up with:** a Members table, 2 new fields + 1 new status on Leads,
and five automations that confirm trials, remind, follow up, rescue no-shows,
chase cold leads, and enrol winners automatically. ~45 min. Still free tier.

---

## Part 1 — Two new fields + one new status on Leads

1. Open the **Leads** table → add these fields:

| Field name   | Field type      | Notes                                                     |
|--------------|-----------------|-----------------------------------------------------------|
| `Trial date` | Date            | Turn ON "include time" — the session the trial is booked into. |
| `Enrol link` | URL             | Optional per-lead override; usually blank (Automation 5 uses the academy's standard link). |

2. Open the `Status` field → add one option, between `Trial booked` and `Trial attended`:

| Option    | Colour |
|-----------|--------|
| `No-show` | Purple |

The pipeline now reads: `New` → `Contacted` → `Trial booked` → (`Trial attended` **or** `No-show`) → `Enrolled` / `Lost`.

---

## Part 2 — The Members table

**Add a table** → name it **Members** → build these fields:

| Field name      | Field type              | Notes / options                                            |
|-----------------|-------------------------|------------------------------------------------------------|
| `Child name`    | Single line text         | Primary field.                                             |
| `Parent name`   | Single line text         |                                                            |
| `Email`         | Email                    |                                                            |
| `Phone`         | Phone number             |                                                            |
| `DOB`           | Date                     | Ask at enrolment — powers birthday emails in Phase 4.      |
| `Joined`        | Date                     |                                                            |
| `Monthly fee`   | Currency (£)             | The number the Scoreboard multiplies. Set a default = the academy's standard fee. |
| `Status`        | Single select            | `Active` (green) · `Paused` (yellow) · `Cancelled` (red). Default `Active`. |
| `Cancel reason` | Single select            | `Cost` · `Moved away` · `Lost interest` · `Other club` · `Schedule` · `Other`. Used in Phase 4. |
| `Lead`          | Link to record → Leads   | Filled automatically by Automation 5.                      |
| `Notes`         | Long text                |                                                            |

**Views:** keep Grid; add a Grid view called **Active members** filtered to
`Status = Active`, sorted by `Joined` (newest first). That view's record count is
the academy's headline number.

---

## Part 3 — The five automations

All in **Automations**. Copy below — tweak names/venue to the academy.

### Automation 5 — Trial booked → confirm it
- **Trigger:** When record matches conditions (Leads) → `Status` is `Trial booked`.
- **Action:** Send email → to `{Email}`.
- **Subject:** `{Child name}'s trial is booked 🎉`
- **Body:**
  > Great news {Parent name} — {Child name}'s trial is confirmed for **{Trial date}**.
  > Bring boots, shin pads and water. Any problems on the day, just reply here.
  > — [Academy name]

### Automation 6 — Day-before reminder
- **Trigger:** At scheduled time → **daily, 5pm**.
- **Action 1:** Find records (Leads) → `Status` is `Trial booked` **and** `Trial date` is **tomorrow**.
- **Action 2:** Send email → to `{Email}` (repeats per found record — use a repeating group if prompted).
- **Subject:** `See you tomorrow, {Child name}!`
- **Body:**
  > Quick reminder — {Child name}'s trial is tomorrow at **{Trial date}**. See you there!

### Automation 7 — Trial attended → the enrol nudge
The owner's one job after a session: drag attendees to `Trial attended` (and
absentees to `No-show`). The system does the rest.
- **Trigger:** When record matches conditions (Leads) → `Status` is `Trial attended`.
- **Action 1:** Send email → to `{Email}`.
- **Subject:** `How did {Child name} find it?`
- **Body:**
  > Great to have {Child name} down! If they loved it, here's the link to enrol and
  > lock in their spot: **[academy's enrol/booking link]**
  > Questions about groups, fees or anything else — just reply.
- **Action 2:** Update record → `Follow-up` = **2 days from now** (so an unanswered
  nudge lands back on the daily chase list from Phase 1).

> Tip: if the owner does admin the morning after sessions, the email still reads
> right — it says "great to have them down", not "today".

### Automation 8 — No-show → rescue, don't lose
- **Trigger:** When record matches conditions (Leads) → `Status` is `No-show`.
- **Action 1:** Send email → to `{Email}`.
- **Subject:** `We missed {Child name} — want to rebook?`
- **Body:**
  > No worries at all {Parent name} — life happens! {Child name}'s free trial is
  > still there. Reply with a day that suits and we'll get them booked straight in.
- **Action 2:** Update record → `Follow-up` = **2 days from now**.

### Automation 9 — Enrolled → become a Member
The win. One drag by the owner, four things by the system.
- **Trigger:** When record matches conditions (Leads) → `Status` is `Enrolled`.
- **Action 1:** Create record (Members) →
  - `Child name` ← `{Child name}` · `Parent name` ← `{Parent name}`
  - `Email` ← `{Email}` · `Phone` ← `{Phone}`
  - `Joined` ← today · `Status` ← `Active` · `Lead` ← the triggering record
- **Action 2:** Send email → to `{Email}`.
- **Subject:** `Welcome to [Academy name], {Child name}! ⚽`
- **Body:**
  > You're in! Everything you need:
  > • **Kit list & what to bring** — [line or link]
  > • **Term dates & venue** — [line or link]
  > • **Payment** — [how they pay / link]
  > • **Parents' WhatsApp group** — [invite link]
  > Any questions, reply here. See you at training!
- **Action 3 (optional):** Send email → owner: `🎉 New member: {Child name}` — a
  small dopamine hit that keeps the owner trusting the system.

> `Monthly fee` and `DOB` aren't in the lead data — the owner fills those two cells
> when the enrolment form/payment comes back. Everything else is automatic.

---

## Part 4 — One tweak to a Phase 1 automation

Open **Automation 4** (the 8am "leads to chase" digest) and add `No-show` to the
statuses it excludes-nothing-from: condition should now be `Status` is none of
`Enrolled`, `Lost` — i.e. no change needed **unless** you originally listed
included statuses explicitly. No-shows must stay on the chase list.

---

## Test checklist (run with a real inbox before handing over)

- [ ] Set a test lead to `Trial booked` with `Trial date` = tomorrow → confirmation email arrives.
- [ ] Wait for (or manually run) the 5pm scheduled automation → reminder arrives.
- [ ] Set status `Trial attended` → enrol-nudge email arrives, `Follow-up` = +2 days.
- [ ] Set status `No-show` → rescue email arrives, `Follow-up` = +2 days.
- [ ] Set status `Enrolled` → row appears in **Members** (linked back to the lead), welcome email arrives.
- [ ] Check the Members **Active members** view count ticked up.
- [ ] Delete the test member row + test lead.

---

## Client handoff delta (add to the Phase 1 checklist)

- [ ] Paste the academy's enrol/booking link into Automation 7's body.
- [ ] Fill the welcome email's four bullets (kit, dates, payment, WhatsApp).
- [ ] Set the Members `Monthly fee` default to the academy's standard fee.
- [ ] Run the test checklist above once end-to-end.
