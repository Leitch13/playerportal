// Shared product pictures for the parent shop and the academy's Manage Shop preview,
// so the academy sees exactly what parents see (19 Nov 2026).

export interface ArtProduct {
  name: string
  category: string
  image_url: string | null
}

/** Drawn product art in the academy's colour, used when there is no photo. */
export function KitArt({ category, accent, name, number, className = '' }: { category: string; accent: string; name?: string; number?: string; className?: string }) {
  if (category === 'gloves') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <path d="M24 70 V40 Q24 34 28 34 V18 Q28 13 32 13 Q36 13 36 18 V32 V14 Q36 9 40 9 Q44 9 44 14 V32 V16 Q44 11 48 11 Q52 11 52 16 V34 V22 Q52 17 56 17 Q60 17 60 22 V48 Q60 60 52 64 V70Z" fill={accent} />
        <path d="M24 46 Q14 40 12 30 Q11 25 15 25 Q19 25 22 32 L26 38" fill={accent} />
        <rect x="24" y="62" width="28" height="10" rx="3" fill="#fff" opacity="0.9" />
        <path d="M28 34 V30 M36 32 V28 M44 32 V28 M52 34 V30" stroke="#000" strokeOpacity="0.2" strokeWidth="2" />
      </svg>
    )
  }
  if (category === 'ball') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <circle cx="40" cy="40" r="30" fill="#f4f6f8" />
        <path d="M40 24 L52 33 L47.5 47 L32.5 47 L28 33Z" fill="#111827" />
        <path d="M40 24 L40 12 M52 33 L66 29 M47.5 47 L56 60 M32.5 47 L24 60 M28 33 L14 29" stroke="#111827" strokeWidth="2.5" />
        <circle cx="40" cy="40" r="30" fill="none" stroke={accent} strokeWidth="3" />
      </svg>
    )
  }
  if (category === 'bag') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <path d="M28 26 Q40 8 52 26" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        <rect x="10" y="26" width="60" height="38" rx="12" fill={accent} />
        <rect x="10" y="26" width="60" height="38" rx="12" fill="#000" opacity="0.18" />
        <rect x="30" y="40" width="20" height="5" rx="2.5" fill="#fff" opacity="0.85" />
      </svg>
    )
  }
  if (category === 'socks') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <path d="M26 8 H44 V46 L58 54 Q66 60 60 68 Q56 72 48 68 L28 58 Q24 56 26 50Z" fill={accent} />
        <rect x="26" y="8" width="18" height="10" fill="#fff" opacity="0.85" />
      </svg>
    )
  }
  if (category === 'shorts') {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
        <path d="M14 16 H66 L70 60 H46 L40 36 L34 60 H10Z" fill={accent} />
        <rect x="14" y="16" width="52" height="7" fill="#000" opacity="0.2" />
      </svg>
    )
  }
  if (category === 'bundle') {
    return (
      <svg viewBox="0 0 96 80" className={className} aria-hidden="true">
        <path d="M54 18 L42 26 L47 37 L53 34 L53 70 L80 70 L80 34 L86 37 L91 26 L79 18 Q66.5 26 54 18Z" fill="#fff" opacity="0.18" />
        <path d="M22 10 L6 20 L12 34 L20 30 L20 70 L54 70 L54 30 L62 34 L68 20 L52 10 Q37 20 22 10Z" fill={accent} />
        <path d="M22 10 Q37 20 52 10" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="70" cy="62" r="13" fill="#f4f6f8" />
        <path d="M70 55 L76 59.5 L73.8 66.5 L66.2 66.5 L64 59.5Z" fill="#111827" />
      </svg>
    )
  }
  const training = category === 'training_top'
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      {training ? (
        <path d="M26 8 L4 26 L12 38 L22 30 L22 74 L58 74 L58 30 L68 38 L76 26 L54 8 L46 8 L40 16 L34 8Z" fill={accent} />
      ) : (
        <path d="M26 8 L8 19 L14 34 L22 30 L22 74 L58 74 L58 30 L66 34 L72 19 L54 8 Q40 18 26 8Z" fill={accent} />
      )}
      <path d="M22 30 L22 74 L58 74 L58 30" fill="#000" opacity="0.12" />
      {training ? (
        <path d="M40 16 L40 74" stroke="#fff" strokeWidth="2.5" opacity="0.8" />
      ) : (
        <path d="M26 8 Q40 18 54 8" fill="none" stroke="#fff" strokeWidth="3" />
      )}
      {name ? (
        <text x="40" y="40" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800" letterSpacing="1">{name.toUpperCase().slice(0, 10)}</text>
      ) : null}
      {number ? (
        <text x="40" y={name ? 60 : 54} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900">{number}</text>
      ) : null}
    </svg>
  )
}

export function ProductImage({ product, accent, size = 'card', name, number }: { product: ArtProduct; accent: string; size?: 'card' | 'large' | 'thumb'; name?: string; number?: string }) {
  // Goalkeeper gloves are sold as 'other': draw a glove, not a shirt.
  const art = /glove/i.test(product.name) ? 'gloves' : product.category
  const h = size === 'large' ? 'h-56 sm:h-64' : size === 'thumb' ? 'h-14 w-14' : 'h-40 sm:h-44'
  if (product.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.image_url} alt={product.name} className={`${h} w-full object-cover`} />
    )
  }
  return (
    <div
      className={`${h} flex w-full items-center justify-center`}
      style={{ background: `radial-gradient(circle at 50% 35%, ${accent}33 0%, ${accent}0f 45%, #0b1422 80%)` }}
    >
      <KitArt
        category={art}
        accent={accent}
        name={name}
        number={number}
        className={size === 'large' ? 'h-44 w-44 drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]' : size === 'thumb' ? 'h-10 w-10' : 'h-28 w-28 drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105'}
      />
    </div>
  )
}

