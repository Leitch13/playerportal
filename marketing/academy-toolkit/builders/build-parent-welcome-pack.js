/** Parent Welcome Pack — editable template. Build: node build-parent-welcome-pack.js */
const H = require('./_helpers');
const { body, lead, h2, h3, bullet, check, guidance, sectionDivider, callout,
        dataTable, coverSection, pageBreak, build, pr, font, theme, photo, photoRow, swatchTable, num, h2Page,
        Paragraph, TextRun, Footer, AlignmentType } = H;

const S = (n, t) => [pageBreak(), ...sectionDivider(n, t)];

const cover = coverSection([
  { image: 'logo', width: 250, after: 620 },
  { text: 'WELCOME TO', size: 24, color: theme.accent, bold: true, tracking: 120, after: 200 },
  { text: '[ACADEMY NAME]', size: 68, bold: true, line: 320, after: 260 },
  { text: 'The Parent Welcome Pack', size: 34, color: 'D8DDE8', after: 320 },
  { text: 'Everything you need to know about your child’s time with us — how sessions run, how we coach, how we’ll keep you in the loop, and what to do if you ever need us.',
    size: 22, color: 'A9B2C4', line: 320, after: 560 },
  { image: 'cover-banner', after: 460 },
  { text: '[SEASON / BLOCK]  ·  [YEAR]', size: 20, color: '8A93A8', tracking: 40 },
]);

const children = [];
const P = (...x) => children.push(...x.flat());

/* ------------------------------------------------ how to make this yours */
P(sectionDivider('■', 'Make This Pack Your Own'));
P(callout('This section is for you, the academy owner — not for parents. Work through all four steps, then DELETE THE WHOLE SECTION before you send the pack out.'));

/* ---- 1. words ---- */
P(h2('1. Your details — fill in once, then Find & Replace'));
P(body('Every [PLACEHOLDER] needs replacing — highlighted yellow inside the writing, blue inside the tables. The ones below repeat throughout, so write your answer in the right-hand column and use Find & Replace (Ctrl+H on Windows, Cmd+Shift+H on Mac) to change them all at once. Do [ACADEMY NAME] first.'));
P(dataTable(['Find this', 'What it is', 'Replace with your answer'], [
    ['[ACADEMY NAME]', 'Your academy, exactly as parents see it', ''],
    ['[YOUR NAME]', 'Whoever signs the welcome letter', ''],
    ['[YOUR ROLE]', 'e.g. Founder & Head Coach', ''],
    ['[PHONE]', 'The number parents should actually use', ''],
    ['[EMAIL]', 'Your main contact address', ''],
    ['[CHANNEL]', 'Where you communicate — WhatsApp, app, email', ''],
    ['[VENUE]', 'Your main training venue', ''],
    ['[SAFEGUARDING LEAD]', 'The named person, not a job title', ''],
    ['[GOVERNING BODY]', 'Scottish FA, The FA, FAW, IFA', ''],
    ['[PVG / DBS / AccessNI]', 'The background check for your nation', ''],
    ['[SEASON / BLOCK]', 'e.g. Autumn Block', ''],
    ['[YEAR]', 'e.g. 2026', ''],
  ], [0.26, 0.38, 0.36]));

