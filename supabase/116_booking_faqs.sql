-- 116: per-academy FAQs on the public booking page.
-- The five FAQs were hard-coded and identical for every academy (Jay Rosa
-- asked to remove or replace them, 10 Sep 2026). NULL = show the standard
-- five (today's behaviour); [] = hide the section; an array of {q,a} = the
-- academy's own questions, in order.
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS booking_faqs jsonb;
