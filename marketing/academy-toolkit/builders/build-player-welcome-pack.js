/** Player Welcome Pack — editable template, written TO the player. */
const H = require('./_helpers');
const { body, lead, h2, h3, bullet, check, guidance, sectionDivider, callout,
        dataTable, coverSection, pageBreak, build, pr, font, theme, fieldLine, photo, photoRow, swatchTable, num,
        Paragraph, TextRun, Footer, AlignmentType } = H;

const S = (n, t) => [pageBreak(), ...sectionDivider(n, t)];

const cover = coverSection([
  { image: 'logo', width: 250, after: 620 },
  { text: 'WELCOME TO', size: 24, color: theme.accent, bold: true, tracking: 120, after: 200 },
  { text: '[ACADEMY NAME]', size: 68, bold: true, line: 320, after: 260 },
  { text: 'The Player Welcome Pack', size: 34, color: 'D8DDE8', after: 320 },
  { text: 'This one is for you — not your mum and dad. It tells you what we’re about, what you can expect from us, and what we’ll expect from you.',
    size: 22, color: 'A9B2C4', line: 320, after: 560 },
  { image: 'cover-banner', after: 460 },
  { text: 'THIS PACK BELONGS TO', size: 18, color: theme.accent, tracking: 80, after: 140 },
  { text: '[PLAYER NAME]  ·  [AGE GROUP]  ·  [SEASON / BLOCK] [YEAR]', size: 22, color: 'D8DDE8' },
]);

const children = [];
const P = (...x) => children.push(...x.flat());

/* ------------------------------------------------ owner instructions */
P(sectionDivider('■', 'Make This Pack Your Own'));
P(callout('This section is for you, the academy owner — not for the player. Work through all four steps, then DELETE THE WHOLE SECTION before you send the pack out.'));

/* ---- 1. words ---- */
P(h2('1. Your details — fill in once, then Find & Replace'));
P(body('Every [PLACEHOLDER] needs replacing — highlighted yellow inside the writing, blue inside the tables. The ones below repeat throughout, so write your answer in the right-hand column and use Find & Replace (Ctrl+H on Windows, Cmd+Shift+H on Mac) to change them all at once. Do [ACADEMY NAME] first.'));
P(dataTable(['Find this', 'What it is', 'Replace with your answer'], [
  ['[ACADEMY NAME]', 'Your academy, as the players say it', ''],
  ['[YOUR NAME]', 'Whoever signs the letter — usually you', ''],
  ['[COACH NAME]', 'Their coach, if you personalise per group', ''],
  ['[SAFEGUARDING LEAD]', 'The named person a child can go to', ''],
  ['[PLAYER NAME]', 'Leave blank to hand-write, or mail-merge it', ''],
  ['[AGE GROUP]', 'e.g. U10s', ''],
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
  ['Cover', 'A wide shot of a busy session', 'Players their age, doing something they recognise. Leave space at the top.'],
  ['02 · What we’re about', 'A coach talking to a small group', 'Crouched, at their eye level. This is what your coaching looks like.'],
  ['05 · Being a good teammate', 'Your players together, enjoying it', 'Arms round each other, laughing. Not a posed line.'],
  ['07 · Your first session', 'A new player being welcomed in', 'The handshake or the walk-on. It tells a nervous child what to expect.'],
  ['09 · Your pledge', 'Everyone together, end of a session', 'The one they want to be in. That’s the point of the page.'],
], [0.26, 0.34, 0.40]));
P(h3('Four rules for the photos'));
P(num(1, 'Real sessions, not posed line-ups. A picture of your players actually playing is worth more than a tidy team photo.'));
P(num(2, 'Faces you can see, in focus, in daylight where possible. Floodlit shots almost never survive being printed.'));
P(num(3, 'Landscape, not portrait. Every frame in this pack is a landscape shape — a portrait photo will be cropped hard.'));
P(num(4, 'Check consent before a child appears anywhere. Use only players whose parents have agreed to photography, and keep a record of who those are.'));
P(guidance('No usable photos yet? Delete the photo boxes rather than leaving the camera icons in. An empty grey box says “unfinished”; no box at all just reads as a clean document.'));

