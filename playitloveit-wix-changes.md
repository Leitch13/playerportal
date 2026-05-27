# Playit Loveit — Wix Change Pack

Single source of truth. Open this in one browser tab, Wix in another, work top-to-bottom. Each card tells you **WHERE** to go in Wix, **WHAT** to paste, and any **SETTINGS** to flip.

`[FILL LATER]` = waiting on info from you. Everything else is final.

**Login:** `manage.wix.com` → pick the Playit Loveit site.
- **Dashboard** = settings (left sidebar after login)
- **Editor** = page layout (top-right blue "Edit Site" button)

Use a laptop. Have `playitloveit.com` open in a third tab to spot-check.

---

## Sitting 1 — SEO foundations (~25 min)

### Card 1 — Business info

**WHERE:** Dashboard → Settings → Business Info

**SET THESE FIELDS:**
- Business name: `Playit Loveit`
- Phone: `+44 7876 046014`
- Email: `[FILL LATER]`
- Address: `Aberdeen, [POSTCODE — FILL LATER]`
- Country: `United Kingdom`

Click **Save**. ☐

---

### Card 2 — JSON-LD structured data (LocalBusiness schema)

**WHERE:** Dashboard → Settings → Custom Code → **+ Add Custom Code**

**FORM FIELDS:**
- Name: `LocalBusiness Schema`
- Add code to pages: `All pages`
- Place code in: `Head`
- Load code: `Only on first load`

