import Link from 'next/link'

// ─── PremiumBookingView — the premium booking-page look (gated per org) ─────
//
// PRESENTATIONAL ONLY. Server component, zero interactivity by design (v1:
// no day filter, no client JS). Receives data ALREADY computed by
// page.tsx — same seat counts (078 RPC), same price precedence
// (price_per_session → findCheapestPlanFor monthly), same class-detail
// hrefs — and only re-skins it. Rendered only for orgs allowed by
// src/lib/premium-booking.ts; every other academy renders the existing
// page untouched.

export interface PremiumClassCard {
  id: string
  name: string
  day: string | null
  time: string | null
  location: string | null
  ageGroup: string | null
  shortDesc: string | null
  count: number
  capacity: number
  spotsLeft: number
  isFull: boolean
  /** e.g. "£36" — exactly what the standard card would show */
  priceValue: string | null
  /** "/mo" | "/session" */
  priceUnit: string | null
  /** Same href the standard flat card links to (class detail page) */
  href: string
  /** Optional class photo (training_groups.image_url) — card renders top image when set */
  imageUrl: string | null
}

interface Props {
  orgName: string
  logoUrl: string | null
  /** Optional hero banner (organisations.hero_image_url) */
  heroUrl: string | null
  primaryColor: string
  classes: PremiumClassCard[]
  /** Unique venue names derived from the classes' locations */
  venues: string[]
  trialHref: string
  isOwnerPreview: boolean
}

function hexToRgbTriple(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return [37, 99, 235]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

// Relative-luminance check so brand-coloured surfaces (CTA) get readable ink:
// dark text on light brands (e.g. yellows), white on dark brands.
function brandInkFor(hex: string): string {
  const [r, g, b] = hexToRgbTriple(hex)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.55 ? '#0d1b2b' : '#ffffff'
}

function monogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'PP'
  )
}

