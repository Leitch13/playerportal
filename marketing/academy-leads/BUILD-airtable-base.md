# Build doc — "Academy Leads" Airtable base

The one-time build. Do this **once**, then share it as a template so every client
duplicates their own copy. ~30–40 min the first time.

Pairs with `trial-funnel.html` (the capture page) in this folder.

**What you end up with:** a Leads table → a Pipeline board for tracking → four
automations that alert you, reply to parents, and chase follow-ups. All on
Airtable's free tier.

---

## Part 1 — Create the base + the Leads table

1. Airtable → **Add a base** → **Start from scratch**. Name it **Academy Leads**.
2. Rename the default table to **Leads**.
3. Delete the sample fields, then build these exact fields:

| Field name    | Field type              | Notes / options                                                        |
|---------------|-------------------------|------------------------------------------------------------------------|
| `Parent name` | Single line text         | This is the primary field (first column).                              |
| `Child name`  | Single line text         |                                                                        |
| `Child age`   | Number (integer)         |                                                                        |
| `Email`       | Email                    |                                                                        |
| `Phone`       | Phone number             |                                                                        |
| `Source`      | Single select            | Options below (§2a).                                                    |
| `Status`      | Single select            | Options below (§2b) — this drives the Pipeline board.                   |
| `Follow-up`   | Date                     | Turn OFF "include time".                                                |
| `Notes`       | Long text                | Free space for the owner.                                               |
| `Created`     | Created time             | Auto-filled by Airtable. (Built-in field — just add it.)               |
| `Page`        | URL                      | Which funnel/campaign the lead came from (optional).                   |

### 2a — `Source` single-select options
`Website` · `Facebook` · `Instagram` · `Referral` · `Walk-in` · `Phone` · `Manual`