**PASTE THIS into the code box:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "name": "Playit Loveit",
  "url": "https://www.playitloveit.com",
  "telephone": "+447876046014",
  "email": "[FILL LATER]",
  "priceRange": "££",
  "foundingDate": "2018-11",
  "sport": "Soccer",
  "areaServed": { "@type": "City", "name": "Aberdeen" },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Aberdeen",
    "addressRegion": "Aberdeenshire",
    "addressCountry": "GB",
    "postalCode": "[FILL LATER]"
  },
  "location": [
    { "@type": "Place", "name": "Strikers Indoor Football", "address": { "@type": "PostalAddress", "addressLocality": "Aberdeen", "addressCountry": "GB" } },
    { "@type": "Place", "name": "Balmoral Stadium", "address": { "@type": "PostalAddress", "addressLocality": "Aberdeen", "addressCountry": "GB" } },
    { "@type": "Place", "name": "Fives Football Aberdeen", "address": { "@type": "PostalAddress", "addressLocality": "Aberdeen", "addressCountry": "GB" } }
  ],
  "audience": { "@type": "PeopleAudience", "suggestedMinAge": 3, "suggestedMaxAge": 18 },
  "sameAs": [ "https://www.instagram.com/playitloveit1" ]
}
</script>
```

Click **Apply**. ☐

> If you don't see "Custom Code" in your Wix plan, tell me — there's a workaround.

---

### Card 3 — Meta titles & descriptions (per page)

**WHERE for each page:** Dashboard → SEO → Pages → click the page → **Edit SEO settings** → fill **Title tag** and **Meta description**.

#### Homepage
- **Title:** `Football Coaching in Aberdeen | Playit Loveit`
- **Description:** `Football coaching for ages 3–18 across Aberdeen — at Strikers Indoor & Balmoral Stadium. Academy, 1-2-1s & holiday camps. Book a free trial.`
☐

#### /academy
- **Title:** `Football Academy Aberdeen, Ages 3–18 | Playit Loveit`
- **Description:** `Weekly football coaching from £42/month at Strikers Indoor & Balmoral. Soccer Tots, Academy & Accelerator tiers. Book a free trial today.`
☐

#### /1-2-1
- **Title:** `1-2-1 Football Coaching Aberdeen | Playit Loveit`
- **Description:** `Private 1-hour football coaching at Strikers Indoor & Balmoral Stadium, Aberdeen. £48/session, ages 6–18. See live availability & book.`
☐

#### /soccer-camps
- **Title:** `Aberdeen Football Holiday Camps | Playit Loveit`
- **Description:** `School-holiday football camps in Aberdeen for ages 5–12. Easter, May, summer & October dates. Limited spots — book early.`
☐

#### /general-4 (will rename to /faqs in Card 10)
- **Title:** `FAQs & Booking Policies | Playit Loveit`
- **Description:** `Trial decision window, refund policy, cancellation terms and what to bring. Everything you need to know before booking.`
☐

#### /about-basic
- **Title:** `About Playit Loveit | Aberdeen Football Coaching Since 2018`
- **Description:** `Aberdeen football coaching since 2018. Meet the coaches, our values, and why parents trust us with their players.`
☐

---

### Card 4 — Hide junk pages from Google

**WHERE:** Dashboard → SEO → Pages

For each of these pages, toggle **"Let search engines index this page"** to **OFF**:
- `/playitloveitreact` ☐
- `/book-online-1` ☐ (we'll rebuild this in Card 11)

---

## Sitting 2 — Booking experience (~40 min)

Click **Edit Site** (top-right blue button) to open the **Editor**. All cards in this sitting happen here.

### Card 5 — Sticky "Book a Free Trial" button in the header

**WHERE:** Editor → click the header strip at the top of any page

**STEPS:**
1. Click **+ Add Elements** (left toolbar) → **Button** → drag into the header (right side, next to existing nav).
2. Click the new button → **Change Text** → type: `Book a Free Trial`
3. Style: bright orange (matches energy), white text, bold.
4. Click **Link** icon → **Page** → link to `/book-online-1` for now (we'll rebuild that page in Card 11).
5. Switch to **Mobile view** (phone icon, top toolbar) → drag the button so it shows in the mobile header without overlapping the menu.
6. **Settings on the button** → tick **"Pin to screen"** → choose **Top right** → this makes it sticky as the parent scrolls.

**Publish** when done. ☐

---

### Card 6 — Homepage hero rewrite

**WHERE:** Editor → Pages panel → Home

**A. Replace the headline** "your new home of football":

```
Football coaching kids actually want to come back to.
```

**B. Replace/add subheadline:**

```
Weekly academy, 1-2-1s and holiday camps for ages 3–18 across Aberdeen — at Strikers Indoor and Balmoral Stadium.
```

**C. Replace the existing CTA with TWO buttons side by side:**
- Primary (orange): `Book a Free Trial` → links to `/book-online-1`
- Secondary (outline): `See all classes` → links to `/academy`

**D. Hero image performance:**
- Click the hero image → **Settings** (gear icon) → **Display** tab → untick **Lazy Load**.
- This makes Google's "Largest Contentful Paint" score better.

☐

---

### Card 7 — Trust strip under the hero

**WHERE:** Editor → Home page → directly below the hero

**STEPS:**
1. **+ Add Elements** → **Strip** → choose a **4-column** layout → drag below the hero.
2. In each column, paste the text below.

**Column 1 (parent quote):**
```
★★★★★
"[Parent quote — FILL LATER, 1 short sentence]"
— [Parent name — FILL LATER]
```

**Column 2:**
```
PVG-checked coaches
[FILL LATER: confirm yes]
```

**Column 3:**
```
SFA / FA-qualified
[FILL LATER: confirm + which badge]
```

**Column 4:**
```
Coaching in Aberdeen since 2018
500+ players developed
```

Style: light grey background, dark text, evenly spaced. ☐

---

### Card 8 — Academy page tier cards

**WHERE:** Editor → Pages → Academy

Find the existing 4 tier blocks and replace each with the content below. Use a 2x2 grid on desktop, stacked on mobile.

#### Card A — Soccer Tots
```
SOCCER TOTS                                         From £42/month
Best for: First-time players building confidence with a ball
Ages 3–5  ·  45 min weekly  ·  Strikers Indoor Football, Aberdeen
When: [Day & time — FILL LATER]
Same fee year-round — including school holidays.

