/**
 * Pure URL-recipients validator for the Messages page deep-link.
 *
 * Pulls a comma-separated list of recipient IDs out of a query param,
 * cross-checks each against the caller's allowed recipient set (already
 * scoped to the current org + role on the server), dedupes, and caps the
 * total to a safety limit so a tampered link can't fan-out wildly.
 *
 * Pure function — no I/O. Output is a stable subset of the input set; any
 * ID not present in `allowedRecipients` (e.g. cross-org, made-up, mis-cased
 * UUIDs) is silently dropped. Returning a SUBSET rather than throwing keeps
 * the page resilient — admins still see the form populated with whatever
 * IDs validated, instead of a hard error.
 */

const MAX_RECIPIENTS = 200

export interface AllowedRecipient {
  id: string
  full_name: string
}

export interface ValidatedRecipients {
  ids: string[]                          // ordered, deduped, capped, all in-org
  labels: Record<string, string>         // id → name (best-effort)
  droppedCount: number                   // ids that did NOT pass validation
  capApplied: boolean                    // true iff caller hit the MAX cap
}

export function validateRecipientsParam(
  raw: string | string[] | undefined,
  allowedRecipients: AllowedRecipient[],
): ValidatedRecipients {
  // Normalise input: handle missing, array, string
  let csv = ''
  if (Array.isArray(raw)) csv = raw.join(',')
  else if (typeof raw === 'string') csv = raw
  if (!csv.trim()) {
    return { ids: [], labels: {}, droppedCount: 0, capApplied: false }
  }

  // Build the allowed-id lookup
  const allowedMap = new Map<string, string>()
  for (const r of allowedRecipients) {
    if (r.id) allowedMap.set(r.id, r.full_name || r.id)
  }

  // Split, trim, dedupe, validate
  const seen = new Set<string>()
  const validated: string[] = []
  const labels: Record<string, string> = {}
  let dropped = 0

  for (const piece of csv.split(',')) {
    const id = piece.trim()
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)

    if (!allowedMap.has(id)) {
      dropped++
      continue
    }
    validated.push(id)
    labels[id] = allowedMap.get(id) as string
  }

  const capApplied = validated.length > MAX_RECIPIENTS
  const final = capApplied ? validated.slice(0, MAX_RECIPIENTS) : validated

  return {
    ids: final,
    labels: final.reduce<Record<string, string>>((acc, id) => {
      acc[id] = labels[id]
      return acc
    }, {}),
    droppedCount: dropped,
    capApplied,
  }
}
