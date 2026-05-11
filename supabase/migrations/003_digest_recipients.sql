-- Replace single digest_email with a JSON list of { name, email } for multiple recipients.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS digest_recipients JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.app_settings
SET
  digest_recipients = jsonb_build_array(
    jsonb_build_object(
      'email',
      btrim(digest_email),
      'name',
      ''
    )
  )
WHERE
  id = 1
  AND digest_email IS NOT NULL
  AND btrim(digest_email) <> ''
  AND digest_recipients = '[]'::jsonb;

ALTER TABLE public.app_settings DROP COLUMN IF EXISTS digest_email;

COMMENT ON COLUMN public.app_settings.digest_recipients IS
  'Array of {"name": string, "email": string}; each email receives the Monday digest.';
