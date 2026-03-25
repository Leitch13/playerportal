-- 011: Enhanced class management
-- Adds age_group, description, price_per_session columns to training_groups

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_groups' AND column_name = 'age_group') THEN
    ALTER TABLE training_groups ADD COLUMN age_group TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_groups' AND column_name = 'description') THEN
    ALTER TABLE training_groups ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_groups' AND column_name = 'price_per_session') THEN
    ALTER TABLE training_groups ADD COLUMN price_per_session NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_groups' AND column_name = 'max_capacity') THEN
    ALTER TABLE training_groups ADD COLUMN max_capacity INTEGER DEFAULT 20;
  END IF;
END $$;