[ Book a Free Trial ]   [ Join Soccer Tots ]
```

#### Card B — Academy
```
ACADEMY                                             From £48/month
Best for: Players ready for structured training and match prep
Ages 6–12  ·  1 hour weekly  ·  Strikers Indoor Football, Aberdeen
When: [Day & time — FILL LATER]
Same fee year-round — including school holidays.

[ Book a Free Trial ]   [ Join the Academy ]
```

#### Card C — Accelerator
```
ACCELERATOR                                         From £48/month
Best for: Players already in a club team wanting an extra edge
Ages 9–14  ·  1 hour small-group (max 8)  ·  Balmoral Stadium, Aberdeen
When: [Day & time — FILL LATER]
Same fee year-round — including school holidays.

[ Book a Free Trial ]   [ Join the Accelerator ]
```

#### Card D — Intensity
```
INTENSITY                                           £24 per session
Best for: Pre-season fitness or holiday top-ups — no commitment
Ages 9–18  ·  Drop-in, pay per session  ·  [Venue — FILL LATER]
When: [Day & time — FILL LATER]
Pay only for the sessions you book.

[ Book your first session ]
```

**Button links:**
- `Book a Free Trial` → `/book-online-1`
- `Join the Academy / Soccer Tots / Accelerator` → `https://playitloveit.classforkids.io/term/217`
- `Book your first session` → `https://playitloveit.classforkids.io/term/217`

**One-line reassurance row UNDER all four cards (small text, italic):**
```
Try it risk-free — 36 hours after the trial to decide. Cancel any monthly membership with 30 days' notice.
```

☐

---

### Card 9 — 1-2-1 page: live schedule table

**WHERE:** Editor → Pages → 1-2-1

**A. Delete** the existing "£48 per session" block + the lone "book here" button.

**B. Add a single headline at the top:**
```
1-2-1 Coaching — £48 / 1 hour
Ages 6–18  ·  Strikers Indoor Football & Balmoral Stadium, Aberdeen
```

**C. Add a Table:** **+ Add Elements** → **Table** → drag onto page. Build with these rows:

| Day | Time | Venue | Availability | |
|---|---|---|---|---|
| Mon | 4:00 – 5:00pm | Strikers Indoor | Trial available | [Book] |
| Mon | 5:00 – 6:00pm | Strikers Indoor | Trial available | [Book] |
| Tue | 4:00 – 5:00pm | Strikers Indoor | Trial available | [Book] |
| Wed | 4:00 – 5:00pm | Balmoral Stadium | Trial available | [Book] |
| Wed | 4:00 – 5:00pm | Strikers Indoor | Trial available | [Book] |
| Wed | 5:00 – 6:00pm | Strikers Indoor | Trial available | [Book] |
| Wed | 5:00 – 6:00pm | Balmoral Stadium | Waitlist | [Join waitlist] |
| Fri | 3:50 – 4:50pm | Strikers Indoor | Waitlist | [Join waitlist] |
| Fri | 4:50 – 5:50pm | Strikers Indoor | Waitlist | [Join waitlist] |

All `[Book]` and `[Join waitlist]` buttons link to: `https://playitloveit.classforkids.io/term/217`

**D. Below the table, add a small text block:**
```
Don't see a slot that works? Text 07876 046014 and we'll find one.
```

> **Maintenance:** Update this table whenever a new term opens on ClassForKids — takes 2 minutes.

☐

---

## Sitting 3 — Cleanup & content (~30 min)

### Card 10 — Rename `/general-4` → `/faqs`

**WHERE:** Editor → Pages panel → right-click **FAQs (general-4)** → **Page Settings** → **SEO Basics** tab

- **URL slug:** change `general-4` to `faqs`
- Save.
- Then check the main site nav (top of every page) — if it links to `/general-4`, repoint it to `/faqs`.

☐

---

### Card 11 — Soccer camps page rebuild

**WHERE:** Editor → Pages → Soccer Camps

**A. Replace the empty page content with this header:**
```
Aberdeen Football Holiday Camps
Ages 5–12  ·  10am – 3pm daily  ·  [Venue — FILL LATER]
£90–£150 per camp  ·  Limited spots
```

**B. Add a Table with the 2026 schedule:**

