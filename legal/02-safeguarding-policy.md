# Safeguarding Policy

**Organisation:** JSL Sports Technology Ltd (trading as Player Portal)
**Effective date:** April 2026
**Review cadence:** Annual
**Designated Safeguarding Lead (DSL):** John Leitch, Director

---

## 1. Purpose

Player Portal is a technology platform used by football academies to manage children's training. While academies hold the primary safeguarding responsibility for their own players, Player Portal has a duty to:

- Design and operate the platform in a way that protects children
- Respond appropriately to safeguarding concerns raised through the platform
- Support academies in meeting their own safeguarding obligations

This policy sets out how we fulfil these duties.

---

## 2. Scope

This policy applies to:
- All JSL Sports Technology Ltd directors, employees, and contractors
- All data and content processed on the Player Portal platform
- All interactions with children (though we do not interact with children directly — parents hold portal access on children's behalf)

---

## 3. Our commitment

JSL Sports Technology Ltd commits to:

1. **Design for child safety** — by default, settings are privacy-preserving. Photo galleries require explicit per-image parental consent. Children's data is never used for advertising or behavioural profiling.
2. **Access control** — only authorised academy admins and coaches can access children's data, scoped to their own academy (enforced via Row-Level Security).
3. **Training** — all staff/contractors who could access children's data complete basic safeguarding awareness (NSPCC Learning — free).
4. **Reporting channels** — clear process for anyone (parent, coach, admin) to report safeguarding concerns.
5. **No direct contact with children** — the platform is accessed by adults on behalf of children. We have no feature enabling child-to-stranger contact.
6. **Support academies** — tools for academies to track DBS checks, coach certifications, and CPD.

---

## 4. What we will NOT do

- Store children's data beyond its purpose
- Share children's data across academies without explicit consent
- Allow children to contact coaches or other adults directly through the platform
- Use children's photos or data for marketing without explicit parental consent
- Retain data after an academy has been cancelled beyond the contractual retention period (max 7 years for safeguarding audit trail, per FA guidance)

---

## 5. How concerns can be raised

Anyone with a safeguarding concern about the platform or its use can contact us:

- **Email:** safeguarding@theplayerportal.net
- **Phone:** [TO BE ADDED]
- **Post:** [Registered office, JSL Sports Technology Ltd]

Concerns are logged and acknowledged within 24 hours.

### 5.1 If a concern relates to a child in immediate danger
- **Call 999** first
- Then notify the academy's own Designated Safeguarding Lead
- Then notify us

### 5.2 If a concern relates to platform misuse (e.g. inappropriate messages, unauthorised access)
1. We will investigate within 48 hours
2. Suspend any account where misconduct is suspected
3. Notify the relevant academy
4. If a criminal act is suspected, report to police
5. If a data protection issue, notify ICO within 72 hours per UK GDPR

---

## 6. Academy obligations (passed through)

Our MSA requires every academy using Player Portal to:

- Have their own written Safeguarding Policy
- Hold valid DBS checks for all coaches with player access
- Hold appropriate public liability and safeguarding insurance
- Have a Designated Safeguarding Lead identified to us on contract signing
- Comply with The FA Safeguarding Children Policy

Academies confirm this in writing before onboarding. We reserve the right to suspend any academy that fails to meet these standards.

---

## 7. Photo and video handling

- Photos are uploaded by academy admins/coaches, not parents or children
- Per-image parental consent is required (captured at child onboarding + per-gallery upload)
- Photos are stored in private Supabase Storage buckets (signed URLs, not public)
- Photos are never used in our marketing without written parental consent
- Parents can request removal of any photo; we action within 48 hours
- Upon academy cancellation, photos are deleted within 30 days unless a legal hold applies

---

## 8. Medical information

- Medical fields on player profiles are opt-in and encrypted at rest
- Only coaches/admins with a legitimate need see medical info (access logged if Enterprise tier)
- Medical info is never sent via email or exported in bulk by default
- Parents can update or redact at any time

---

## 9. Access and audit

- All admin/coach access to children's records is logged (Enterprise tier) or attributable (all tiers)
- Quarterly review: revoke dormant admin accounts
- Annual review: audit sample of academy usage for unusual patterns
- Right-to-access requests honoured within 30 days (see DSAR runbook)

---

## 10. Staff vetting

All JSL Sports Technology Ltd directors, employees, and contractors who could access children's data:

- Sign a confidentiality agreement
- Complete NSPCC-approved Introduction to Safeguarding module
- Provide DBS check if handling incidents or customer support directly

---

## 11. Incident register

All safeguarding concerns, reports, and incidents are logged in our internal incident register at `/legal/incidents-register.xlsx` (to be created). Fields:

- Date received
- Source (parent / academy admin / external)
- Nature of concern
- Actions taken
- Resolution date
- Lessons learned

---

## 12. Review

This policy is reviewed annually by the Director (DSL). Next review: **April 2027.**

Changes require sign-off from the Director and communication to all academies via platform announcement.

---

*This policy should be read alongside: Privacy Policy, Data Processing Agreement, Terms of Service, DPIA.*
