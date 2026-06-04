/**
 * Trial source derivation — pure, testable.
 *
 * Single source of truth for the source-priority chain used by both
 * trial booking forms (long form + quick form). Zero I/O. Zero side
 * effects. Easy to unit-test in isolation.
 *
 * Priority chain (highest signal wins, returns at the first hit):
 *   1. Parent-selected dropdown value (self-reported, highest trust)
 *   2. URL ?utm_source (lowercased, mapped to canonical)
 *   3. HTTP Referer hostname (parsed, mapped to canonical)
 *   4. 'unknown'
 *
 * source_detail is captured always:
 *   - 'other' dropdown branch: the parent's free-text answer
 *   - else: the URL ?utm_campaign value when present
 *   - else: null
 *
 * referrer_url is the raw HTTP Referer header, truncated to 500 chars
 * to avoid storing absurdly long query strings. Captured regardless of
 * which signal won the priority chain (forensic field for later
 * analysis when UTM / dropdown are missing).
 */

// ─── Canonical source values ──────────────────────────────────────────
// App-side validation. No DB CHECK constraint — marketing can add
// channels (e.g. 'whatsapp', 'tiktok') without a migration.
export const CANONICAL_SOURCES = [
  'facebook',
  'instagram',
  'google',
  'whatsapp',
  'tiktok',
  'youtube',
  'twitter',
  'referral',
  'school_visit',
  'flyer',
  'website',
  'other',
  'unknown',
] as const

export type CanonicalSource = (typeof CANONICAL_SOURCES)[number]

/** Display labels for the "How did you hear about us?" dropdown + analytics consumers. */
export const SOURCE_LABELS: Record<CanonicalSource, string> = {
  facebook:     'Facebook',
  instagram:    'Instagram',
  google:       'Google search',
  whatsapp:     'WhatsApp',
  tiktok:       'TikTok',
  youtube:      'YouTube',
  twitter:      'X (Twitter)',
  referral:     'Friend / referral',
  school_visit: 'School visit',
  flyer:        'Flyer or poster',
  website:      'Academy website',
  other:        'Other',
  unknown:      'Unknown',
}

// ─── Internal: map UTM source param to canonical ──────────────────────

const UTM_SOURCE_ALIASES: Record<string, CanonicalSource> = {
  facebook: 'facebook', fb: 'facebook', meta: 'facebook',
  instagram: 'instagram', ig: 'instagram', insta: 'instagram',
  google: 'google',
  whatsapp: 'whatsapp', wa: 'whatsapp',
  tiktok: 'tiktok', tt: 'tiktok',
  youtube: 'youtube', yt: 'youtube',
  twitter: 'twitter', x: 'twitter',
  referral: 'referral',
  school: 'school_visit', school_visit: 'school_visit',
  flyer: 'flyer', poster: 'flyer', print: 'flyer',
  website: 'website', direct: 'website',
}

function normaliseUtmSource(utm: string | null | undefined): CanonicalSource | null {
  if (!utm) return null
  const key = utm.trim().toLowerCase()
  if (!key) return null
  return UTM_SOURCE_ALIASES[key] ?? null
}

// ─── Internal: parse Referer hostname to canonical ────────────────────

/**
 * Maps a hostname to a canonical source. Returns null if no rule matches
 * (caller falls through to 'unknown').
 *
 * Conservative: only the well-known social/search hosts. Anything else
 * the academy is told via dropdown or UTM, or stays 'unknown'.
 */
function classifyHostname(hostname: string): CanonicalSource | null {
  const h = hostname.toLowerCase()
  if (h === 'facebook.com' || h === 'm.facebook.com' || h === 'fb.com' || h === 'fb.me' || h.endsWith('.facebook.com')) return 'facebook'
  if (h === 'instagram.com' || h === 'm.instagram.com' || h.endsWith('.instagram.com')) return 'instagram'
  if (h === 'google.com' || h.startsWith('google.') || h.endsWith('.google.com') || h.endsWith('.google.co.uk')) return 'google'
  if (h === 'wa.me' || h === 'web.whatsapp.com' || h === 'api.whatsapp.com' || h.endsWith('.whatsapp.com')) return 'whatsapp'
  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok'
  if (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be') return 'youtube'
  if (h === 'twitter.com' || h === 'x.com' || h.endsWith('.twitter.com')) return 'twitter'
  return null
}

function refererToCanonical(referer: string | null | undefined, academyHostHints: string[] = []): CanonicalSource | null {
  if (!referer) return null
  try {
    const url = new URL(referer)
    const host = url.hostname.toLowerCase()
    // Academy's own domain or this product's domain → 'website'
    if (academyHostHints.some(h => host === h.toLowerCase() || host.endsWith('.' + h.toLowerCase()))) {
      return 'website'
    }
    return classifyHostname(host)
  } catch {
    return null
  }
}

// ─── Public: the priority chain ───────────────────────────────────────

export interface SourceSignals {
  /** Parent-selected dropdown value (canonical or empty for "not selected"). */
  dropdownValue?: CanonicalSource | '' | null
  /** Free-text fed when dropdown === 'other'. */
  dropdownOtherText?: string | null
  /** ?utm_source URL param, lowercased. */
  utmSource?: string | null
  /** ?utm_campaign URL param. */
  utmCampaign?: string | null
  /** Raw HTTP Referer header value. */
  referer?: string | null
  /** Hostnames considered "the academy's own site" — referers from these get classified as 'website'. */
  academyHostHints?: string[]
}

export interface DerivedSource {
  trial_source: CanonicalSource
  source_detail: string | null
  referrer_url: string | null
}

export function deriveTrialSource(signals: SourceSignals): DerivedSource {
  const {
    dropdownValue,
    dropdownOtherText,
    utmSource,
    utmCampaign,
    referer,
    academyHostHints = [],
  } = signals

  // ─── Priority 1: parent-selected dropdown ───
  let trialSource: CanonicalSource | null = null
  if (dropdownValue && (CANONICAL_SOURCES as readonly string[]).includes(dropdownValue)) {
    trialSource = dropdownValue as CanonicalSource
  }

  // ─── Priority 2: UTM source ───
  if (!trialSource) {
    trialSource = normaliseUtmSource(utmSource)
  }

  // ─── Priority 3: Referer hostname ───
  if (!trialSource) {
    trialSource = refererToCanonical(referer, academyHostHints)
  }

  // ─── Priority 4: unknown fallback ───
  if (!trialSource) trialSource = 'unknown'

  // ─── source_detail ───
  let sourceDetail: string | null = null
  if (dropdownValue === 'other' && dropdownOtherText && dropdownOtherText.trim()) {
    sourceDetail = dropdownOtherText.trim().slice(0, 200)
  } else if (utmCampaign && utmCampaign.trim()) {
    sourceDetail = utmCampaign.trim().slice(0, 200)
  }

  // ─── referrer_url (raw, truncated for storage hygiene) ───
  const refererUrl = referer ? referer.slice(0, 500) : null

  return {
    trial_source: trialSource,
    source_detail: sourceDetail,
    referrer_url: refererUrl,
  }
}