/* ---- 2. brand ---- */
P(pageBreak());
P(h2('2. Your brand — logo, colours, fonts'));
P(body('This pack is built in navy and gold as a starting point. Ten minutes here is what turns a template into something that looks like it was made for your academy.'));
P(h3('Your logo'));
P(body('Right-click the logo box on the cover, choose Change Picture, and point it at your logo file. A PNG with a transparent background works best on the dark cover — if yours only exists on a white square, use the light version of your logo instead.'));
P(photo('logo', { width: 260, before: 140, after: 220 }));
P(h3('Your colours'));
P(body('Write your two hex codes in the right-hand column. Then select any heading, change the font colour to your dark colour, and use Format Painter (the paintbrush) to carry it through the rest of the document. Do the same for the section numbers with your accent colour.'));
P(swatchTable([
  { hex: '18233B', role: 'Dark — headings, cover, table headers', replace: '[YOUR DARK HEX]' },
  { hex: 'B8862B', role: 'Accent — section numbers, rules, captions', replace: '[YOUR ACCENT HEX]' },
  { hex: 'F6F3EC', role: 'Tint — table stripes, callout blocks', replace: '[YOUR TINT HEX]' },
]));
P(guidance('Two colours. Not five. If your logo has four colours, pick the darkest for headings and the brightest for accents, and leave the rest out of the document.'));
P(h3('Your font'));
P(body('The pack is set in Calibri, which everyone has. If your brand uses something else, select all (Ctrl+A / Cmd+A) and change the font once — but only if the font is installed on the machine of whoever opens it. If in doubt, stay with Calibri. A pack that opens correctly beats a pack that opens in the wrong typeface.'));
P(dataTable(['', 'Currently', 'Yours'], [
  ['Headings', 'Calibri Bold', '[YOUR HEADING FONT]'],
  ['Body text', 'Calibri', '[YOUR BODY FONT]'],
], [0.22, 0.34, 0.44]));

/* ---- 3. photos ---- */
P(pageBreak());
P(h2('3. Your photos — the shot list'));
P(body('Every photo box in this pack is a real picture you swap out: right-click it, choose Change Picture, pick your file. It drops into the same frame at the same size, so nothing moves.'));
P(body('These are the shots you need. Get them in one session with a phone — you do not need a photographer.'));
P(dataTable(['Where it appears', 'What to shoot', 'What makes it work'], [
  ['Cover', 'A wide shot of a busy session', 'Shoot from behind or side-on, low down. Leave space at the top — it sits under your title.'],
  ['02 · What we’re here to do', 'Players mid-game, ball in play', 'The moment before a decision, not a celebration.'],
  ['03 · Who’s coaching', 'A headshot of each coach', 'Outdoors, in academy kit, against a plain background. Same spot for all of them.'],
  ['04 · The practical stuff', 'Your venue — the entrance parents use', 'Shot from where they’d park. This is the photo that stops the first-night phone call.'],
  ['08 · Your first session', 'A coach greeting a new player', 'Eye level with the child. This is the one that sells the pack.'],
  ['09 · Quick answers', 'Everyone together, end of a session', 'Wide, loose, slightly messy. Warmth beats formality here.'],
], [0.26, 0.34, 0.40]));
P(h3('Four rules for the photos'));
P(num(1, 'Real sessions, not posed line-ups. A picture of your players actually playing is worth more than a tidy team photo.'));
P(num(2, 'Faces you can see, in focus, in daylight where possible. Floodlit shots almost never survive being printed.'));
P(num(3, 'Landscape, not portrait. Every frame in this pack is a landscape shape — a portrait photo will be cropped hard.'));
P(num(4, 'Check consent before a child appears anywhere. Use only players whose parents have agreed to photography, and keep a record of who those are.'));
P(guidance('No usable photos yet? Delete the photo boxes rather than leaving the camera icons in. An empty grey box says “unfinished”; no box at all just reads as a clean document.'));

/* ---- 4. checklist ---- */
P(pageBreak());
P(h2('4. Then work through this checklist'));
P(check('Rewrite the welcome letter in your own voice. Parents can smell a template. Two honest paragraphs beat two polished pages.'));
P(check('Check the money section against what your booking system actually does. Nothing destroys trust faster than a written policy your billing contradicts.'));
P(check('Delete any section that doesn’t apply to you rather than leaving it vague. A half-answered policy is worse than no policy.'));
P(check('Replace the remaining inline placeholders — the ones specific to a single table or line.'));
P(check('Swap every photo box for your own picture — or delete the ones you can’t fill yet.'));
P(check('Add your logo to the cover.'));
P(check('Delete this whole “Make This Pack Your Own” section.'));
P(check('Export to PDF before sending, so nobody can edit it back at you.'));
P(check('Send it the moment someone books — not before the first session. The gap between paying and starting is where doubt lives.'));
P(guidance('A note on tone: everything written in grey with a gold bar down the left — like this — is an instruction to you. Delete it once you’ve acted on it. Yellow chips are words to swap.'));

