-- Atomic increment of a promo code's redemption counter.
--
-- Called from the Stripe webhook only AFTER a payment succeeds, so an abandoned
-- checkout never consumes a code's max_uses. Doing the increment in SQL
-- (current_uses = current_uses + 1) makes it atomic — no read-modify-write race
-- if two redemptions land at once. SECURITY DEFINER so the service-role webhook
-- can run it regardless of RLS.

CREATE OR REPLACE FUNCTION increment_promo_use(p_promo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE promo_codes
     SET current_uses = COALESCE(current_uses, 0) + 1
   WHERE id = p_promo_id;
$$;
