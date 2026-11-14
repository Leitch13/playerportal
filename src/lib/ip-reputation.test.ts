import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkParentIp, checkSignupIp } from './ip-reputation'

function ipApi(answer: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'success', ...answer }), { status: 200 })))
}
afterEach(() => vi.unstubAllGlobals())

// 13 Nov 2026: Michaela Devine, Dungannon, Fibrus home broadband — ip-api's real answer for 82.39.5.250.
const FIBRUS = { country: 'United Kingdom', isp: 'Fibrus Networks LTD', proxy: true, hosting: false }

describe('parent bookings (trials, enquiries)', () => {
  it('a home broadband flagged "proxy" only is let through', async () => {
    ipApi(FIBRUS)
    expect((await checkParentIp('82.39.5.250')).block).toBe(false)
  })
  it('a datacentre / hosting network is still turned away', async () => {
    ipApi({ country: 'Romania', isp: 'Datacamp Limited', proxy: false, hosting: true })
    expect((await checkParentIp('1.2.3.4')).block).toBe(true)
  })
  it('a VPN on a hosting network is still turned away', async () => {
    ipApi({ country: 'Netherlands', isp: 'M247', proxy: true, hosting: true })
    expect((await checkParentIp('1.2.3.5')).block).toBe(true)
  })
  it('an ordinary connection is let through', async () => {
    ipApi({ country: 'United Kingdom', isp: 'BT', proxy: false, hosting: false })
    expect((await checkParentIp('1.2.3.6')).block).toBe(false)
  })
})

describe('new academy sign-ups keep the strict check', () => {
  it('a "proxy" flag still blocks a new academy', async () => {
    ipApi(FIBRUS)
    expect((await checkSignupIp('82.39.5.250')).block).toBe(true)
  })
})