| Camp | Dates | Price | Spots | |
|---|---|---|---|---|
| Easter Camp | [FILL LATER] | £[FILL] | [Spots remaining] | [Book] |
| May Half-Term | [FILL LATER] | £[FILL] | [Spots remaining] | [Book] |
| Summer Week 1 | [FILL LATER] | £[FILL] | [Spots remaining] | [Book] |
| Summer Week 2 | [FILL LATER] | £[FILL] | [Spots remaining] | [Book] |
| October Camp | [FILL LATER] | £[FILL] | [Spots remaining] | [Book] |

**C. Add a "What to bring" side panel (Strip element with bullet list):**
```
What to bring
• Water bottle (lots — they'll need it)
• Packed lunch + snacks
• Shin pads
• Trainers AND astro boots
• Sun cream (summer) / warm layer (winter)
• Named kit bag
```

**D. Add a "3 reasons to book" strip (you have this copy already on the existing page):**
```
INTENSE — Real coaching, not babysitting
FUN — Learning + playing creates the best atmosphere
EXCLUSIVE — Lower numbers = more time on the ball
```

☐

---

### Card 12 — `/about-basic`: Meet the coaches

**WHERE:** Editor → Pages → About

Add a new strip titled **"Meet the coaches"** with a card per coach. Each card needs:
- Photo (round, 200×200)
- Name + role
- 1-line bio
- Qualifications (PVG, FA/SFA badges)

**Template (one per coach):**
```
[Photo]
[COACH NAME — FILL LATER]
[Role — e.g. Founder & Head Coach]
[1-line bio — FILL LATER]
PVG-checked  ·  [Qualifications — FILL LATER]
```

> This is your single biggest trust upgrade. Parents are leaving their kid with strangers — show them the strangers.

☐

---

### Card 13 — Footer & contact strip (every page)

**WHERE:** Editor → click the footer strip at the bottom of any page

**Build a 3-column footer:**

**Column 1 — Contact:**
```
Playit Loveit
Aberdeen
Call or text: 07876 046014
Email: [FILL LATER]
Instagram: @playitloveit1
```

**Column 2 — Pages:**
```
Academy
1-2-1 Coaching
Holiday Camps
FAQs
About
Book a Free Trial
```

**Column 3 — Venues:**
```
Strikers Indoor Football, Aberdeen
Balmoral Stadium, Aberdeen
Fives Football Aberdeen
```

**Bottom strip (small text):**
```
© 2026 Playit Loveit. Coaching in Aberdeen since 2018.
```

☐

---

### Card 14 — Image alt text + renaming (every image)

**WHERE:** Editor → click each image → **Settings** → **What's in the image?**

**Rules:**
- Describe what's happening + venue + age group where possible
- Don't keyword-stuff
- One sentence is plenty

**Examples to follow the pattern:**

| Old filename | New filename | Alt text |
|---|---|---|
| IMG_1162.jpg | `academy-training-strikers-aberdeen.jpg` | `Academy players training at Strikers Indoor Football, Aberdeen` |
| IMG_8090.jpg | `under-9s-drill-strikers.jpg` | `Coach leading dribbling drill with under-9 group at Strikers` |
| IMG_8099.jpg | `under-12s-match-balmoral.jpg` | `Under-12 players in a small-sided game at Balmoral Stadium` |
| IMG_8151.jpg | `1-2-1-coaching-balmoral.jpg` | `Coach delivering a 1-2-1 session at Balmoral Stadium` |
| IMG_0247.jpg | `summer-camp-aberdeen.jpg` | `Players celebrating during summer holiday camp in Aberdeen` |
| IMG_7701.jpg | `goalkeeper-coaching-aberdeen.jpg` | `Young goalkeeper training during academy session` |
| 2.png | `playit-loveit-logo.png` | `Playit Loveit logo` |

**To rename:** Editor → **Media Manager** (left toolbar, image icon) → right-click → **Rename**. Then re-insert on the page.

Do **homepage images first** — that's what Google indexes most.

☐

---

