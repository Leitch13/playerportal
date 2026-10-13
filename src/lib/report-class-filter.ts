/**
 * Player Reports by class.
 *
 * Asked for 13 Oct 2026: the Player Reports page was one list of every report
 * for every child. A coach writes reports a class at a time, so the page can
 * now be narrowed to one class, and says who in that class has no report yet.
 * Pure, so the page and its tests agree.
 */
export interface ClassPlace { player_id: string; group_id: string }

/** The children with a place in this class. Each child once, however the rows arrive. */
export function playersInClass(places: ClassPlace[], classId: string): string[] {
  return [...new Set(places.filter((p) => p.group_id === classId && p.player_id).map((p) => p.player_id))]
}

/** Of the children in the class, who has a report and who is still waiting for one. */
export function reportCoverage(classPlayerIds: string[], playerIdsWithAReport: string[]) {
  const reported = new Set(playerIdsWithAReport)
  const missing = classPlayerIds.filter((id) => !reported.has(id))
  return { total: classPlayerIds.length, withReport: classPlayerIds.length - missing.length, missing }
}

/** "Mini Kickers · Saturday" — the class as a coach knows it. */
export function classOptionLabel(c: { name: string; day_of_week?: string | null }): string {
  const day = (c.day_of_week || '').trim()
  return day && !c.name.toLowerCase().includes(day.toLowerCase()) ? `${c.name} · ${day}` : c.name
}