(Colours don't matter here — pick anything.)

### 2b — `Status` single-select options (order matters — this is the pipeline)
Create them **in this order**, with these colours so the board reads well:

| Option           | Colour       |
|------------------|--------------|
| `New`            | Grey         |
| `Contacted`      | Yellow       |
| `Trial booked`   | Orange       |
| `Trial attended` | Teal         |
| `Enrolled`       | Green        |
| `Lost`           | Red          |

Set the **default value** of `Status` to `New`.

---

## Part 3 — The two views

### Grid view (already there)
Leave the default **Grid** view as-is — this is the "every lead in one place" spreadsheet.
Optional: sort by `Created` (newest first).

### Pipeline view (the tracking board)
1. Left sidebar → **+ Create** → **Kanban**. Name it **Pipeline**.
2. "Stack by" → **Status**.
3. You'll now see a column per status. Drag a lead card between columns to move it
   through the pipeline. That drag is what the client does day-to-day.

---

## Part 4 — Connect the funnel page to the base

The funnel form POSTs JSON (`parent_name, email, phone, child_name, child_age,
academy, source, page`) to whatever URL you put in its `formEndpoint`. That URL is
the bridge into Airtable. Two ways — pick one.

> **Security note:** do **not** paste an Airtable API key into `trial-funnel.html`.
> It's a public page — a key there is exposed to anyone. Both methods below keep the
> credential server-side.

### Option A — Airtable's built-in webhook trigger (cleanest, no middle tool)
1. In the base → **Automations** → **Create automation**.
2. Trigger → **When webhook received**. Airtable gives you a **webhook URL**.
3. Paste that URL into the funnel's `formEndpoint`. Submit the form once so Airtable
   captures the payload shape.
4. Add action → **Create record** in **Leads**, mapping:
   - `Parent name` ← `parent_name`
   - `Child name`  ← `child_name`
   - `Child age`   ← `child_age`
   - `Email`       ← `email`
   - `Phone`       ← `phone`
   - `Source`      ← `source` (or hard-set to `Website`)
   - `Page`        ← `page`
   - `Status`      ← `New`
5. Turn the automation **On**. This "new record" is what the alerts in Part 5 hang off.

> Check the incoming-webhook trigger is on the plan you'll give clients — if not, use Option B.

### Option B — Make.com relay (fallback, still free)
1. make.com → new scenario → **Webhooks → Custom webhook** → copy its URL.
2. Paste that URL into the funnel's `formEndpoint`.
3. Add module → **Airtable → Create a record**, connect the base, map the same fields
   as above. Save + turn the scenario **On**.

Either way: funnel → (webhook) → a new `New` lead appears in the base within a second.

---

## Part 5 — The four automations

All built in **Automations** inside the base. Each has a trigger and an action.
Sample copy is below each — tweak to taste.

### Automation 1 — New lead → alert the owner instantly
- **Trigger:** When record created (Leads).
- **Action:** Send email → to the **owner's email**.
- **Subject:** `New lead: {Child name} (age {Child age})`
- **Body:**
  > New enquiry from **{Parent name}**.
  > Child: {Child name}, age {Child age}. Phone: {Phone}. Email: {Email}.
  > Source: {Source}. Call them today.

### Automation 2 — New lead → auto-reply to the parent
- **Trigger:** When record created (Leads).
- **Action 1:** Send email → to `{Email}`.
- **Subject:** `Thanks — let's get {Child name} booked in`
- **Body:**
  > Hi {Parent name}, thanks for booking a free trial for {Child name}!
  > We'll be in touch today to confirm the time. Reply to this email with any questions.
  > — [Academy name]
- **Action 2:** Update record → set `Follow-up` = **today** (so it shows on the chase list).

### Automation 3 — Trial booked → confirm + remind
- **Trigger:** When record matches conditions → `Status` **is** `Trial booked`.
- **Action:** Send email → to `{Email}`.
- **Subject:** `Your trial is booked 🎉`
- **Body:**
  > Great news {Parent name} — {Child name}'s trial is confirmed.
  > Bring boots, shin pads and water. See you there!
- *(Optional day-before reminder: add a second, scheduled automation that emails leads
  whose trial date is tomorrow.)*

### Automation 4 — Follow-up due today → remind the owner
- **Trigger:** At scheduled time → **daily, 8am**.
- **Action:** Find records where `Follow-up` **is** today **and** `Status` is not
  `Enrolled`/`Lost` → Send email → to the owner listing them.
- **Subject:** `Leads to chase today`
- **Body:** a list of `{Parent name} — {Phone} — {Status}` so nothing goes cold.

---

## Part 6 — Turn it into a reusable template

1. In the base → top-right **Share** → **Share base** (or "Copy base link" /
   "Duplicate"). You want a link that lets someone **copy the base into their own
   workspace** (structure + views + automations, no data).
2. Save that link — it's what you send every client.
3. When a client duplicates it, they own a private copy; they only need to
   reconnect the webhook (Part 4) and set the two owner-email addresses in the
   automations to their own.

---

## Client handoff checklist (give them this)

- [ ] Duplicate the Academy Leads base from the link.
- [ ] Open `trial-funnel.html`, fill in the CONFIG block (name, colour, offer, email), publish it.
- [ ] Wire the funnel → base (paste the webhook URL into `formEndpoint`).
- [ ] In automations 1 & 4, set the owner-email to their own address.
- [ ] Submit a test lead → confirm: card appears, owner email arrives, parent auto-reply arrives.
- [ ] Go live.

---

## Appendix — funnel payload → Airtable field map

| Funnel JSON key | Airtable field | Notes                                  |
|-----------------|----------------|----------------------------------------|
| `parent_name`   | `Parent name`  |                                        |
| `child_name`    | `Child name`   |                                        |
| `child_age`     | `Child age`    | Number                                 |
| `email`         | `Email`        |                                        |
| `phone`         | `Phone`        |                                        |
| `source`        | `Source`       | Funnel sends `trial-funnel`; map/set to `Website` |
| `academy`       | — (or Notes)   | Only needed if one base serves several academies |
| `page`          | `Page`         | Campaign/URL the lead came from        |
| _(auto)_        | `Created`      | Airtable fills this                    |
| _(set)_         | `Status`       | Always `New` on create                 |
