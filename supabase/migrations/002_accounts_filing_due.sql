-- Optional: statutory accounts filing due date from Companies House (next_accounts.due_on).
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS accounts_filing_due_date DATE;

COMMENT ON COLUMN public.clients.accounts_filing_due_date IS 'Next statutory accounts filing due (Companies House next_accounts.due_on).';
