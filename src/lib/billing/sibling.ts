/**
 * Who counts as "already has a child here" for the sibling discount.
 *
 * A membership is `trialing` from the moment a parent signs up and pays for
 * this month's sessions until its first full monthly payment on the 1st.
 * Counting only `active` meant two children signed up in the same month got
 * no discount on the second child's first payment (found 5 Oct 2026: one
 * parent, two children two minutes apart, both charged full price).
 *
 * Not counted: an invite that hasn't been confirmed, a failed payment, a
 * paused or ended membership. Same for every academy.
 * John's written decision 6 Oct 2026.
 */
export const SIBLING_QUALIFYING_STATUSES = ['active', 'trialing'] as const
