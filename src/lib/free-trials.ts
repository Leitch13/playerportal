/**
 * How many FREE trial sessions a parent can book per child per class
 * (John, 16 Nov 2026: option "a"). One setting for every academy:
 * organisations.free_trial_sessions, 1 (the default, as before) or 2.
 *
 * With 2, the trial form asks for a second date and both sessions go on the
 * register as trials. Paid trials are not affected.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_FREE_TRIALS = 2

/** 1 or 2. Anything else (missing column before migration 129, null) is 1. Pure, for the test. */
export function freeTrialsFrom(v: unknown): 1 | 2 {
  return Number(v) === 2 ? 2 : 1
}

/** Reads the academy's setting. Never throws: on any trouble the answer is 1, as before. */
export async function freeTrialsFor(sb: SupabaseClient, orgId: string): Promise<1 | 2> {
  try {
    const { data, error } = await sb.from('organisations').select('free_trial_sessions').eq('id', orgId).maybeSingle()
    if (error || !data) return 1
    return freeTrialsFrom((data as { free_trial_sessions?: unknown }).free_trial_sessions)
  } catch {
    return 1
  }
}

/** A second date must be a real date after the first. Pure, for the test. */
export function secondDateOk(first: string | null, second: string | null): boolean {
  if (!first || !second) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || !/^\d{4}-\d{2}-\d{2}$/.test(second)) return false
  return second > first
}

/** Can this many more be booked, given how many the child already has in the class? Pure, for the test. */
export function canBook(existing: number, requested: number, allowed: number): boolean {
  return requested >= 1 && existing + requested <= allowed
}

/** "Saturday 21 November" or "Saturday 21 November and Saturday 28 November". */
export function trialDatesLabel(first: string | null, second: string | null): string | null {
  const f = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })
  if (!first) return null
  return second ? `${f(first)} and ${f(second)}` : f(first)
}