## Sitting 4 — Add the Goalkeeper page (~30 min)

A dedicated page for goalkeeper coaching captures a high-intent niche audience. GK parents search specifically for "goalkeeper coaching aberdeen" and convert well when they find a specialist. Currently you have nothing for them.

### Card 15 — Create the Goalkeeper Coaching page

**WHERE:** Editor → left toolbar → **Pages** icon → **+ Add Page** → choose **Blank Page**

**Page settings:**
- Page name: `Goalkeeper Coaching`
- URL slug: `goalkeeper-coaching`

**SEO settings (Page Settings → SEO Basics):**
- Title: `Goalkeeper Coaching Aberdeen, Ages 6–18 | Playit Loveit`
- Description: `Specialist goalkeeper coaching in Aberdeen with Coach Kyle. 1-2-1 and small-group GK sessions at Fives Football, Tuesdays & Saturdays. Book today.`

#### A. Hero section

```
Goalkeeper Coaching in Aberdeen
Specialist GK sessions with Coach Kyle, for keepers ages 6–18.
At Fives Football, Aberdeen.

[ Book a GK Session ]
```

The button → `https://playitloveit.classforkids.io/term/217`

#### B. "What we cover" section

```
GK-specific coaching, not outfield with gloves on.

· Handling, catching, parries
· Footwork, positioning, angles
· Distribution — throws, kicks, sweeper-keeper play
· Set-piece defending
· Agility, reactions, dives
· Match-day mentality and communication
```

#### C. Sessions & pricing — two cards

**Small-group card:**
```
SMALL-GROUP GK SESSION                              £16 per session
Best for: Building keeper-specific skills with other goalkeepers
Ages 6–18  ·  1 hour  ·  Fives Football, Aberdeen
When: Tuesdays [TIME — FILL] and Saturdays [TIME — FILL]
Pay per session — book the ones you want.

[ Book a GK Session ]
```

**1-2-1 card:**
```
1-2-1 GK COACHING                                   £[FILL — assume £48] per session
Best for: Targeted technical work, position-specific scenarios
Ages 6–18  ·  1 hour  ·  Fives Football, Aberdeen
When: By arrangement around weekly sessions

[ Book a 1-2-1 GK Session ]
```

#### D. Meet Coach Kyle

```
[Photo of Kyle — round, 200×200]

Coach Kyle [SURNAME — FILL]
Goalkeeper Coach
[1-line bio — FILL: e.g. "Former [team] academy keeper" or "FA Goalkeeper Level [X] qualified"]
PVG-checked  ·  [GK qualifications — FILL]
```

This is the highest-trust element on the page. Don't ship without Kyle's photo + credentials.

#### E. GK FAQ

```
What gloves should my child bring?
We can advise — for first sessions, any gloves are fine. Coach Kyle can recommend pairs once he's seen your keeper play.

Are sessions grouped by age or ability?
Mixed ages, drilled and grouped by ability within the session.

Can we do half outfield / half GK in a 1-2-1?
Yes — 1-2-1s are tailored. Mention it when booking.

What if my child is just trying out goalkeeping?
Welcome — small-group sessions are perfect for new keepers.
```

#### F. Sticky CTA at bottom

```
Ready to book?
Tuesdays & Saturdays at Fives Football, Aberdeen — £16/session.

[ Book a GK Session ]
```

☐

---

### Card 16 — Add Goalkeeper to the main navigation

**WHERE:** Editor → click your top menu strip on any page

1. Click the menu element → **Manage Menu**
2. Click **+ Add Menu Item** → **Page Link**
3. Label: `Goalkeeper`
4. Link to: the new `/goalkeeper-coaching` page
5. Drag its position so it sits between **1-2-1** and **Camps**
6. **Publish**

Switch to mobile view and confirm Goalkeeper shows up in the mobile menu too.

☐

---

### Card 17 — Cross-link from /1-2-1 page

**WHERE:** Editor → Pages → 1-2-1

Below the schedule table, add a small text block:

```
Looking for goalkeeper coaching instead? See Goalkeeper Coaching with Coach Kyle →
```