/* ------------------------------------------------ 01 welcome */
P(S('01', 'Welcome'));
P(lead('Hi [PARENT FIRST NAME],'));
P(body('Thanks for trusting us with [CHILD FIRST NAME]. We know there are other places you could have chosen, and we don’t take that lightly.'));
P(guidance('WRITE 2–3 SENTENCES: why you started the academy, and what you actually care about. Keep it human. Example: “I started [ACADEMY NAME] in [YEAR] because I’d spent years watching kids get shouted at from the sideline and slowly fall out of love with the game. We do it differently — our sessions are busy, they’re demanding, and they’re fun.”'));
P(body('This pack covers everything you need for the next few months — the practical bits, how we coach, and how we’ll keep you updated. Have a read, and keep it somewhere you can find it.'));
P(body('If anything at all is unclear, message me directly. I’d far rather answer a question than have you wondering.'));
P(new Paragraph({ children: pr('[YOUR NAME]', font(24, { bold: true, color: theme.ink }), 'quiet'), spacing: { before: 320, after: 60 } }));
P(new Paragraph({ children: pr('[YOUR ROLE] · [ACADEMY NAME]', font(21, { color: theme.grey }), 'quiet'), spacing: { after: 40 } }));
P(new Paragraph({ children: pr('[PHONE] · [EMAIL]', font(21, { color: theme.grey }), 'quiet') }));

/* ------------------------------------------------ 02 */
P(S('02', 'What We’re Here To Do'));
P(lead('Our job is to make your child a better footballer and a more confident person. Those two things aren’t in competition — in our experience one drives the other.'));
P(h2('What we believe'));
P(bullet('[BELIEF 1 — e.g. Every player touches the ball hundreds of times per session. We don’t run queues.]'));
P(bullet('[BELIEF 2 — e.g. Mistakes are the point. A player who never loses the ball isn’t being stretched.]'));
P(bullet('[BELIEF 3 — e.g. We coach the player in front of us, not the player we wish they were.]'));
P(bullet('[BELIEF 4 — e.g. Enjoyment is not the opposite of standards. It’s what makes standards sustainable.]'));
P(guidance('These should match the Ten Non-Negotiables in your Academy Bible. If a parent and a coach read your two documents, they should recognise the same academy.'));
P(h2('What we’re working on this block'));
P(body('Each block has a clear theme so you can see the thread running through the sessions rather than a random collection of drills.'));
P(dataTable(['Block', 'Theme', 'What you’ll see at home'], [
  ['[WEEKS 1–4]', '[e.g. Receiving under pressure]', '[e.g. Checking away before the ball arrives]'],
  ['[WEEKS 5–8]', '[e.g. 1v1 attacking]', '[e.g. More willingness to take players on]'],
  ['[WEEKS 9–12]', '[e.g. Decision-making in small games]', '[e.g. Quicker choices, head up more often]'],
], [0.22, 0.34, 0.44]));
P(body('We’ll tell you when the theme changes and what to look for.'));
P(photo('session'));