/* ---- 4. checklist ---- */
P(pageBreak());
P(h2('4. Set the reading age'));
P(body('This is written for roughly 8–14 year olds. Two adjustments worth making:'));
P(bullet('Under 8s — cut sections 05 and 06 entirely, shorten the pledge to three lines, and read it to them rather than handing it over.'));
P(bullet('15+ — keep everything, but sharpen section 04. Older players respond to being treated like adults, not to being softened at.'));
P(h2('5. Then work through this checklist'));
P(check('Make section 02 match the Ten Non-Negotiables in your Academy Bible. A player and a coach should be reading the same academy.'));
P(check('Rewrite the letter in section 01 in your own voice. Players know when an adult is performing at them.'));
P(check('Fill in the home challenges in section 06 — or delete the table if you won’t keep it updated. An empty promise is worse than no promise.'));
P(check('Decide how you deliver the pledge in section 09. Signed at the first session, in front of the group, is far stronger than signed at home.'));
P(check('Swap every photo box for your own picture — or delete the ones you can’t fill yet.'));
P(check('Add your logo to the cover, delete this section, then export to PDF.'));
P(guidance('Anything in grey with a gold bar down the left — like this — is an instruction to you. Delete it once you’ve acted on it. Yellow chips are words to swap.'));

/* ------------------------------------------------ 01 */
P(S('01', 'You’re In'));
P(lead('Hi [PLAYER NAME],'));
P(body('Welcome to [ACADEMY NAME]. You’re one of us now.'));
P(guidance('WRITE 2–3 SENTENCES to the player, in your own words: what you were like at their age, or why you started this. Keep it short and keep it true. Example: “I was the smallest kid in every team I ever played in. Nobody picked me first. What I had was that I turned up, every week, and I worked. That’s the only thing we actually ask of you here.”'));
P(body('This pack tells you three things: what we’re about, what you can expect from us, and what we’ll expect from you. Read it. Keep it. Bring it to your first session.'));
P(body('One more thing before you start. You do not have to be the best player here. Nobody is going to ask you to be. You have to turn up, work, and look after the people next to you. Everything else, we’ll help you with.'));
P(new Paragraph({ children: pr('See you [DAY].', font(24, { bold: true, color: theme.ink }), 'quiet'), spacing: { before: 300, after: 200 } }));
P(new Paragraph({ children: pr('[YOUR NAME]', font(24, { bold: true, color: theme.ink }), 'quiet'), spacing: { after: 60 } }));
P(new Paragraph({ children: pr('[YOUR ROLE] · [ACADEMY NAME]', font(21, { color: theme.grey }), 'quiet') }));

/* ------------------------------------------------ 02 */
P(S('02', 'What We’re About'));
P(lead('Every academy says it wants players to work hard and enjoy it. Here is what that actually means at [ACADEMY NAME].'));
P(h2('The [ACADEMY NAME] Way'));
P(bullet('[WAY 1 — e.g. We work. Not because someone is watching, but because that’s who we are.]'));
P(bullet('[WAY 2 — e.g. We try the hard thing. Losing the ball trying something is better than passing it backwards to stay safe.]'));
P(bullet('[WAY 3 — e.g. We look after each other. Nobody here gets laughed at for a mistake.]'));
P(bullet('[WAY 4 — e.g. We listen first. You can’t get better with your mouth open.]'));
P(bullet('[WAY 5 — e.g. We finish what we start. Tired is not a reason to stop.]'));
P(guidance('Use the exact same words as the Ten Non-Negotiables in your Academy Bible, just shortened. Consistency between the staff handbook and the player pack is what makes a culture feel real instead of decorative.'));
P(h2('What we are not about'));
P(bullet('We don’t care what boots you have.'));
P(bullet('We don’t pick favourites, and we don’t have a “best” group you get promoted into for showing off.'));
P(bullet('We don’t shout at players for mistakes. Ever. Not us, not your teammates, not the people watching.'));
P(photo('coaching'));