The "Goalkeeper Coaching with Coach Kyle →" should be a hyperlink to `/goalkeeper-coaching`.

☐

---

## Sitting 5 — Page restructure (the big one, ~3 hrs)

This collapses the site from 7 pages to 5 and turns it into a conversion-focused funnel. Bigger lift than the previous sittings — but it's the change that takes the site from "Wix template" to "actually drives bookings."

**Before you start:**
- Do this in one sitting if possible — easier than restarting half-done
- Back up first: Editor → Site → **Site History** → **Save Now** → label it "Before restructure"
- The order below matters — don't skip ahead, you'll break links

### New site structure

```
Home  ·  Weekly Coaching  ·  1-2-1 & GK  ·  Camps  ·  About
```

That's it. 5 pages.

---

### Card 18 — Set up URL redirects FIRST (10 min)

If you delete or rename pages, Google's existing rankings break. Redirects fix that.

**WHERE:** Dashboard → SEO → **URL Redirect Manager** (or **Tools** → **URL Redirects**)

**Add these redirects:**

| Old URL | New URL | Type |
|---|---|---|
| `/academy` | `/weekly-coaching` | 301 |
| `/1-2-1` | `/1-2-1-and-gk` | 301 |
| `/goalkeeper-coaching` | `/1-2-1-and-gk` | 301 |
| `/general-4` | `/about` | 301 |
| `/about-basic` | `/about` | 301 |
| `/book-online-1` | `/` | 301 |
| `/playitloveitreact` | `/` | 301 |

For each: click **+ New Redirect** → paste old path → paste new path → set type to **301 (Permanent)** → Save.

☐

---

### Card 19 — Merge /1-2-1 + /goalkeeper-coaching → /1-2-1-and-gk (45 min)

**WHERE:** Editor → Pages → **+ Add Page** → Blank Page

**Page settings:**
- Page name: `1-2-1 & Goalkeeper Coaching`
- URL slug: `1-2-1-and-gk`
- SEO Title: `1-2-1 & Goalkeeper Coaching Aberdeen | Playit Loveit`
- SEO Description: `Private 1-hour football coaching from £48 and specialist GK sessions with Coach Kyle from £16. Strikers Indoor, Balmoral & Fives, Aberdeen.`

**Page structure — two sections, divider between them:**

#### Section 1: 1-2-1 Coaching

```
1-2-1 Football Coaching
£48 / 1 hour / Ages 6–18
Strikers Indoor Football & Balmoral Stadium, Aberdeen
```

Then the 9-row schedule table (from Card 9 in Sitting 2). Each row has a `[ Book ]` button → ClassForKids term URL.

Below the table:
```
Don't see a slot that works? Text 07876 046014 and we'll find one.
```

#### Section 2: Goalkeeper Coaching

```
Goalkeeper Coaching with Coach Kyle
Specialist GK sessions for keepers ages 6–18 at Fives Football, Aberdeen.
```

Then the two GK cards from Card 15 (Small-group £16 / 1-2-1 £48), Coach Kyle bio, GK FAQ.

**Once built:** delete the old `/1-2-1` and `/goalkeeper-coaching` pages (after confirming the redirects from Card 18 are live).

☐

---

### Card 20 — Merge /about-basic + /general-4 → /about (30 min)

**WHERE:** Editor → Pages → **+ Add Page** → Blank Page

**Page settings:**
- Page name: `About`
- URL slug: `about`
- SEO Title: `About Playit Loveit | Aberdeen Football Coaching Since 2018`
- SEO Description: `Aberdeen football coaching since 2018. Meet our coaches, see our credentials, and find answers to common parent questions.`

**Page sections (in order):**

1. **Our story** — pull from current /about-basic. Tighten to 2 paragraphs.
2. **Meet the coaches** — Card 12 template, one card per coach with photo + name + bio + qualifications
3. **Trust badges row** — PVG-checked · SFA/FA-qualified · Coaching since 2018 · 500+ players developed
4. **FAQs** — pull from current /general-4. Use Wix's collapsible FAQ element so it's compact:
   - Trial decision window (36 hours)
   - Refund policy
   - Monthly cancellation (30 days notice)
   - What to bring
   - Payment method (recurring card on the 1st)
