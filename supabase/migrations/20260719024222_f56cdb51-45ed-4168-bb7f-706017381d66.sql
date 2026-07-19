
-- Extractions: one row per uploaded doc, per user (anonymous or otherwise)
CREATE TABLE public.extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_path TEXT,
  raw_json JSONB,
  confirmed_json JSONB,
  confidence NUMERIC,
  corrected BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extractions TO authenticated;
GRANT ALL ON public.extractions TO service_role;

ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own extractions"
  ON public.extractions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audit log: consent, corrections, deletions. Never stores raw doc content.
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  rule_version TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own audit log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Storage policies on the 'uploads' bucket: files prefixed by user id
CREATE POLICY "Users read own uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users write own uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
