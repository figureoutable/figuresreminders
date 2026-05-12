-- Optional: staff member / partner responsible for the client (display + reporting).
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS owner TEXT;

COMMENT ON COLUMN public.clients.owner IS 'Account owner or lead — free text (e.g. initials or name).';
