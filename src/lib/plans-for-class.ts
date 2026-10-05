/**
 * Which plans fit a child's class — so the academy isn't asked to pick from
 * every plan it sells when only one (or a few) belong to that class.
 *
 * The same cascade the public class page uses to decide what a parent sees:
 *   plans made for that class → plans for that class type → "any class" plans.
 * A child in more than one class gets the plans of all of them.
 *
 * It only narrows what is OFFERED on screen. It never picks a price, and it
 * never leaves the list empty: no class, or a class with nothing that fits,
 * falls back to every plan.
 */

export interface PlanForClass {
  id: string
  training_group_id?: string | null
  class_type?: string | null
}

export interface ClassRef {
  id: string
  class_type?: string | null
}

export function plansForClass<P extends PlanForClass>(plans: P[], cls: ClassRef): P[] {
  const own = plans.filter((p) => p.training_group_id === cls.id)
  if (own.length > 0) return own
  if (cls.class_type) {
    const typed = plans.filter((p) => !p.training_group_id && p.class_type === cls.class_type)
    if (typed.length > 0) return typed
  }
  return plans.filter((p) => !p.training_group_id && !p.class_type)
}

export function plansForClasses<P extends PlanForClass>(plans: P[], classes: ClassRef[]): P[] {
  if (classes.length === 0) return plans
  const keep = new Set<string>()
  for (const c of classes) for (const p of plansForClass(plans, c)) keep.add(p.id)
  if (keep.size === 0) return plans
  // Keep the academy's own order.
  return plans.filter((p) => keep.has(p.id))
}
