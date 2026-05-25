# Academy Onboarding Compliance Checklist

Use this for every new academy before they go live on Player Portal. One page per academy, filed at `/legal/academies/[academy-name]/`.

---

## Academy: _______________________

**Contact name:** _______________________
**Contact email:** _______________________
**Contact phone:** _______________________
**Legal entity name:** _______________________
**Company number (if applicable):** _______________________
**Start date:** _______________________
**Onboarding admin (your side):** _______________________

---

## 1. Pre-signup (before access granted)

- [ ] **MSA signed** by both parties (DocuSign link in file)
- [ ] **DPA signed** by both parties
- [ ] **Order form completed** specifying: plan, fees, sibling/quarterly/retention settings
- [ ] **Initial invoice issued** (if applicable)

## 2. Academy-side compliance confirmations

All confirmed via attached evidence or signed declaration:

- [ ] Academy has own ICO registration (screenshot/certificate attached)
- [ ] Academy has public liability insurance (cert attached, valid to date)
- [ ] Academy has safeguarding insurance (cert attached, valid to date)
- [ ] Academy's Designated Safeguarding Lead named in writing
- [ ] All coaches have valid DBS checks (list attached)
- [ ] Academy has own written Safeguarding Policy (document attached)
- [ ] Academy confirms parental consent obtained for all uploaded child data
- [ ] Academy accepts Acceptable Use Policy

## 3. Platform setup

- [ ] Organisation created in Supabase
- [ ] Admin account created + password reset link sent
- [ ] Booking URL (slug) confirmed and set
- [ ] Branding assets uploaded (logo, hero image, primary colour)
- [ ] Stripe Connect onboarding completed by academy
- [ ] Platform plan set (Starter / Pro / Enterprise)
- [ ] Pilot flag set appropriately
- [ ] Sibling discount configured per Order Form
- [ ] Quarterly billing configured per Order Form
- [ ] Retention offer configured per Order Form

## 4. Data migration (if applicable)

- [ ] Source system identified: _______________________ (e.g. ClassForKids)
- [ ] Source CSV export received and checked for PII accuracy
- [ ] Class → plan mapping agreed with academy admin
- [ ] Migration dry-run performed on staging (if available)
- [ ] Production migration completed
- [ ] Invitation emails sent to parents
- [ ] Progress dashboard shared with academy admin
- [ ] Parents unable to confirm within 7 days chased manually

## 5. Training & handover

- [ ] Admin walkthrough call completed (30 min)
- [ ] Coaches walkthrough call completed (30 min)
- [ ] Help docs shared with academy
- [ ] Support channel explained (email / phone / hours)

## 6. Post-go-live (week 1)

- [ ] Monitor migration confirmation rate (target: 80%+ by Day 7)
- [ ] First sessions run through Player Portal (attendance + messages tested)
- [ ] Any bugs or issues logged and prioritised
- [ ] Academy satisfaction check-in call (end of week)

## 7. Ongoing (monthly)

- [ ] DBS check expiry dates — academy notified 30 days before expiry
- [ ] Insurance cert expiry dates tracked
- [ ] Any safeguarding incidents logged
- [ ] Any complaints tracked
- [ ] Usage stats reviewed (active players, payments, attendance rate)

---

## Evidence storage

All evidence (certs, signed docs, training records) stored at:

`/legal/academies/[academy-slug]/`

Suggested files:
- `msa-signed.pdf`
- `dpa-signed.pdf`
- `order-form.pdf`
- `academy-insurance-public-liability.pdf`
- `academy-insurance-safeguarding.pdf`
- `academy-ico-registration.pdf`
- `academy-safeguarding-policy.pdf`
- `academy-dbs-list.pdf`
- `correspondence/`

---

## Red flags (do not go live if any apply)

🚨 Refuse or delay go-live if:

- Academy refuses to sign DPA or MSA
- No valid insurance evidence
- No DBS evidence for any coach who will have player access
- No Designated Safeguarding Lead named
- Any previous safeguarding conviction
- Dispute over data ownership clauses
- Request for bulk parent data export without clear lawful basis

Escalate any of these to the Director immediately. When in doubt, do not proceed.

---

**Signed off by (Director):** _______________________
**Date:** _______________________