/* ------------------------------------------------ 03 */
P(S('03', 'Who’s Coaching Your Child'));
P(lead('You should know exactly who is standing in front of your child every week, and what qualifies them to be there.'));
P(dataTable(['Coach', 'Group / age', 'Qualifications', 'A bit about them'], [
  ['[COACH NAME]', '[GROUP / AGE]', '[e.g. UEFA C, FA Youth Award, Emergency First Aid, Safeguarding Level 2]', '[One or two lines — playing background, how long they’ve been with you, what they’re known for]'],
  ['[COACH NAME]', '[GROUP / AGE]', '[QUALIFICATIONS]', '[SHORT BIO]'],
  ['[COACH NAME]', '[GROUP / AGE]', '[QUALIFICATIONS]', '[SHORT BIO]'],
], [0.18, 0.16, 0.30, 0.36]));
P(photoRow(['headshot','headshot','headshot'], ['[COACH NAME]','[COACH NAME]','[COACH NAME]']));
P(h2Page('Safeguarding'));
P(body('Your child’s safety comes before everything else on this page.'));
P(bullet('Every coach holds a current [PVG / DBS / AccessNI] check, verified before they work with players.'));
P(bullet('Every coach holds a current safeguarding certificate and first aid qualification.'));
P(bullet('Our designated safeguarding lead is [SAFEGUARDING LEAD], contactable on [PHONE] and [EMAIL].'));
P(bullet('We work to [GOVERNING BODY] safeguarding standards. Our full policy is available on request and at [LINK].'));
P(bullet('Coaches do not contact players directly. All communication comes through you.'));
P(guidance('Align this wording to your governing body’s current requirements. This template is a starting point, not legal advice.'));
P(h2('Insurance'));
P(body('[ACADEMY NAME] holds public liability insurance to the value of [£AMOUNT] through [PROVIDER]. A certificate is available on request.'));

/* ------------------------------------------------ 04 */
P(S('04', 'The Practical Stuff'));
P(h2('Where and when'));
P(dataTable(['Group', 'Day & time', 'Venue', 'Arrive by'], [
  ['[AGE GROUP]', '[DAY, TIME–TIME]', '[VENUE]', '[TIME]'],
  ['[AGE GROUP]', '[DAY, TIME–TIME]', '[VENUE]', '[TIME]'],
  ['[AGE GROUP]', '[DAY, TIME–TIME]', '[VENUE]', '[TIME]'],
], [0.26, 0.30, 0.28, 0.16]));
P(body('Full address: [VENUE ADDRESS AND POSTCODE]. Parking: [WHERE TO PARK, ANY RESTRICTIONS]. Entrance: [WHICH DOOR / GATE].'));
P(photo('venue'));
P(guidance('If your schedule changes often, consider replacing this table with a line pointing parents at their online account — a printed timetable goes stale, a login never does.'));
P(h2('What to bring'));
P(bullet('[Boots — specify surface: moulded / astro / blades not permitted]'));
P(bullet('Shin pads — [required / recommended]'));
P(bullet('Water bottle, named'));
P(bullet('[Weather layers — sessions run outdoors in most conditions]'));
P(bullet('[Academy kit if applicable — how to order, cost, lead time]'));
P(h2Page('Drop-off and collection'));
P(guidance('State your policy clearly. Example: Please hand your child over to a coach at the gate rather than leaving them at the car park. Sessions finish at [TIME] and we ask that children are collected promptly — coaches stay with any uncollected player, but we can’t supervise beyond [TIME]. If someone different is collecting, message us in advance.'));
P(h2('Can I stay and watch?'));
P(guidance('Your policy. Example: Yes, always. We ask that you watch from [DESIGNATED AREA] rather than the pitch edge, and leave the coaching to the coaches — a player getting instructions from two directions can’t focus on either.'));
P(h2('Weather and cancellations'));
P(bullet('We train in most weather. We’ll only cancel for genuine safety reasons — lightning, ice, high winds, or a venue closure outside our control.'));
P(bullet('If a session is cancelled, you’ll hear from us by [CHANNEL] no later than [TIME BEFORE SESSION].'));
P(bullet('Cancelled sessions are [rescheduled / credited / added to the end of the block].'));
P(bullet('If you’re unsure, assume the session is on unless you’ve heard from us.'));

