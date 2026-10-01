// Read every row of a query, not just the first page.
//
// Supabase (PostgREST) returns at most 1000 rows per request and silently
// drops the rest, and a long `.in('id', [...])` list makes a GET URL that
// the gateway rejects. Both used to hide players once an academy grew past
// a few hundred. These helpers page with `.range()` and split long id lists.
//
// The caller must order the query by something unique (e.g. add
// `.order('id')` as a tiebreaker) so pages don't overlap or skip rows.

const PAGE_SIZE = 1000
const IN_CHUNK = 150

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/** Runs `page(from, to)` until a short page comes back; returns all rows. */
export async function selectAll<T>(
  page: (from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('[selectAll] page failed at row', from, error)
      break
    }
    const rows = data || []
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return out
}

/** `selectAll` over `ids` split into URL-safe chunks for `.in()` filters. */
export async function selectAllIn<T>(
  ids: string[],
  page: (chunk: string[], from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    out.push(...await selectAll<T>((from, to) => page(chunk, from, to)))
  }
  return out
}
