-- Keep the browser-facing API limited to the operations the app performs.
REVOKE ALL ON TABLE public.extractions FROM anon, authenticated;
REVOKE ALL ON TABLE public.audit_log FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.extractions TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.audit_log TO authenticated;

ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own extractions" ON public.extractions;
DROP POLICY IF EXISTS "Users read their own audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Users insert their own audit log" ON public.audit_log;

CREATE POLICY "Owners read extractions"
  ON public.extractions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Owners insert extractions"
  ON public.extractions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Owners update extractions"
  ON public.extractions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Owners delete extractions"
  ON public.extractions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Owners read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Owners insert audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Owners delete audit log"
  ON public.audit_log FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

ALTER TABLE public.extractions
  ADD CONSTRAINT extractions_doc_type_allowed
  CHECK (doc_type IN ('application_summary', 'pay_stub', 'employment_letter', 'benefit_letter', 'gig_statement', 'gig_income_corroboration')) NOT VALID,
  ADD CONSTRAINT extractions_raw_json_object
  CHECK (raw_json IS NULL OR jsonb_typeof(raw_json) = 'object') NOT VALID,
  ADD CONSTRAINT extractions_confirmed_json_object
  CHECK (confirmed_json IS NULL OR jsonb_typeof(confirmed_json) = 'object') NOT VALID,
  ADD CONSTRAINT extractions_confidence_range
  CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1) NOT VALID;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_details_object
  CHECK (details IS NULL OR jsonb_typeof(details) = 'object') NOT VALID;

-- The application already references this bucket. Keep it private and idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users read own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users write own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own uploads" ON storage.objects;

CREATE POLICY "Owners read uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Owners write uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Owners delete uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
