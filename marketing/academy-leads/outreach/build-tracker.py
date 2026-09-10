#!/usr/bin/env python3
"""Build/refresh outreach tracker.json from Gmail search_threads JSON dumps.

Usage: build-tracker.py tracker.json dump1.json [dump2.json ...]
Each dump is the raw JSON returned by the Gmail MCP search_threads
(THREAD_VIEW_METADATA_ONLY). One row per thread whose FIRST message is from
john@theplayerportal.net to an external address. Existing rows keep their
follow-up bookkeeping (followup4_at, followup10_at, notes).
"""
import sys, json, os, datetime
ME = 'john@theplayerportal.net'
SKIP = ('goldandgraysocceracademyaberdeen.com','johnleitch970@gmail.com','wlfa.co.uk','jayrosagroup.com',
        'rznation.com','lewisblack','playitloveit.com','theplayerportal.net','no.1gkacademy@yahoo.com','emma.murray@')
out = sys.argv[1]
tracker = json.load(open(out)) if os.path.exists(out) else {}
for f in sys.argv[2:]:
    raw = open(f).read(); d = json.loads(raw[raw.index('{'):])
    for t in d.get('threads', []):
        msgs = sorted(t['messages'], key=lambda m: m['date'])
        first = msgs[0]
        if first['sender'] != ME or not first.get('toRecipients'): continue
        to = first['toRecipients'][0].lower()
        if any(s in to for s in SKIP): continue
        replied = any(m['sender'] != ME and 'mailer-daemon' not in m['sender'].lower() for m in msgs)
        bounced = any('mailer-daemon' in m['sender'].lower() for m in msgs)
        row = tracker.get(t['id'], {})
        row.update({'thread_id': t['id'], 'to': to, 'first_sent': first['date'][:10],
                    'first_message_id': first['id'], 'messages': len(msgs),
                    'replied': replied, 'bounced': bounced,
                    'last_from_them': max((m['date'] for m in msgs if m['sender'] != ME), default=None),
                    'our_sends': sum(1 for m in msgs if m['sender'] == ME)})
        row.setdefault('followup4_at', None); row.setdefault('followup10_at', None); row.setdefault('notes', '')
        tracker[t['id']] = row
json.dump(tracker, open(out, 'w'), indent=1, sort_keys=True)
today = datetime.date.today()
rows = sorted(tracker.values(), key=lambda r: r['first_sent'])
print(f"{len(rows)} threads | replied {sum(r['replied'] for r in rows)} | bounced {sum(r['bounced'] for r in rows)}")
for r in rows:
    age = (today - datetime.date.fromisoformat(r['first_sent'])).days
    due = 'REPLIED' if r['replied'] else 'BOUNCED' if r['bounced'] else ('day10 due' if age >= 10 and not r['followup10_at'] else 'day4 due' if age >= 4 and not r['followup4_at'] else f'wait ({age}d)')
    print(f"  {r['first_sent']} {r['to'][:38]:38} sends={r['our_sends']} {due}")