const css = `
.pb-root{min-height:100vh;background:#04070d;color:#eef2f9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;padding:clamp(14px,3vw,36px) clamp(10px,3vw,36px);--pb-mono:"SF Mono",ui-monospace,"Roboto Mono",monospace}
.pb-root *{box-sizing:border-box}
.pb-num{font-variant-numeric:tabular-nums}
.pb-page{max-width:520px;margin:0 auto;background:#080e18;border:1px solid #1d2c42;border-radius:22px;overflow:hidden;box-shadow:0 40px 90px -40px rgba(0,0,0,.85)}
.pb-head{padding:22px 20px 16px;border-bottom:1px solid #1d2c42;position:relative;overflow:hidden}
.pb-head::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 85% -30%,rgba(var(--pb-brand-rgb),.14),transparent 55%);pointer-events:none}
.pb-head::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:linear-gradient(90deg,transparent,var(--pb-brand),transparent)}
.pb-org{display:flex;align-items:center;gap:13px;position:relative}
.pb-crest{width:46px;height:46px;border-radius:14px;background:#142236;border:1px solid #293b58;display:grid;place-items:center;font-weight:800;font-size:14px;color:var(--pb-brand);overflow:hidden;flex-shrink:0}
.pb-crest img{width:100%;height:100%;object-fit:cover;display:block}
.pb-nm{font-size:17px;font-weight:780;letter-spacing:-.02em;color:#eef2f9}
.pb-sub{font-family:var(--pb-mono);font-size:10px;color:#5b6c86;margin-top:2px}
.pb-trust{display:flex;gap:7px;margin-top:14px;flex-wrap:wrap;position:relative}
.pb-chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--pb-mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#93a2ba;border:1px solid #1d2c42;border-radius:999px;padding:4px 10px}
.pb-dot{width:4.5px;height:4.5px;border-radius:50%;background:#67c79a}
.pb-body{padding:16px 16px 20px;display:flex;flex-direction:column;gap:12px}
.pb-seclab{font-family:var(--pb-mono);font-size:9.5px;letter-spacing:.15em;text-transform:uppercase;color:#5b6c86;margin-top:6px}
.pb-hero{position:relative;margin:-16px -16px 14px;border-radius:18px 18px 0 0;overflow:hidden;height:150px}
.pb-hero img{width:100%;height:100%;object-fit:cover;display:block}
.pb-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,14,24,.15),rgba(8,14,24,.92))}
.pb-img{margin:-14px -15px 12px;overflow:hidden;border-radius:14px 14px 0 0;height:118px}
.pb-img img{width:100%;height:100%;object-fit:cover;display:block}
.pb-card{background:#0f1a2b;border:1px solid #1d2c42;border-radius:15px;padding:14px 15px;overflow:hidden}
.pb-ct{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.pb-n{font-size:14px;font-weight:680;letter-spacing:-.01em;color:#eef2f9}
.pb-pr{font-size:14px;font-weight:780;color:var(--pb-brand);white-space:nowrap}
.pb-pr small{font-size:10px;color:#5b6c86;font-weight:500}
.pb-meta{font-size:11px;color:#5b6c86;margin-top:2px}
.pb-slot{border:1px solid #293b58;border-radius:10px;padding:7px 10px;margin-top:11px}
.pb-d1{font-size:11.5px;font-weight:650;color:#eef2f9}
.pb-d2{font-family:var(--pb-mono);font-size:9px;color:#5b6c86;margin-top:1px}
.pb-capline{display:flex;align-items:center;gap:6px;margin-top:6px}
.pb-bar{flex:1;height:3.5px;border-radius:99px;background:#1d2c42;overflow:hidden}
.pb-bar i{display:block;height:100%;border-radius:99px;background:var(--pb-brand)}
.pb-c{font-family:var(--pb-mono);font-size:9px;color:#93a2ba}
.pb-slot.pb-full{opacity:.75}
.pb-slot.pb-full .pb-bar i{background:#e0736d}
.pb-slot.pb-full .pb-c{color:#e0736d}
.pb-cta{display:block;background:var(--pb-brand);color:var(--pb-brand-ink);border-radius:11px;padding:11px;font-size:13px;font-weight:750;text-align:center;margin-top:11px;text-decoration:none}
.pb-cta.pb-wait{background:#142236;color:#93a2ba;border:1px solid #293b58}
.pb-micro{font-family:var(--pb-mono);font-size:9px;color:#5b6c86;text-align:center;margin-top:2px}
.pb-ghost{display:block;text-align:center;font-size:11px;color:#93a2ba;text-decoration:none;padding:6px}
.pb-powered{display:flex;align-items:center;justify-content:center;gap:6px;font-family:var(--pb-mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:#5b6c86;padding:12px;border-top:1px solid #1d2c42}
.pb-powered svg{width:11px;height:11px}
.pb-preview{max-width:520px;margin:0 auto 14px;text-align:center;font-size:12px;color:#fcd34d;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:10px 14px}
.pb-preview a{color:#fde68a;font-weight:600}

/* ── Desktop: a proper stage, not a phone column in a void ──
   ≥900px the shell widens, the header becomes a hero band, and classes flow
   into a two-column grid with bottom-aligned CTAs. Mobile (<900px) is
   untouched — everything above renders exactly as verified. */
@media (min-width:900px){
  .pb-page{max-width:1000px}
  .pb-preview{max-width:1000px}
  .pb-head{padding:34px 32px 24px}
  .pb-org{gap:16px}
  .pb-crest{width:58px;height:58px;border-radius:17px;font-size:18px}
  .pb-nm{font-size:24px}
  .pb-sub{font-size:11px;margin-top:3px}
  .pb-trust{margin-top:16px}
  .pb-chip{font-size:9.5px;padding:5px 12px}
  .pb-body{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:22px 24px 26px}
  .pb-seclab,.pb-micro,.pb-ghost{grid-column:1/-1}
  .pb-card{display:flex;flex-direction:column;padding:17px 18px}
  .pb-img{margin:-17px -18px 14px;height:140px}
  .pb-hero{height:200px}
  .pb-n{font-size:15px}
  .pb-pr{font-size:15px}
  .pb-slot{margin-bottom:12px}
  .pb-card .pb-cta{margin-top:auto}
  .pb-powered{padding:14px}
}
`

