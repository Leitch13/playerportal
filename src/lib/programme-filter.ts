// A booking-page link that shows only one programme: /book/<slug>?programme=goalscorers
// An academy points an ad or a message at it, so a parent who asked about Goalscorers sees
// those classes and nothing else. Look only: the classes, prices and booking buttons are the
// same ones the full page shows. Same for every academy.

/** Letters and digits only, lower case: "Goalscorers - Wednesday Night" -> "goalscorerswednesdaynight". */
export const programmeKey = (s: string | null | undefined): string =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The classes whose name contains the asked-for programme, or null when the link should be
 * ignored (nothing asked for, fewer than three letters, or no class matches) so the parent
 * still gets the full page rather than an empty one.
 */
export function classesForProgramme<T extends { name?: string | null }>(classes: T[], asked: unknown): T[] | null {
  if (typeof asked !== 'string') return null
  const want = programmeKey(asked)
  if (want.length < 3) return null
  const found = classes.filter(c => programmeKey(c.name).includes(want))
  return found.length ? found : null
}

/** What to call it on the page: the asked-for words, tidied. "goal-scorers " -> "Goal Scorers". */
export function programmeTitle(asked: string): string {
  return asked.replace(/[-_+]+/g, ' ').replace(/[^\p{L}\p{N} &'.]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
    .replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase())
}