/* ------------------------------------------------ 05 */
P(S('05', 'Fees, Payments & Cancellations'));
P(lead('We’d rather be completely clear about money up front than have an awkward conversation later.'));
P(h2('What it costs'));
P(dataTable(['Option', 'Price', 'What’s included'], [
  ['[e.g. Weekly session — monthly membership]', '[£XX per month]', '[e.g. 1 session per week, all coaching, end-of-block report]'],
  ['[e.g. Twice weekly]', '[£XX per month]', '[WHAT’S INCLUDED]'],
  ['[e.g. Sibling rate]', '[£XX]', '[TERMS]'],
], [0.38, 0.22, 0.40]));
P(h2('How billing works'));
P(bullet('Payments are taken by [Direct Debit / card] on [DATE] each month via [PROVIDER / PLATFORM].'));
P(bullet('Your first payment covers [WHAT PERIOD].'));
P(bullet('[State whether the monthly fee is an average across the year or varies by number of sessions in the month.]'));
P(bullet('You’ll get a receipt automatically to [EMAIL ON FILE].'));
P(guidance('That third point is the commonest source of parent confusion. Answer it here and you never have the conversation again.'));
P(h2Page('Missed sessions'));
P(guidance('Be specific. Example: We don’t refund individual missed sessions — pitch, coaches and insurance are committed whether your child attends or not. If they’re out through injury or illness for more than [X] weeks, contact us and we’ll sort something fair.'));
P(h2('Holidays and breaks'));
P(guidance('State which weeks you don’t run and whether they’re charged. Example: We don’t run over [DATES]. Those weeks are already accounted for in the monthly fee.'));
P(h2('Stopping'));
P(bullet('You can cancel at any time by [METHOD] with [X days/weeks] notice before your next payment date.'));
P(bullet('There’s no cancellation fee and no minimum term beyond that notice period.'));
P(bullet('[Refund position on part-used blocks.]'));
P(body('If you’re thinking about stopping, we’d genuinely appreciate a conversation first — sometimes it’s something we can fix, and if it isn’t, knowing why helps us get better.'));

/* ------------------------------------------------ 06 */
P(S('06', 'How We’ll Keep You Updated'));
P(lead('You shouldn’t have to chase us to find out how your child is getting on. Here’s exactly what you’ll receive and when.'));
P(dataTable(['What', 'When', 'Where'], [
  ['Session reminder & any changes', 'Weekly, [DAY]', '[CHANNEL]'],
  ['Coach note on your child', '[e.g. Fortnightly]', '[CHANNEL]'],
  ['Academy update — what we’re working on', 'Monthly', '[CHANNEL]'],
  ['Written progress report', 'End of each block', '[CHANNEL]'],
  ['Parent feedback survey', '[e.g. Twice a year]', '[CHANNEL]'],
  ['Anything urgent', 'As it happens', '[PHONE / CHANNEL]'],
], [0.44, 0.26, 0.30]));
P(h2('Getting hold of us'));
P(bullet('Day-to-day questions: [CHANNEL]. We reply within [X working hours].'));
P(bullet('Anything about your child specifically: [CHANNEL / PERSON].'));
P(bullet('Billing and admin: [EMAIL].'));
P(bullet('Urgent, same-day: [PHONE].'));
P(body('Please don’t try to have a detailed conversation with a coach mid-session — they’re responsible for a group of children at that moment. Catch them at the end or message us and we’ll set up a proper call.'));
P(h2('If something isn’t right'));
P(body('Tell us. Early and directly.'));
P(bullet('Message [YOUR NAME] on [CHANNEL] or [EMAIL].'));
P(bullet('We’ll acknowledge within [X working hours] — even if we don’t have an answer yet.'));
P(bullet('We’ll come back to you with a resolution or a plan within [X working days].'));
P(bullet('If you’re still not happy, it escalates to [NAME / ROLE] at [CONTACT].'));
P(bullet('Concerns about a child’s welfare go straight to our safeguarding lead, [SAFEGUARDING LEAD], on [CONTACT] — at any time.'));