5. **Contact strip** — phone, email, Instagram, venues

**Once built:** delete old `/about-basic` and `/general-4`.

☐

---

### Card 21 — Rebuild /academy as /weekly-coaching (45 min)

**WHERE:** Editor → Pages → Academy page → **Page Settings** → URL slug → change to `weekly-coaching`

Also update:
- Page name: `Weekly Coaching`
- SEO Title: `Weekly Football Coaching Aberdeen, Ages 3–18 | Playit Loveit`
- SEO Description: `Weekly football academy at Strikers Indoor & Balmoral, Aberdeen. Intensity, Academy, Accelerator & Soccer Tots — from £42/month. Book a free trial.`

**Page heading:**
```
Weekly Football Coaching
4 programmes · Ages 3–18 · From £42/month
```

**Card order (rebuild from Card 8 in Sitting 2):**

1. **★ INTENSITY** — Most Popular — first
2. **ACADEMY**
3. **ACCELERATOR**
4. **SOCCER TOTS**

Visual grouping:
- Heading "**Most Popular**" above Intensity card
- Heading "**Weekly Programmes**" above the other 3
- Reassurance line under all 4: *"Try risk-free — 36 hours after trial to decide. Cancel any monthly membership with 30 days' notice."*

Cross-link below cards:
```
Looking for 1-2-1 or goalkeeper coaching instead? See 1-2-1 & Goalkeeper Coaching →
```

☐

---

### Card 22 — Rebuild navigation menu (10 min)

**WHERE:** Editor → click your top menu strip → **Manage Menu**

Delete all existing items and rebuild this exact list, in this order:

1. `Home` → `/`
2. `Weekly Coaching` → `/weekly-coaching`
3. `1-2-1 & GK` → `/1-2-1-and-gk`
4. `Camps` → `/soccer-camps`
5. `About` → `/about`

Then add a separate **Button** element to the right of the menu (not inside it):
- Label: `Book a Free Trial` (orange, bold)
- Pinned to screen top-right (sticky on scroll)
- Link: scrolls to a trial form OR opens a `/book-trial` simple form page

Switch to mobile view → make sure the menu collapses cleanly into a hamburger and the Book button stays visible at the top.

☐

---

### Card 23 — Sticky "Book a Free Trial" CTA across the site (15 min)

The single biggest conversion lift. Same button, same colour, on every page, in 3 places:

1. **Header** (Card 22 already covers this)
2. **Bottom of every page section** — add a Strip element above the footer:
   ```
   Ready to play?
   First trial is free. No commitment.

   [ Book Your Free Trial ]
   ```
3. **Floating button on mobile** — Wix Editor → Mobile view → **+ Add Element** → **Button** → pin to bottom of screen → set to **show on mobile only**

All buttons link to the same place — either a Wix Form on `/book-trial` or your ClassForKids URL.

☐

---

### Card 24 — Visual polish (30 min)

Three changes that make the site look "boom":

**A. ONE accent colour for CTAs**

Pick one bold colour (recommended: warm orange `#FF6B1A`). Edit every button across the site to use this colour with white text. NO other element on the site should be this colour. Result: parents' eyes go straight to "Book" buttons.

**WHERE:** Editor → click any button → **Design** → set fill colour, text colour. Save as a "Theme" if Wix offers it (re-use everywhere).

**B. Replace stock images with real photos**

Every page hero should be a full-bleed action shot of YOUR players training. Phone-camera shots are fine if they're sharp. Avoid generic football stock photos.

**WHERE:** Editor → click image → **Change Image** → upload from your phone gallery.

**C. Add breathing room between sections**

Most amateur sites cram everything. Add a Strip with 60-100px of vertical padding between every section (hero → trust strip → cards → reviews → footer). Whitespace = professional.

