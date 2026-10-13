/**
 * Welcome packs: the PDF an academy gives a new family.
 *
 * Asked for 13 Oct 2026 with Jamie Allan's "Goalscorers" pack as the example:
 * a pack belongs to a programme, so it attaches to the classes the academy
 * picks, or to every class. The academy uploads the PDF once; a parent with a
 * child in one of those classes gets it on their home page and in their
 * welcome email, and the academy can see who has opened it.
 *
 * No new tables. A pack is rows in `documents` (one per class it covers, all
 * sharing one file), told apart by doc_type and a folder key. An open is one
 * `audit_log` row. The file sits in a private storage bucket and is only ever
 * handed out as a short-lived link after an entitlement check.
 */
export const PACK_BUCKET = 'welcome-packs'
export const PACK_DOC_TYPE = 'welcome_pack'
export const PACK_OPENED_ACTION = 'welcome_pack.opened'
export const PACK_EMAILED_ACTION = 'welcome_pack.emailed'
/** One row per parent a pack was emailed to, so the automatic sends never email the same parent twice. */
export const PACK_EMAILED_TO_ACTION = 'welcome_pack.emailed_to'
export const PACK_MAX_BYTES = 30 * 1024 * 1024
const ALL = 'all', PREFIX = 'welcome_pack:'

/** The folder key that ties a pack row to one class, or to every class. */
export const packFolder = (classId: string | null) => `${PREFIX}${classId || ALL}`
export const isPackFolder = (folder: string | null | undefined) => (folder || '').startsWith(PREFIX)
/** null = every class. */
export const classOfFolder = (folder: string) => { const v = folder.slice(PREFIX.length); return v === ALL ? null : v }

/** Files live at <academy id>/<pack id>.pdf, so a path can never point into another academy. */
export const packPath = (orgId: string, packId: string) => `${orgId}/${packId}.pdf`
export const packIdOfPath = (path: string) => (/\/([0-9a-f-]{36})\.pdf$/i.exec(path || '') || [])[1] || null
export const pathBelongsTo = (path: string, orgId: string) => path.startsWith(`${orgId}/`) && !!packIdOfPath(path) && !path.includes('..')

export interface PackRow { id: string; organisation_id: string; title: string; description: string | null; url: string; folder: string; created_at?: string }
export interface Pack { packId: string; rowId: string; orgId: string; title: string; message: string | null; path: string; everyClass: boolean; classIds: string[]; createdAt?: string }

/** Rows → packs (one pack per file). */
export function groupPacks(rows: PackRow[]): Pack[] {
  const by = new Map<string, Pack>()
  for (const r of rows) {
    const packId = packIdOfPath(r.url); if (!packId || !isPackFolder(r.folder)) continue
    const p = by.get(r.url) || { packId, rowId: r.id, orgId: r.organisation_id, title: r.title, message: r.description, path: r.url, everyClass: false, classIds: [], createdAt: r.created_at }
    const cls = classOfFolder(r.folder); if (cls) p.classIds.push(cls); else p.everyClass = true
    by.set(r.url, p) // keyed by the whole path, so two academies can never share a pack
  }
  return [...by.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

/** The packs a family should see: every-class packs for that academy, plus packs for a class one of their children is in. */
export function packsForFamily(packs: Pack[], places: { orgId: string; classId: string }[]): Pack[] {
  const mine = places.filter((pl) => pl.orgId && pl.classId)
  return packs.filter((p) => mine.some((pl) => pl.orgId === p.orgId && (p.everyClass || p.classIds.includes(pl.classId))))
}

/** Who should have it, and who has opened it. */
export function packCoverage(entitledParentIds: string[], openedBy: string[]) {
  const entitled = [...new Set(entitledParentIds)], opened = new Set(openedBy)
  const notOpened = entitled.filter((id) => !opened.has(id))
  return { total: entitled.length, opened: entitled.length - notOpened.length, notOpened }
}

/** What is wrong with a pack the academy is trying to save, in words they read. null = fine. */
export function packProblem(p: { title?: string; everyClass?: boolean; classIds?: string[]; fileName?: string; fileSize?: number; fileType?: string }): string | null {
  if (!(p.title || '').trim()) return 'Give the pack a name, for example "Goalscorers welcome pack".'
  if (!p.everyClass && !(p.classIds || []).length) return 'Choose which classes this pack is for, or tick "Every class".'
  if (p.fileName !== undefined) {
    if (!/\.pdf$/i.test(p.fileName) || (p.fileType && p.fileType !== 'application/pdf')) return 'The pack must be a PDF. In Canva choose Share, Download, PDF.'
    if ((p.fileSize || 0) > PACK_MAX_BYTES) return 'That file is over 30MB. In Canva choose "PDF Standard" to make it smaller.'
    if (!p.fileSize) return 'That file is empty.'
  }
  return null
}

/**
 * Who a pack is emailed to: every parent in its classes who has an email address
 * and has not opened it yet. Each parent once, however many children they have.
 *
 * A pack goes out three ways (John, 13 Oct 2026: "can it not send auto?"):
 *   1. when the academy saves it, to the families already in those classes;
 *   2. every morning, to anyone who has joined one of those classes since;
 *   3. when the academy presses "Email again", to everyone who still has not opened it.
 * The two automatic sends pass `alreadyEmailed`, so nobody is emailed twice by the
 * system. The button does not: it is the academy choosing to remind them.
 */
export function packEmailRecipients<T extends { id: string; email?: string | null }>(entitled: T[], openedBy: string[], alreadyEmailed: string[] = []): T[] {
  const opened = new Set([...openedBy, ...alreadyEmailed]), seen = new Set<string>(), out: T[] = []
  for (const p of entitled) {
    const email = (p.email || '').trim().toLowerCase()
    // Reserved test domains (example.com, .invalid, .test) can never receive mail: demo families are never emailed.
    if (!email.includes('@') || /@(example\.(com|org|net)|[^@]*\.(invalid|test|example))$/.test(email) || opened.has(p.id) || seen.has(p.id) || seen.has(email)) continue
    seen.add(p.id); seen.add(email); out.push(p)
  }
  return out
}
