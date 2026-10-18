/**
 * What a camp booking must tell the academy about the child.
 *
 * Until 12 Oct 2026 a parent could book a camp with no date of birth, no phone
 * number and no medical answer. On the by-the-day form the date of birth was an
 * unlabelled date box marked optional, and 61 of 108 day bookings arrived with
 * no age at all (2 of 139 on the whole-camp form, which labels it). Medical was
 * a free-text box on both, so a blank could mean "nothing" or "didn't answer":
 * 157 of 247 were blank. No.1 Goalkeeping had 13 of 27 children on two camps
 * with no age on record the day before one started.
 *
 * One rule, used by both forms and both checkout routes, so the browser and the
 * server cannot disagree. Pure: nothing here touches a database.
 */
export const NOTHING_TO_REPORT = 'Nothing to report'

export interface CampBookingDetails {
  childDob?: string | null
  parentPhone?: string | null
  medicalInfo?: string | null
  /** The academy's own switch: some camps do not ask for medical information at all. */
  collectMedical: boolean
  /** Today as YYYY-MM-DD; passed in so the rule is the same on both sides and testable. */
  today?: string
}

/** A real, sensible date of birth for a child on a camp: not today or later, and under 19. */
export function validChildDob(dob: string | null | undefined, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false
  const d = new Date(dob + 'T00:00:00Z')
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dob) return false
  if (dob >= today) return false
  const oldest = `${Number(today.slice(0, 4)) - 19}${today.slice(4)}`
  return dob > oldest
}

/** At least seven digits once spaces, brackets, dashes and a leading + are taken out. */
export function validPhone(phone: string | null | undefined): boolean {
  const digits = (phone || '').replace(/[^\d]/g, '')
  return digits.length >= 7 && digits.length <= 15
}

/** Has the parent answered the medical question (typed something, or said there is nothing)? */
export function medicalAnswered(medicalInfo: string | null | undefined): boolean {
  return (medicalInfo || '').trim().length > 0
}

/** True when the answer was "nothing", so a register does not flag it as a medical note. */
// What parents type when there's nothing to say. No.1 had six camp bookings reading "NA"
// shown in red as a medical note (Cammy, 18 Oct 2026). Treated as "Nothing to report".
const NOTHING = /^(n\/?a|n\.a\.?|none|no|nope|nil|nothing|nothing to report|not applicable|no issues|no medical( issues| conditions)?|-+|\.+|x)$/i

export function hasMedicalNote(medicalInfo: string | null | undefined): boolean {
  const t = (medicalInfo || '').trim().replace(/[.!]+$/, '')
  return t.length > 0 && t.toLowerCase() !== NOTHING_TO_REPORT.toLowerCase() && !NOTHING.test(t)
}

/** The first thing missing, in plain words for the parent, or null when the booking can go ahead. */
export function campDetailsProblem(d: CampBookingDetails): string | null {
  if (!validPhone(d.parentPhone)) return 'Please add a phone number we can reach you on during the camp.'
  if (!d.childDob) return 'Please add your child’s date of birth.'
  if (!validChildDob(d.childDob, d.today)) return 'That date of birth doesn’t look right. Please check it.'
  if (d.collectMedical && !medicalAnswered(d.medicalInfo)) return `Please tell us about any medical conditions or allergies, or tick “${NOTHING_TO_REPORT}”.`
  return null
}
