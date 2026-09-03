# Build doc — Phase 4: Playbooks, retention + the command centre

The last build phase. Three jobs:
1. **Playbooks** — `incident-report.html` wired to an Incidents table, with safeguarding
   escalation that can't be quietly dropped.
2. **Retention** — cancellations get a reason, a graceful exit and a timed win-back;
   members get birthdays and milestones.
3. **Command centre** — the three briefing emails, including upgrading Phase 1's
   Automation 4 into the full 8am briefing.

**Prerequisites:** Phases 1–3 built. Print `PLAYBOOK-cards.print.html` to PDF first
(instructions in its header comment) — you'll load it into Resources here.

**What you end up with:** one new table, four new Member fields, automations 16–24.
~1.5 hrs.

---

## Part 1 — The Incidents table

**Add a table** → **Incidents** → fields:

| Field name          | Field type     | Notes / options                                                    |
|---------------------|----------------|--------------------------------------------------------------------|
| `Ref`               | Autonumber     | Primary field.                                                     |
| `Type`              | Single select  | `Injury` · `Safeguarding concern` · `Missing child` · `Angry parent / confrontation` · `Behaviour incident` · `Coach no-show / staffing` · `Other` — **match the page's dropdown exactly** |
| `Severity`          | Single select  | `Minor - handled on the day` · `Serious - owner needs to act` — match the page |
| `Person involved`   | Single line text |                                                                  |
| `What happened`     | Long text      |                                                                    |
| `Action taken`      | Long text      |                                                                    |
| `Parent informed`   | Single select  | `Yes` · `Not yet` · `Not applicable`                               |
| `Reported by`       | Single line text |                                                                  |
| `Date`              | Created time   |                                                                    |
| `Follow-up done`    | Checkbox       | Ticked once the owner has made the follow-up call / closed it out. |
| `SG: welfare officer informed` | Checkbox | Safeguarding escalation step 1.                          |
| `SG: written record complete`  | Checkbox | Step 2.                                                   |
| `SG: referral decision logged` | Checkbox | Step 3.                                                   |
| `SG open steps`     | Formula        | See below.                                                         |
| `Notes`             | Long text      |                                                                    |

**`SG open steps` formula:**

```
IF({Type} = 'Safeguarding concern',
  3 - ({SG: welfare officer informed} + {SG: written record complete} + {SG: referral decision logged}),
  0)
```

**Views:**
1. **Open** — Grid, filter: `Follow-up done` unchecked OR `SG open steps` > 0. Newest first.
2. **Accident log** — Grid, filter `Type = Injury`, all fields visible. This is the view
   you export if an insurer or governing body ever asks.

> **Privacy:** safeguarding details should not be readable by every collaborator on the
> base. Airtable's field/view permissions need a paid plan — on the free tier the honest
> mitigation is: the base has ONE user (the owner), staff interact only via the report
> page and shared hub view, and the welfare conversation happens off-system. Say this
> plainly in the setup guide.

---

## Part 2 — Wire the incident-report page

Same drill as before:
1. **Automations** → new automation → trigger **When webhook received** → copy the URL.
2. Paste into `incident-report.html` → `CONFIG.formEndpoint`. File a test report.
3. Action → **Create record** (Incidents): `Type←type` · `Severity←severity` ·
   `Person involved←person` · `What happened←what_happened` · `Action taken←action_taken` ·
   `Parent informed←parent_informed` · `Reported by←reporter`.
4. Turn **On**.

Then get the page into coaches' hands:
- Add it to **Resources** (Category: Admin, Type: Link) so it's on the staff hub.
- Generate a QR code for the page URL (any free generator) and paste it into the
  QR box on each playbook card before printing.

---

## Part 3 — Four new fields on Members

| Field name        | Field type | Notes                                                           |
|-------------------|-----------|------------------------------------------------------------------|
| `Cancelled on`    | Date      | Stamped by Automation 18.                                        |
| `Days to birthday`| Formula   | See below.                                                       |
| `Win-back sent`   | Checkbox  | Stops the win-back firing twice.                                 |
| `Review asked`    | Checkbox  | Stops the review ask firing twice.                               |

**`Days to birthday` formula** (blank-safe):