/* ------------------------------------------------ 07 */
P(S('07', 'What We Ask Of You'));
P(lead('Almost every parent gets this right without being asked. We write it down anyway, because the few times it goes wrong it really matters to the children involved.'));
P(h2('On the sideline'));
P(bullet('Encourage, don’t instruct. Two voices telling a child what to do is one voice too many.'));
P(bullet('Applaud effort and bravery, not just goals. The player who tries the difficult pass and loses it is the one who improves.'));
P(bullet('Never criticise a child — yours or anyone else’s — or a coach in front of the players.'));
P(bullet('Leave officials alone. Always.'));
P(h2('In the car home'));
P(callout('This is the conversation that shapes how your child feels about football, more than anything we do in ninety minutes. “Did you enjoy that?” beats “Did you win?” every time.'));
P(h2('Housekeeping'));
P(bullet('Let us know in advance if your child will miss a session — it helps us plan numbers.'));
P(bullet('Keep us updated on medical conditions, injuries, or anything going on at home that might affect them. It stays confidential and it helps us coach them properly.'));
P(bullet('Keep your contact details and emergency contact current.'));
P(bullet('Arrive on time. A late arrival misses the warm-up, which is where the session is set up.'));
P(h2('Photos and video'));
P(guidance('State your policy. Example: We take photos and video for coaching and for our social channels. You told us your preference when you registered, and you can change it at any time by messaging [CONTACT]. We ask parents not to photograph or film other people’s children without asking them first.'));

/* ------------------------------------------------ 08 */
P(S('08', 'Your First Session'));
P(lead('A quick checklist so the first week is smooth.'));
P(check('Registration form completed, including medical info and emergency contact'));
P(check('Payment set up'));
P(check('You’ve joined [CHANNEL] — link: [LINK]'));
P(check('Photo and video preference confirmed'));
P(check('Boots, shin pads, named water bottle'));
P(check('You know the venue, the entrance and where to park'));
P(check('Your child knows their coach’s name: [COACH NAME]'));
P(photo('welcome'));
P(h2('What happens on the night'));
P(bullet('Arrive [X] minutes early. Come to [MEETING POINT] and ask for [YOUR NAME].'));
P(bullet('We’ll introduce your child to their coach and a couple of the group.'));
P(bullet('Session runs [TIME] to [TIME].'));
P(bullet('The coach will find you at the end for a quick word about how they got on.'));
P(callout('First sessions can be daunting. If your child is nervous, tell us beforehand — we’ll pair them up with someone and keep an eye on them.'));

/* ------------------------------------------------ 09 */
P(S('09', 'Quick Answers'));
P(dataTable(['Question', 'Answer'], [
  ['What if we can’t make a session?', '[YOUR ANSWER]'],
  ['Can my child try before committing?', '[YOUR ANSWER]'],
  ['Do you run in the school holidays?', '[YOUR ANSWER]'],
  ['Is there a waiting list for other groups?', '[YOUR ANSWER]'],
  ['My child plays for a Saturday team — is that a problem?', '[YOUR ANSWER]'],
  ['Do you do birthday parties / camps / 1-to-1s?', '[YOUR ANSWER]'],
  ['[ADD YOUR OWN — the question you get asked every single week]', '[YOUR ANSWER]'],
], [0.46, 0.54]));
P(photo('group'));
P(new Paragraph({
  children: pr('Any question this pack doesn’t answer — message [YOUR NAME] on [PHONE] or [EMAIL]. We’re glad you’re here.',
    font(22, { italics: true, color: theme.ink })),
  spacing: { before: 400 },
  border: { top: { style: H.BorderStyle.SINGLE, size: 6, color: theme.accent, space: 14 } },
}));

const footer = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: pr('[ACADEMY NAME]  ·  Parent Welcome Pack', font(16, { color: '9AA1AE' }), 'none'),
})] });

build(process.argv[2] || `${process.env.HOME}/Downloads/Parent-Welcome-Pack-TEMPLATE.docx`,
      { cover, children, footer });
