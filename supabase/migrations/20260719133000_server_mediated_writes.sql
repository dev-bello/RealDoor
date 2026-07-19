-- Trusted extraction and audit writes are performed by authenticated server
-- functions through the server-only service-role client. Browsers retain read
-- access to their own rows so the review workflow remains RLS-isolated.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.extractions FROM authenticated;
REVOKE INSERT, DELETE ON TABLE public.audit_log FROM authenticated;

DROP POLICY IF EXISTS "Owners insert extractions" ON public.extractions;
DROP POLICY IF EXISTS "Owners update extractions" ON public.extractions;
DROP POLICY IF EXISTS "Owners delete extractions" ON public.extractions;
DROP POLICY IF EXISTS "Owners insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Owners delete audit log" ON public.audit_log;

DROP POLICY IF EXISTS "Owners read uploads" ON storage.objects;
DROP POLICY IF EXISTS "Owners write uploads" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete uploads" ON storage.objects;

ALTER TABLE public.extractions
  ADD CONSTRAINT extractions_confirmed_fields_allowlisted
  CHECK (
    confirmed_json IS NULL OR
    confirmed_json - ARRAY[
      'person_name', 'household_size', 'address', 'application_date',
      'pay_date', 'pay_period_start', 'pay_period_end', 'pay_frequency',
      'regular_hours', 'hourly_rate', 'gross_pay', 'net_pay',
      'document_date', 'weekly_hours', 'monthly_benefit',
      'benefit_frequency', 'statement_month', 'gross_receipts', 'platform_fees'
    ]::text[] = '{}'::jsonb
  ) NOT VALID;

ALTER TABLE public.extractions VALIDATE CONSTRAINT extractions_raw_json_object;
ALTER TABLE public.extractions VALIDATE CONSTRAINT extractions_confirmed_json_object;
ALTER TABLE public.extractions VALIDATE CONSTRAINT extractions_confidence_range;
ALTER TABLE public.audit_log VALIDATE CONSTRAINT audit_log_details_object;