```
IF({DOB},
  MOD(DATETIME_DIFF(DATETIME_PARSE(DATETIME_FORMAT({DOB},'MM-DD') & '-' & YEAR(TODAY()),'MM-DD-YYYY'), TODAY(),'days') + 365, 365),
  BLANK())
```

---

## Part 4 — The automations (16–24)

### Automation 16 — Incident filed → owner knows in seconds
- **Trigger:** When record created (Incidents).
- **Action:** Send email → owner.
  - **Subject:** `⚠️ {Type} — {Severity}` *(safeguarding concerns will read
    "⚠️ Safeguarding concern — Serious", which is exactly the alarm level you want)*
  - **Body:**
    > **{Type}** reported by {Reported by}.
    > Who: {Person involved} · Parent informed: {Parent informed}
    > **What happened:** {What happened}
    > **Action taken:** {Action taken}
    > Open the record, add anything missing, and tick `Follow-up done` when it's closed out.
    > If this is safeguarding: the three SG steps on the record are your checklist. Today.

### Automation 17 — Injury yesterday → make the call
- **Trigger:** At scheduled time → **daily, 9am**.
- **Action 1:** Find records (Incidents) → `Type` is `Injury` **and** `Date` is **yesterday**
  **and** `Follow-up done` is unchecked.
- **Action 2:** Send email → owner (per record):
  - **Subject:** `Call {Person involved}'s parents today`
  - **Body:** > Quick check-in on yesterday's knock. Two minutes on the phone turns a bad
    moment into the reason they trust you. Tick `Follow-up done` after the call.

### Automation 18 — Member cancelled → graceful exit
- **Trigger:** When record matches conditions (Members) → `Status` is `Cancelled`.
- **Action 1:** Update record → `Cancelled on` = today.
- **Action 2:** Send email → `{Email}`.
  - **Subject:** `Sorry to see {Child name} go`
  - **Body:**
    > Thanks for everything — {Child name}'s been brilliant to have around. If things
    > change, their spot is always here. The door's open.
    > — [Owner name], [Academy name]
- **Action 3:** Send email → owner: `{Child name} cancelled — reason logged: {Cancel reason}`
  *(if `Cancel reason` is empty, this email is the nudge to go fill it in — the
  Scoreboard is only as honest as that field).*

### Automation 19 — 30 days later → the win-back
- **Trigger:** At scheduled time → **daily, 10am**.
- **Action 1:** Find records (Members) → `Status` is `Cancelled` **and** `Cancelled on` is
  exactly **30 days ago** **and** `Win-back sent` is unchecked.
- **Action 2:** Send email → `{Email}` (per record):
  - **Subject:** `We'd love {Child name} back — first month on us`
  - **Body:**
    > No pressure at all — but if the reason for leaving has eased, {Child name}'s
    > spot is still here and the first month back is free. Just reply to this email.
- **Action 3:** Update record → tick `Win-back sent`.

### Automation 20 — Birthday next week
- **Trigger:** At scheduled time → **daily, 8am**.
- **Action 1:** Find records (Members) → `Status` is `Active` **and** `Days to birthday` = 7.
- **Action 2:** Send email → `{Email}` (per record):
  - **Subject:** `🎂 {Child name}'s birthday is coming up!`
  - **Body:** > Happy almost-birthday {Child name}! [If the academy runs parties:]
    > Did you know we do football birthday parties? Reply for details — [Child name]'s
    > mates, a pitch, and zero mess in your living room.

### Automation 21 — Member milestones
- **Trigger:** At scheduled time → **daily, 8am**.
- **Action 1:** Find records (Members) → `Status` is `Active` **and** `Joined` is exactly
  **182 days ago** **and** `Review asked` unchecked.
- **Action 2:** Send email → `{Email}`:
  - **Subject:** `Six months of {Child name} ⚽`
  - **Body:** > {Child name}'s been with us six months! If you've been happy, a Google
    review takes 60 seconds and genuinely keeps a small academy alive: **[review link]**
- **Action 3:** Update record → tick `Review asked`.
- **Duplicate** for `Joined` exactly **365 days ago** (skip the checkbox condition):
  - **Subject:** `One year! Bring a friend on us`
  - **Body:** > A whole year — thank you. If {Child name} has a mate who'd love it,
    their first session's free: just reply with a name.

