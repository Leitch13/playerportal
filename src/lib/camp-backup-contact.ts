/**
 * A backup contact on a camp booking: a second adult the academy can ring.
 *
 * Asked for 13 Oct 2026. A camp booking held one phone number, the parent's.
 * A child is at a camp for hours, is often dropped off by someone other than
 * the parent who booked, and many camp families are not members, so that one
 * number was all the academy had. 85 children were booked on upcoming camps
 * and none had a second number.
 *
 * Both booking forms ask for it and will not continue without it. The two
 * checkout routes record it when it arrives and refuse one that is wrong, but
 * do not yet refuse a booking that sends none: a parent with the old form
 * still open in their browser must not be blocked from paying. Families who
 * booked before this get a link (/book/<academy>/camps/backup/<booking id>).
 *
 * Kept as one audit_log row per booking (action CAMP_BACKUP_ACTION), the same
 * way camp tick-ins are kept: no new columns were needed.
 */
export const CAMP_BACKUP_ACTION = 'camp.backup_contact'

const digits = (p: string | null | undefined) => (p || '').replace(/[^\d]/g, '')
/** Two numbers are the same person's if their last nine digits match (07… and +44 7… are the same phone). */
export const samePhone = (a: string | null | undefined, b: string | null | undefined) => { const x = digits(a), y = digits(b); return x.length >= 7 && y.length >= 7 && x.slice(-9) === y.slice(-9) }

export interface BackupContact { name: string; phone: string }

/** What is wrong with a backup contact, in words a parent reads. null = fine. */
export function backupContactProblem(c: { name?: string | null; phone?: string | null; parentPhone?: string | null }): string | null {
  if ((c.name || '').trim().length < 2) return 'Please add the name of a second adult we can ring if we cannot reach you.'
  const d = digits(c.phone)
  if (d.length < 7 || d.length > 15) return 'Please add a phone number for your backup contact.'
  if (samePhone(c.phone, c.parentPhone)) return 'The backup number is the same as your own. Please give a different person’s number.'
  return null
}

export const tidyBackup = (c: { name?: string | null; phone?: string | null }): BackupContact => ({ name: (c.name || '').trim().replace(/\s+/g, ' ').slice(0, 80), phone: (c.phone || '').trim().slice(0, 30) })

/** The link a family who has already booked uses to add their backup contact. Carries no personal details. */
export const backupContactPath = (slug: string, bookingId: string) => `/book/${encodeURIComponent(slug)}/camps/backup/${encodeURIComponent(bookingId)}`

/** audit_log rows → the latest backup contact for each booking. */
export function latestBackups(rows: { entity_id: string; created_at: string; details: unknown }[]): Map<string, BackupContact> {
  const out = new Map<string, BackupContact>()
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const d = (r.details || {}) as { name?: string; phone?: string }
    if (d.name && d.phone) out.set(r.entity_id, { name: d.name, phone: d.phone })
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

/** Record a booking's backup contact. Takes a service-role client. Never throws: a booking must not fail on this. */
export async function saveBackupContact(sb: Supabase, p: { organisationId: string; bookingId: string; name: string; phone: string; source: 'booking' | 'link' }): Promise<boolean> {
  try {
    const c = tidyBackup(p)
    const { error } = await sb.from('audit_log').insert({ organisation_id: p.organisationId, action: CAMP_BACKUP_ACTION, entity_type: 'camp_booking', entity_id: p.bookingId, details: { name: c.name, phone: c.phone, source: p.source } })
    return !error
  } catch { return false }
}
