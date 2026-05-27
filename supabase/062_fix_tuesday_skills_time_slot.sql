-- 062: Fix Jamie Allan's Tuesday Skills time slot typo
-- Was "04:30–17:15" (AM start makes no sense), should be "16:30–17:15"
-- Verified via REST: id c97ad190-8011-4c95-9c24-81d008c54e39 on 2026-05-27
UPDATE public.training_groups
SET time_slot = '16:30–17:15'
WHERE id = 'c97ad190-8011-4c95-9c24-81d008c54e39'
  AND time_slot = '04:30–17:15';
