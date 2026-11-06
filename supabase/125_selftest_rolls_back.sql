-- Self-test for 125. Pretends to be a Granite demo parent and the Granite admin,
-- tries every attack, then THROWS AWAY everything it did (the final error
-- rolls the whole thing back). Nothing is changed. Read the red message:
-- every line should say BLOCKED, except the two "normal edit" lines, which say OK.
DO $$
DECLARE
  r text := '';
  n int;
  res jsonb;
  parent uuid := '912b9a22-a9ee-4a64-a49d-329abee02c1b';   -- demo.callum.ross (Granite parent)
  gadmin uuid := 'fbacfe80-464f-4680-894a-bd458f351d68';   -- Granite admin
  org uuid := '1aa5e627-d8cb-45f3-b460-d155d4d3c12b';      -- Granite
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', parent, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  BEGIN UPDATE public.profiles SET role = 'admin' WHERE id = parent; r := r || ' | parent→admin: OPEN';
  EXCEPTION WHEN OTHERS THEN r := r || ' | parent→admin: BLOCKED'; END;

  BEGIN UPDATE public.profiles SET is_super_admin = true WHERE id = parent; r := r || ' | parent→platform admin: OPEN';
  EXCEPTION WHEN OTHERS THEN r := r || ' | parent→platform admin: BLOCKED'; END;

  BEGIN UPDATE public.profiles SET organisation_id = '800b49f6-1926-41ad-b04d-1a6072c5e5d6' WHERE id = parent; r := r || ' | parent→other academy: OPEN';
  EXCEPTION WHEN OTHERS THEN r := r || ' | parent→other academy: BLOCKED'; END;

  BEGIN UPDATE public.profiles SET phone = phone WHERE id = parent; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || ' | normal edit (parent phone): ' || CASE WHEN n = 1 THEN 'OK' ELSE 'BROKEN' END;
  EXCEPTION WHEN OTHERS THEN r := r || ' | normal edit (parent phone): BROKEN ' || SQLERRM; END;

  BEGIN INSERT INTO public.subscriptions (organisation_id, parent_id, status) VALUES (org, parent, 'active'); r := r || ' | fake active membership: OPEN';
  EXCEPTION WHEN OTHERS THEN r := r || ' | fake active membership: BLOCKED'; END;

  BEGIN UPDATE public.subscriptions SET status = 'active' WHERE parent_id = parent; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || ' | flip own membership to active: ' || CASE WHEN n = 0 THEN 'BLOCKED' ELSE 'OPEN' END;
  EXCEPTION WHEN OTHERS THEN r := r || ' | flip own membership to active: BLOCKED'; END;

  BEGIN INSERT INTO public.promo_codes (organisation_id, code, discount_type, discount_value) VALUES (org, 'HACK100', 'percentage', 100); r := r || ' | parent makes 100% code: OPEN';
  EXCEPTION WHEN OTHERS THEN r := r || ' | parent makes 100% code: BLOCKED'; END;

  SELECT count(*) INTO n FROM public.leads;
  r := r || ' | parent reads leads: ' || CASE WHEN n = 0 THEN 'BLOCKED' ELSE 'OPEN (' || n || ')' END;

  SELECT count(*) INTO n FROM public.promo_codes;
  r := r || ' | parent reads codes: ' || CASE WHEN n = 0 THEN 'BLOCKED' ELSE 'OPEN (' || n || ')' END;

  BEGIN
    res := public.enrol_if_capacity_available('426f782e-a83a-420c-9542-707de11fec39', 'c10da5fb-5ba5-483d-999b-e41e01505f93', org, 'active', NULL);
    r := r || ' | parent free enrol: ' || CASE WHEN res->>'error' = 'not_allowed' THEN 'BLOCKED' ELSE 'OPEN ' || res::text END;
  EXCEPTION WHEN OTHERS THEN r := r || ' | parent free enrol: BLOCKED'; END;

  BEGIN UPDATE public.enrolments SET status = 'active' WHERE player_id = '426f782e-a83a-420c-9542-707de11fec39'; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || ' | parent edits enrolment: ' || CASE WHEN n = 0 THEN 'BLOCKED' ELSE 'OPEN' END;
  EXCEPTION WHEN OTHERS THEN r := r || ' | parent edits enrolment: BLOCKED'; END;

  -- Now the academy admin.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  BEGIN UPDATE public.organisations SET pilot = NOT COALESCE(pilot, false) WHERE id = org; r := r || ' | academy flips pilot/free: OPEN';
  EXCEPTION WHEN OTHERS THEN r := r || ' | academy flips pilot/free: BLOCKED'; END;

  BEGIN UPDATE public.organisations SET platform_subscription_status = 'active' WHERE id = org AND platform_subscription_status IS DISTINCT FROM 'active'; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || ' | academy marks £35 paid: ' || CASE WHEN n = 0 THEN 'n/a (already active)' ELSE 'OPEN' END;
  EXCEPTION WHEN OTHERS THEN r := r || ' | academy marks £35 paid: BLOCKED'; END;

  BEGIN UPDATE public.organisations SET stripe_account_id = 'acct_attacker' WHERE id = org; r := r || ' | academy changes payout account: OPEN';
  EXCEPTION WHEN OTHERS THEN r := r || ' | academy changes payout account: BLOCKED'; END;

  BEGIN UPDATE public.organisations SET name = name WHERE id = org; GET DIAGNOSTICS n = ROW_COUNT;
    r := r || ' | normal edit (academy name): ' || CASE WHEN n = 1 THEN 'OK' ELSE 'BROKEN' END;
  EXCEPTION WHEN OTHERS THEN r := r || ' | normal edit (academy name): BROKEN ' || SQLERRM; END;

  RESET ROLE;
  RAISE EXCEPTION 'SELF-TEST RESULTS (nothing was saved): %', r;
END $$;