### Automation 22 — UPGRADE Phase 1's Automation 4 → the full 8am briefing
Open Automation 4 (the daily "leads to chase") and grow it into the one email that
runs the owner's morning. Same 8am trigger, now **five find-records steps**, one email:

1. **Find:** Leads → `Follow-up` is today or before, `Status` not `Enrolled`/`Lost`.
2. **Find:** Leads → `Status` is `Trial booked`, `Trial date` is today.
3. **Find:** Onboarding tasks → `Done` unchecked, `Due` is today or before.
4. **Find:** Staff → `Status` is `Active`, `Next expiry days` ≤ 30.
5. **Find:** Incidents → `SG open steps` > 0 **or** (`Severity` is `Serious - owner needs to act` and `Follow-up done` unchecked).

- **Send email** → owner. **Subject:** `Your academy today`
- **Body** (insert each list as a grid; keep the section headers):
  > ☎️ **Chase today** — {list 1: Parent name · Phone · Status}
  > ⚽ **Trials today** — {list 2: Child name · Trial date}
  > 📋 **Onboarding overdue** — {list 3: Task · Coach}
  > 📄 **Certs expiring ≤30 days** — {list 4: Name · Next expiry days}
  > 🚨 **Open incidents** — {list 5: Type · Person involved}
  > Everything else is handled.

> Airtable sends this even on empty days (skipping needs conditional logic on a paid
> plan). Fine — an "everything's handled" email is its own small pleasure. If the
> client is on a paid plan, add a condition: only send when any list has records.

### Automation 23 — Monday pulse
- **Trigger:** At scheduled time → **weekly, Monday 8:30am**.
- **Finds:** Leads created in the last 7 days · Leads with `Status` = `Trial booked` ·
  `Enrolled` in the last 7 days (use a `Status changed`/last-modified filter or just
  `Joined` within 7 days on Members) · Members with `Cancelled on` within 7 days.
- **Send email** → owner. **Subject:** `Last week in numbers`
- **Body:** the four counts, one line each:
  > New leads: {count 1} · Trials booked: {count 2} · New members: {count 3} · Cancelled: {count 4}
  > (Numbers a mentor would ask for — you just got them without lifting a finger.)

### Automation 24 — Monthly scoreboard row
- **Trigger:** At scheduled time → **monthly, 1st, 7am**.
- **Finds:** Leads created last month · Members `Joined` last month · Members
  `Cancelled on` last month · Members `Status` = `Active` (the running total).
- **Action:** Create record (Scoreboard): `Month` = last month, plus the four counts
  (insert each find's record count), `Est. revenue` = leave for the owner or set a
  formula `Active members × standard fee` later.
- **Send email** → owner with the same numbers. **Subject:** `📊 [Month] scoreboard`

**The Scoreboard table** (if not created yet): `Month` (single line, primary) ·
`Leads` · `New members` · `Cancelled` · `Active members` (all numbers) · `Est. revenue`
(currency) · `Notes`.

---

## Test checklist

- [ ] File a test **Injury** report from a phone → row lands, owner alert arrives, playbook reminder showed on the page before submitting.
- [ ] File a test **Safeguarding concern** → severity auto-set to Serious, alert arrives, `SG open steps` = 3; tick the three boxes → formula hits 0.
- [ ] Next morning (or run manually): injury follow-up email arrives; tick `Follow-up done` → stops.
- [ ] Cancel a test member with a reason → exit email + owner note arrive, `Cancelled on` stamped.
- [ ] Set a test member's `Cancelled on` to 30 days ago → win-back fires once, checkbox ticks.
- [ ] Set a test DOB 7 days out → birthday email fires.
- [ ] Run the 8am briefing → all five sections render, empty ones read as empty not broken.
- [ ] Delete all test rows.

---

## Client handoff delta

- [ ] Fill `incident-report.html` CONFIG + webhook, publish, add to Resources.
- [ ] Print playbook cards to PDF (QR + phone numbers + welfare officer filled in), load PDF into Resources, laminate a set for the kit bag.
- [ ] Paste the academy's Google review link into Automation 21.
- [ ] Decide the win-back offer (default: first month free) and the 12-month referral offer.
- [ ] Walk every coach through the playbook cards at the next staff meeting — the system only works if the cards are known before they're needed.
