import Stripe from 'stripe'

// Stripe client — lazy init to avoid crashing at build time when env var isn't available
let _stripe: Stripe | null = null

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Missing STRIPE_SECRET_KEY environment variable')
      }
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
        typescript: true,
      })
    }
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop]
  },
})
