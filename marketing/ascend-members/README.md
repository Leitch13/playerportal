# ASCEND Members — the member site

A standalone static site: the onboarding home for paying ASCEND members. No build
step, no framework, no dependencies. Drag the folder onto Netlify and it's live.

Deliberately separate from the marketing sites (`ascendcalculator.netlify.app`,
the mentorship page) — those sell, this delivers. Different audience, different job.

---

## What's in it

| Page | Job |
|---|---|
| `index.html` | The hub. Shows their progress and what to do next. |
| `start-here.html` | The 30-day path — 9 steps, tickable, saved locally. |
| `library.html` | Every resource, filed by ASCEND stage, wired to Drive. |
| `intake.html` | Baseline numbers, so call one starts at the useful bit. |
| `work-with-me.html` | Booking, WhatsApp, what's included, straight answers. |
| `diagnostic.html` | Carried over from the tools site. |
| `pricing-calculator.html` `money-map.html` `time-audit.html` `roles-audit.html` | Carried over. |
| `ads-training.html` `year-planner.html` `mindset-test.html` | Pulled in from the landing-page folder. |
| `ascend.css` | Shared design system — palette and type match the old tools site, so the carried-over tools look native. |

Working docs, not part of the site: `DELIVERY-SOP.md`, `WELCOME-EMAILS.md`,
`DRIVE-STRUCTURE.md`.

---

## Before it goes live — 4 things to fill in

Find and replace across the folder. Nothing else is outstanding.

| Placeholder | Where | What it needs |
|---|---|---|
| `BOOKING_LINK` | ×5 | Your Calendly (or Wix Bookings) URL. Two call types would be ideal — 45-min kickoff, 30-min monthly — but one link works. |
| `WHATSAPP_NUMBER` | ×1 | Your number in international format, digits only: `447595426746`. It slots into `https://wa.me/...`. |
| `JOHN_EMAIL` | ×2 | The address you want members using. |
| `INTAKE_FORM_ENDPOINT` | ×1 | A new Formspree form — call it "ASCEND Member Intake". Keep it separate from the calculator form (`xjybwyqv`) so member intakes don't get lost among cold leads. |

```bash
cd marketing/ascend-members
grep -rl 'BOOKING_LINK' . | xargs sed -i '' 's|BOOKING_LINK|https://calendly.com/your-link|g'
```

**The intake form does not dead-end if you skip the endpoint.** With the placeholder
left in, it falls back to "open in your email app" plus copy-to-clipboard — same
never-dead-end principle as the calculator gate. Wire Formspree when you get to it;
it works before then.

---

## Deploying

Same drag-and-drop as your other sites:

1. Drag this folder onto Netlify.
2. **Site configuration → Access & security → Site protection → Public.** Your account
   defaults new drop-sites to a 401 login wall — this bites every single time.
3. Suggested name: `ascendmembers.netlify.app`.

Every page carries `noindex,nofollow`, so it won't turn up in search results.

### Access

There's no login. The URL is the access control, same as the tools site — you give it
to members in the welcome email and nowhere else. Honest about what that is: a lock
on a door that a member could hand the key to. For a £50/mo membership that's the
normal trade, and it costs nothing to run.

If it ever needs to be real — a shared password gate is an hour's work; proper
per-member logins mean building it into the Player Portal app instead.

---

## Note on the old tools site

`ascendtools.netlify.app` is now superseded. Every tool on it is here, in a structure
that tells members what to do rather than just handing them a shelf. Once this is live,
either redirect it here or take it down — leaving two member-facing sites up is how
people end up on the stale one.

---

## Design system

Defined once in `ascend.css`, matching the existing tools so nothing looks bolted on.

- Background `#0B1214`, panels `#121E21`, cyan `#33E3E3`
- Archivo 900 display, Inter body, Space Mono for eyebrows and labels
- Progress state lives in `localStorage` under `ascend_onboarding_v1`;
  the intake draft under `ascend_intake_draft_v1`

The hub reads the same key `start-here.html` writes — if you ever change the number of
steps, update `STEP_TITLES` in `index.html` to match, or the hub's "next step" pointer
will drift out of sync with the path.
