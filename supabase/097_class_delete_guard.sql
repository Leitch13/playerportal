-- 097 — Class-delete guard: block deleting a class that still has member
-- history hanging off it.
--
-- Why: enrolments.group_id, attendance.group_id and session_notes.group_id
-- were ON DELETE CASCADE (schema.sql / 004), so the dashboard's class Delete
-- button — a raw client-side training_groups.delete() — silently and
-- unrecoverably destroyed every enrolment, attendance record and coach
-- session note for the class. 056 hardened the other FKs (SET NULL) but
-- missed these three. RESTRICT inverts the failure mode: deleting a class
-- with history now fails atomically at the DB, from ANY client (UI, API,
-- PostgREST, scripts); deleting a genuinely empty class still works.
--
-- Deliberately left CASCADE: waitlist.group_id and
-- makeup_bookings.missed_group_id — transient rows whose meaning dies with
-- the class.
--
-- Rollback: re-run the DO block below with RESTRICT swapped for CASCADE.

DO $$
DECLARE
  target record;
  con record;
  added int := 0;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('enrolments',    'group_id'),
      ('attendance',    'group_id'),
      ('session_notes', 'group_id')
    ) AS t(tbl, col)
  LOOP
    -- Drop by discovery, not by assumed name: if the live constraint name
    -- differs from the <table>_<col>_fkey default, a name-based DROP IF
    -- EXISTS would silently no-op and leave the CASCADE in place.
    FOR con IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_class frel ON frel.oid = c.confrelid
      WHERE c.contype = 'f'
        AND nsp.nspname = 'public'
        AND rel.relname = target.tbl
        AND frel.relname = 'training_groups'
        AND (
          SELECT array_agg(att.attname)
          FROM unnest(c.conkey) AS k
          JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = k
        ) = ARRAY[target.col]::name[]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', target.tbl, con.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.training_groups(id) ON DELETE RESTRICT',
      target.tbl, target.tbl || '_' || target.col || '_fkey', target.col
    );
    added := added + 1;
  END LOOP;

  IF added <> 3 THEN
    RAISE EXCEPTION 'class-delete guard: expected 3 RESTRICT constraints, added %', added;
  END IF;
END $$;
