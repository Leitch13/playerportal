/**
 * Is this request coming from a datacentre, VPN exit or proxy rather than a
 * home or mobile connection?
 *
 * Why this exists: on 2026-09-06 an academy called "Yapro" signed up from a
 * Datacamp Ltd address in Bucharest — a VPN exit — with a temp-mail inbox, a
 * fake US phone and the location "NewYork", created a class, and went
 * straight to the ClassForKids import. Nobody running a Sunday-league club
 * does that. A disposable-domain blocklist will always be one domain behind
 * temp-mail providers; "is this a hosting network" is the signal that does
 * not rotate.
 *
 * Uses ip-api.com's free endpoint (no key, 45 req/min — signups are a
 * handful a day). Deliberately FAIL-OPEN: any timeout, error, rate-limit or
 * private/unknown address returns `false`, so a real coach is never bounced
 * by infrastructure noise. Only a definitive "proxy or hosting" answer
 * blocks.
 */
export type IpVerdict = {
  block: boolean
  reason?: string
  country?: string
  isp?: string
  /** ip-api said datacentre/hosting (set whenever it did, even if also a proxy). */
  hosting?: boolean
}

const PRIVATE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc00:|fe80:|unknown$)/i

/**
 * Parent bookings (free trials, enquiries) block only datacentre/hosting
 * networks, never the "proxy" flag alone. 13 Nov 2026: a real mum in Dungannon
 * on Fibrus home broadband (Northern Ireland, shared addresses) was flagged
 * "proxy" by ip-api and turned away twice from Pro Football Coaching. Free
 * trials still need the email confirm tap, so fakes are still stopped.
 * New academy sign-ups keep the strict check (checkSignupIp).
 */
export async function checkParentIp(ip: string | null | undefined): Promise<IpVerdict> {
  const v = await checkSignupIp(ip)
  return isParentBlock(v) ? v : { block: false, country: v.country, isp: v.isp }
}

/** A parent is only blocked on a datacentre/hosting network. */
export function isParentBlock(v: IpVerdict): boolean {
  return v.block && v.hosting === true
}

export async function checkSignupIp(ip: string | null | undefined): Promise<IpVerdict> {
  if (!ip || PRIVATE.test(ip)) return { block: false }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,isp,proxy,hosting`,
      { signal: controller.signal, cache: 'no-store' },
    )
    clearTimeout(timer)
    if (!res.ok) return { block: false }
    const j = (await res.json()) as {
      status?: string; country?: string; isp?: string; proxy?: boolean; hosting?: boolean
    }
    if (j.status !== 'success') return { block: false }
    if (j.proxy || j.hosting) {
      return {
        block: true,
        reason: j.proxy ? 'proxy/VPN' : 'hosting/datacentre',
        country: j.country,
        isp: j.isp,
        hosting: !!j.hosting,
      }
    }
    return { block: false, country: j.country, isp: j.isp }
  } catch {
    return { block: false } // timeout, network, abort — never block on noise
  }
}