/* ------------------------------------------------ 03 */
P(S('03', 'What You Can Expect From Us'));
P(lead('This is our side of the deal. If we ever get one of these wrong, you are allowed to tell us.'));
P(dataTable(['We will', 'Which means'], [
  ['Know your name from day one', 'Not “mate”, not a number, not a bib colour. Your name.'],
  ['Give you the ball, a lot', '[e.g. Small groups, small games, no long queues to have one touch.]'],
  ['Tell you the truth', 'If something needs work we’ll tell you kindly, clearly, and with a way to fix it.'],
  ['Never embarrass you', 'Corrections happen quietly and next to you, not shouted across a pitch.'],
  ['Explain the why', 'You’ll always know what we’re working on and what it’s for.'],
  ['Keep you safe', 'Every coach here is checked, trained and first-aid qualified.'],
  ['Listen to you', 'If something is wrong — anything — tell [COACH NAME] or [SAFEGUARDING LEAD]. We will take it seriously.'],
], [0.34, 0.66]));

/* ------------------------------------------------ 04 */
P(S('04', 'What We Expect From You'));
P(lead('Short list. None of it is about talent. All of it is a choice you make.'));
P(h2('Every session'));
P(bullet('Turn up on time and ready. The warm-up is where the session gets set up — miss it and you spend the night catching up.'));
P(bullet('Say hello to your coach and to someone you don’t know yet.'));
P(bullet('When a coach talks, ball still, eyes up. It takes twenty seconds and then you get the ball back.'));
P(bullet('Work at the thing you’re worst at, not the thing you’re already good at.'));
P(bullet('Help put the kit away at the end. Everyone. Every week.'));
P(h2('When it gets hard'));
P(body('It will. That’s the point of being here — if it were easy you wouldn’t be improving. When it gets hard:'));
P(bullet('Don’t go quiet. Ask.'));
P(bullet('Don’t blame the pitch, the ball, or your teammate.'));
P(bullet('Don’t stop moving. Tired is allowed. Hiding isn’t.'));
P(callout('You will never be in trouble here for trying something and failing. You will be pulled up for not trying at all. That is the only line.'));

/* ------------------------------------------------ 05 */
P(S('05', 'Being A Good Teammate'));
P(lead('You’ll be a better player in three months. Whether people want to play with you is decided by this page.'));
P(dataTable(['Instead of this', 'Do this'], [
  ['Groaning when someone misplaces a pass', 'Say “again” and get open for them'],
  ['Only passing to your mate', 'Pass to whoever is actually in space'],
  ['Going quiet when you’re losing', 'Get louder. That’s exactly when it counts.'],
  ['Laughing at someone struggling', 'Be the one who says “good try”'],
  ['Celebrating in someone’s face', 'Celebrate with your team'],
  ['Waiting to be picked', 'Be the one who asks the new kid to join in'],
], [0.44, 0.56]));
P(h2('The new player rule'));
P(body('Somebody walked in here for the first time and felt nervous. That was you, once. When a new player arrives, one of us goes and gets them. At [ACADEMY NAME], that’s not a favour — it’s the job.'));
P(photo('team'));

/* ------------------------------------------------ 06 */
P(S('06', 'How You Actually Get Better'));
P(lead('Not a secret, and not luck. Three things, in this order.'));
P(h2('1. Touches'));
P(body('The player who touches the ball 600 times a week improves faster than the player who touches it 200 times and is more talented. That’s it. That’s the whole thing.'));
P(h2('2. Mistakes'));
P(body('If you’re not losing the ball, you’re not trying anything difficult, and if you’re not trying anything difficult you’re not getting better — you’re just staying the same in front of people. Take the risk. We’d rather see it.'));
P(h2('3. Doing it again when nobody’s watching'));
P(body('Everyone works on a Tuesday when the coach is there. Almost nobody works on a Sunday in the garden. That gap is where players separate.'));
P(h2('This block’s home challenge'));
P(guidance('Fill this in and change it every block — or delete the table. A challenge you don’t follow up on teaches players that what you write down doesn’t matter.'));
P(dataTable(['Weeks', 'Your challenge at home', 'What it’s building'], [
  ['[WEEKS 1–4]', '[e.g. 100 touches a day, both feet, 5 minutes]', '[e.g. A first touch you don’t have to think about]'],
  ['[WEEKS 5–8]', '[e.g. 20 one-v-ones against a wall or a bin]', '[e.g. The confidence to take someone on]'],
  ['[WEEKS 9–12]', '[e.g. Watch one full game, follow one player]', '[e.g. Seeing the picture before you get the ball]'],
], [0.20, 0.44, 0.36]));

