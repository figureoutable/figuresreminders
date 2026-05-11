-- Figures Reminders — initial schema for clients, acknowledgements, and digest settings.
-- Run via Supabase CLI (`supabase db push`) or paste into the SQL editor.

-- ---------------------------------------------------------------------------
-- Clients: one row per engagement with dates used to derive rolling deadlines.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year_end_date DATE,
  confirmation_statement_date DATE,
  self_assessment_date DATE,
  vat_quarter_end_month INTEGER CHECK (
    vat_quarter_end_month IS NULL
    OR (
      vat_quarter_end_month >= 1
      AND vat_quarter_end_month <= 12
    )
  ),
  payroll_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS 'Source data for generated obligation deadlines (UK accounting firm internal tool).';

-- ---------------------------------------------------------------------------
-- Acknowledgements: staff check-off per concrete deadline instance (date + type).
-- Unique tuple prevents double-acknowledging the same obligation period.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deadline_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  obligation_type TEXT NOT NULL,
  deadline_date DATE NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by TEXT,
  CONSTRAINT deadline_acknowledgements_unique_deadline UNIQUE (client_id, obligation_type, deadline_date)
);

COMMENT ON TABLE public.deadline_acknowledgements IS 'Checked-off deadlines; digest and dashboard hide rows with a matching acknowledgement.';

CREATE INDEX IF NOT EXISTS idx_deadline_acknowledgements_client ON public.deadline_acknowledgements (client_id);

-- ---------------------------------------------------------------------------
-- Single-row app settings (digest recipient). Always upsert id = 1.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  digest_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS 'Singleton settings row (id must be 1). Resend API key stays in env only, never stored here.';

INSERT INTO public.app_settings (id, digest_email)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
