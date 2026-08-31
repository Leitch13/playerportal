/**
 * Client-side JSON POST with honest failure reporting.
 *
 * Every parent-facing form used the same fragile shape:
 *
 *   const res = await fetch(...)
 *   const data = await res.json()   // ← throws on ANY non-JSON body
 *   if (!res.ok) ...
 *   } catch { setError('Network error. Please try again.') }
 *
 * fetch() only rejects on a genuine transport failure. A 500 crash page or a
 * 504 gateway timeout resolves fine and then blows up at res.json(), landing
 * in the same catch — so parents were told "network error" while the server
 * was the thing failing, and the real response was discarded unread.
 *
 * This helper never throws. It distinguishes the three failure modes and
 * returns a message honest about which one happened, logging the raw
 * response to the console so DevTools on an affected parent's browser shows
 * the truth instead of a shrug.
 */
export interface PostJsonResult {
  ok: boolean
  status: number
  data: Record<string, unknown>
  /** Parent-safe message; empty string when ok. */
  error: string
}

export async function postJson(url: string, body?: unknown): Promise<PostJsonResult> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (err) {
    // The only true network error: offline, DNS, connection reset.
    console.error('[postJson] transport failure', url, err)
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return {
      ok: false,
      status: 0,
      data: {},
      error: offline
        ? 'You appear to be offline. Check your connection and try again.'
        : 'Could not reach the server. Please check your connection and try again.',
    }
  }

  const text = await res.text().catch(() => '')
  let data: Record<string, unknown> = {}
  let parsed = false
  try {
    data = JSON.parse(text) as Record<string, unknown>
    parsed = true
  } catch {
    /* non-JSON body — a platform error page, not our API */
  }

  if (res.ok && parsed) return { ok: true, status: res.status, data, error: '' }

  console.error('[postJson]', url, res.status, text.slice(0, 500))
  const apiMessage = parsed && typeof data.error === 'string' && data.error ? data.error : ''
  const error =
    apiMessage ||
    (res.status === 502 || res.status === 503 || res.status === 504
      ? 'The server took too long to respond. Please try again in a moment.'
      : res.status >= 500
        ? 'Something went wrong on our side. Please try again in a moment.'
        : 'Something went wrong. Please try again.')
  return { ok: false, status: res.status, data, error }
}