/* ------------------------------------------------ 07 */
P(S('07', 'Your First Session'));
P(lead('Nervous is normal. Every single person here has done a first session.'));
P(h2('What happens'));
P(bullet('Get there [X] minutes early. Come to [MEETING POINT] and ask for [COACH NAME].'));
P(bullet('We’ll introduce you to your coach and a couple of the group — you won’t be left standing on your own.'));
P(bullet('The session runs [TIME] to [TIME].'));
P(bullet('At the end your coach will have a quick word with you and with whoever brought you.'));
P(h2('If you’re nervous'));
P(body('Tell your coach before it starts. Not after. There is nothing embarrassing about it and we will quietly sort it — usually by putting you next to someone friendly and giving you something to do straight away.'));
P(photo('welcome'));
P(callout('You won’t be the worst one there. You won’t be the best one there either. Nobody is counting. Come and play.'));

/* ------------------------------------------------ 08 */
P(S('08', 'Be Ready'));
P(lead('Bring this every week. Pack it the night before, not in the car.'));
P(check('[Boots — moulded / astro]'));
P(check('Shin pads'));
P(check('Water bottle — with your name on it'));
P(check('[Weather layers — we train outdoors in most weather]'));
P(check('[Academy kit, if you have it]'));
P(check('Anything you need for a medical condition — inhaler, etc. Tell your coach where it is.'));
P(h2('Your details'));
P(dataTable(['', ''], [
  ['Your coach', '[COACH NAME]'],
  ['Your group', '[AGE GROUP]'],
  ['Where and when', '[DAY, TIME] at [VENUE]'],
  ['Someone to talk to if anything’s wrong', '[SAFEGUARDING LEAD] — [PHONE]'],
], [0.42, 0.58]));

/* ------------------------------------------------ 09 */
P(S('09', 'Your Pledge'));
P(lead('Read this out loud once before you sign it. It matters more than it looks.'));
P(new Paragraph({
  children: pr('I am part of [ACADEMY NAME].', font(30, { bold: true, color: theme.ink })),
  spacing: { before: 260, after: 200 },
}));
P(bullet('I will turn up, on time, ready to work.'));
P(bullet('I will try the hard thing, and I won’t hide when it goes wrong.'));
P(bullet('I will listen first and ask when I don’t understand.'));
P(bullet('I will look after my teammates — especially the new ones.'));
P(bullet('I will never laugh at someone for a mistake.'));
P(bullet('I will get better because I did the work, not because someone made me.'));
P(guidance('Swap these six lines for your own if your Academy Bible uses different words. Same wording across both documents is the whole point.'));
P(bullet('[ADD A SEVENTH LINE THAT IS UNIQUELY YOURS]'));
P(photo('group', { before: 200, after: 60 }));
P(fieldLine('Signed'));
P(fieldLine('Date'));
P(fieldLine('Coach'));
P(new Paragraph({
  children: pr('Welcome to [ACADEMY NAME]. We’re glad you’re here.',
    font(22, { italics: true, color: theme.ink })),
  spacing: { before: 340 },
  border: { top: { style: H.BorderStyle.SINGLE, size: 6, color: theme.accent, space: 14 } },
}));

const footer = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: pr('[ACADEMY NAME]  ·  Player Welcome Pack', font(16, { color: '9AA1AE' }), 'none'),
})] });

build(process.argv[2] || `${process.env.HOME}/Downloads/Player-Welcome-Pack-TEMPLATE.docx`,
      { cover, children, footer });
