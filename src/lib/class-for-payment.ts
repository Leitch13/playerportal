/**
 * A membership is always for a class.
 *
 * John Leitch, 8 October 2026, in writing: "Any parent who is in the app pays
 * what is left of that month and has to be registered to a class."
 *
 * Until then a parent could buy a plan from the Membership page, or from the
 * general sign-up page, without naming a class. With no class the app could not
 * count the sessions left, so it charged by weeks (a parent joining with three
 * Sundays left paid the full £40, not £30), it skipped the "is the class full?"
 * check, and the child was left paying but on no register.
 *
 * This file is the one place that decides which class a payment is for. The
 * payment route calls classForPayment(); the two pages call classesForPlan() to
 * offer the choice. It never decides a price — firstChargeFor() still does that.
 */
import { plansForClass, type PlanForClass } from './plans-for-class'

export const CLASS_REQUIRED_MESSAGE =
  'Please choose a class before paying, so we can charge you only for the sessions left this month and add your child to the register.'

export interface ClassOption {
  id: string
  name: string
  class_type?: string | null
  day_of_week?: string | null
  time_slot?: string | null
}

/**
 * Which class is this payment for? In order:
 *   1. the class the page sent
 *   2. the class the plan belongs to, when the academy tied the plan to one class
 *   3. the child's own class, when they are in exactly one
 * Anything else is null, and the payment is refused with CLASS_REQUIRED_MESSAGE.
 * Two or more classes is a real choice and is never guessed.
 */
export function classForPayment(input: {
  sent?: string | null
  planClassId?: string | null
  childClassIds?: string[]
}): string | null {
  if (input.sent) return input.sent
  if (input.planClassId) return input.planClassId
  const own = Array.from(new Set(input.childClassIds || []))
  return own.length === 1 ? own[0] : null
}

/**
 * The classes a parent may pick for a plan: the same cascade the class pages
 * use, read the other way round. A plan that fits no class by that cascade is
 * offered every class rather than none — a parent must never be left with
 * nothing to choose.
 */
export function classesForPlan<C extends ClassOption>(plan: PlanForClass, plans: PlanForClass[], classes: C[]): C[] {
  const fits = classes.filter((c) => plansForClass(plans, c).some((p) => p.id === plan.id))
  return fits.length > 0 ? fits : classes
}

export function classLabel(c: ClassOption): string {
  const when = [c.day_of_week, c.time_slot].filter(Boolean).join(' ')
  return when ? `${c.name} · ${when}` : c.name
}