export default function PremiumBookingView({
  orgName,
  logoUrl,
  heroUrl,
  primaryColor,
  classes,
  venues,
  trialHref,
  isOwnerPreview,
}: Props) {
  const [r, g, b] = hexToRgbTriple(primaryColor)
  const brandInk = brandInkFor(primaryColor)
  const venuesLine = venues.slice(0, 2).join(' & ')
  const hasMonthly = classes.some((c) => c.priceUnit === '/mo')

  return (
    <div
      className="pb-root"
      style={
        {
          '--pb-brand': primaryColor,
          '--pb-brand-rgb': `${r}, ${g}, ${b}`,
          '--pb-brand-ink': brandInk,
        } as React.CSSProperties
      }
    >
      <style>{css}</style>
      {isOwnerPreview && (
        <div className="pb-preview">
          <strong>Preview mode</strong> — this page isn&apos;t public yet.{' '}
          <a href="/dashboard/billing">Choose a plan to go live &rarr;</a>
        </div>
      )}
      <div className="pb-page">
        {heroUrl && (
          <div className="pb-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="" />
          </div>
        )}
        <div className="pb-head">
          <div className="pb-org">
            <div className="pb-crest">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={orgName} />
              ) : (
                monogram(orgName)
              )}
            </div>
            <div>
              <div className="pb-nm">{orgName}</div>
              <div className="pb-sub">book a class</div>
            </div>
          </div>
          <div className="pb-trust">
            <span className="pb-chip">
              <span className="pb-dot" />
              Secure payments
            </span>
            {venuesLine && <span className="pb-chip">{venuesLine}</span>}
            <span className="pb-chip">Cancel anytime</span>
          </div>
        </div>

        <div className="pb-body">
          <div className="pb-seclab">Weekly classes</div>

          {classes.map((c) => {
            const filledPct = Math.min(100, Math.round((c.count / c.capacity) * 100))
            const dayTime = [c.day, c.time].filter(Boolean).join(' ')
            return (
              <div className="pb-card" key={c.id}>
                {c.imageUrl && (
                  <div className="pb-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.imageUrl} alt="" loading="lazy" />
                  </div>
                )}
                <div className="pb-ct">
                  <span className="pb-n">{c.name}</span>
                  {c.priceValue && (
                    <span className="pb-pr pb-num">
                      {c.priceValue}
                      <small>{c.priceUnit}</small>
                    </span>
                  )}
                </div>
                {(c.shortDesc || c.ageGroup) && (
                  <div className="pb-meta">{c.shortDesc || c.ageGroup}</div>
                )}
                <div className={`pb-slot${c.isFull ? ' pb-full' : ''}`}>
                  <div className="pb-d1">{dayTime || 'Schedule TBA'}</div>
                  {c.location && <div className="pb-d2">{c.location}</div>}
                  <div className="pb-capline">
                    <span className="pb-bar">
                      <i style={{ width: `${filledPct}%` }} />
                    </span>
                    {c.isFull ? (
                      <span className="pb-c">FULL &middot; join waitlist</span>
                    ) : (
                      <span className="pb-c pb-num">
                        {c.count}/{c.capacity}
                      </span>
                    )}
                  </div>
                </div>
                <Link href={c.href} className={`pb-cta${c.isFull ? ' pb-wait' : ''}`}>
                  {c.isFull ? 'Join Waitlist' : 'Book Now'} &rarr;
                </Link>
              </div>
            )
          })}

          {hasMonthly && (
            <div className="pb-micro">
              Pay the sessions left this month today &middot; then monthly from the 1st &middot;
              cancel anytime
            </div>
          )}
          <Link href={trialHref} className="pb-ghost">
            Not sure yet? Book a trial session &rarr;
          </Link>
        </div>

        <div className="pb-powered">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle
              cx="50"
              cy="50"
              r="34"
              fill="none"
              stroke="#4ecde6"
              strokeWidth="12"
              pathLength="1200"
              strokeDasharray="80 20"
              transform="rotate(-90 50 50)"
            />
          </svg>
          Powered by Player Portal
        </div>
      </div>
    </div>
  )
}