**WHERE:** Editor → click between sections → **+ Add Strip** → Blank → set height.

☐

---

### Card 25 — Final verification (10 min)

Before declaring done, click through the live site (in a private/incognito tab):

- [ ] Click `Weekly Coaching` from menu — opens new page with 4 programmes in correct order
- [ ] Click `1-2-1 & GK` — both sections show, schedule table renders
- [ ] Click `About` — coaches + FAQs + contact all on one scroll
- [ ] Click any old URL like `playitloveit.com/academy` — should redirect to `/weekly-coaching` (Card 18)
- [ ] On mobile: header has Book button, menu opens cleanly, all programmes are tappable
- [ ] Every page has a `Book a Free Trial` button visible without scrolling
- [ ] Test booking flow: click Book → does it land on the right ClassForKids page?

☐

---

### Hate editing websites? Three escape routes

**Option 1 — Hire a Wix freelancer** (~£60-150 one-off)
Post on Fiverr or Upwork: "I have a complete change spec. Need someone with Wix experience to execute it. ~3 hours work." Send them this whole change pack. They handle every click. You review the live site at the end.

**Option 2 — Do it in chunks**
Sitting 1 (SEO) → wait a week → Sitting 4 (GK page) → wait a week → Sitting 5 (restructure). Spreads the editing pain over a month.

**Option 3 — Skip Wix entirely** (the bigger play)
Rebuild the marketing site as Next.js pages alongside your Playerportal codebase. I edit it directly — you stop touching website editors forever. ~1-2 weeks of focused work. Long-term win, short-term effort.

You picked Wix for now, so Option 1 is probably the smartest move. £100 to never click in Wix again.

---

## What's still missing — fill these in later

Once you have these, the `[FILL LATER]` markers in this doc get replaced and we're done:

1. **Email address** (for contact + JSON-LD)
2. **Postcode** for Strikers Indoor (and Balmoral if different)
3. **Coach names + photos + 1-line bios** (Card 12)
4. **Term schedule** — days & times for Soccer Tots, Academy, Accelerator (Card 8)
5. **Camp dates 2026** + prices + venue (Card 11)
6. **Intensity venue + day/time** (Card 8)
7. **PVG / SFA / FA badge confirmation** (Cards 2, 7, 12)
8. **One parent quote + name** (Card 7)
9. **Other social URLs** (Facebook, TikTok if any)
10. **Coach Kyle's surname + photo + GK credentials** (Card 15)
11. **Tuesday & Saturday GK session times** (Card 15)
12. **1-2-1 GK price** — assumed £48 (Card 15)

---

## Verification checklist (after publishing)

- [ ] Open `playitloveit.com` in a private/incognito tab — does the new hero load?
- [ ] On mobile, is the orange "Book a Free Trial" button visible without scrolling?
- [ ] Click each tier card on `/academy` — do the buttons go to the right places?
- [ ] On `/1-2-1`, can you book a slot in 2 clicks?
- [ ] Right-click homepage → View Source → search for `application/ld+json` — schema should be there.
- [ ] Paste the homepage URL into [Google's Rich Results Test](https://search.google.com/test/rich-results) — should detect SportsActivityLocation.
- [ ] Paste into [Facebook's Sharing Debugger](https://developers.facebook.com/tools/debug/) — should show a proper preview.
- [ ] Open `playitloveit.com/sitemap.xml` — confirm `playitloveitreact` is gone.

---

## When you're stuck

Common Wix gotchas:
- **"I changed it but the live site still shows the old version"** → you forgot to click **Publish** (top-right).
- **"Mobile view broke after I edited desktop"** → Wix has separate mobile layouts. Always switch to phone icon and re-check.
- **"I can't find Custom Code"** → needs a paid Wix plan (Combo or above). Workaround: paste the JSON-LD inside an HTML iframe element on each page header — uglier but works.
- **"The 'book here' button on ClassForKids opens in a new tab — is that OK?"** → Yes, keep it that way. Parents like keeping your tab open to come back to.

Ping me when you've done Sitting 1 and I'll spot-check the live site.
