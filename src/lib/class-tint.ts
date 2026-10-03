// One colour per class, the same everywhere it appears. Display only.
// Colours are handed out in class-name order from the academy's own class
// list, so two classes never share one until there are more classes than
// colours, and nothing needs storing.
const TINTS = ['#4ecde6', '#9b8cf0', '#67c79a', '#e59a6b', '#e07fa8', '#d8a95a', '#6ea8f0', '#b5c95a', '#c98ae0', '#5fc9b5'] as const
export const NO_CLASS_TINT = '#293b58'

export type ClassTints = Record<string, string>

export function classTintMap(classNames: Array<string | null | undefined>): ClassTints {
  const names = [...new Set(classNames.map(n => (n || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const out: ClassTints = {}
  names.forEach((n, i) => { out[n] = TINTS[i % TINTS.length] })
  return out
}

export function classTint(tints: ClassTints, className: string | null | undefined): string {
  return tints[(className || '').trim()] || NO_CLASS_TINT
}
