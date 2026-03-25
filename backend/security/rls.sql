-- PostgreSQL Row Level Security baseline
-- Apply this to every user-owned table.

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artifacts_select_own ON public.artifacts;
CREATE POLICY artifacts_select_own
  ON public.artifacts
  FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS artifacts_insert_own ON public.artifacts;
CREATE POLICY artifacts_insert_own
  ON public.artifacts
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS artifacts_update_own ON public.artifacts;
CREATE POLICY artifacts_update_own
  ON public.artifacts
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS artifacts_delete_own ON public.artifacts;
CREATE POLICY artifacts_delete_own
  ON public.artifacts
  FOR DELETE
  USING (owner_id = auth.uid());
