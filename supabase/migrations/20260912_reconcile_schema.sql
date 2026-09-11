-- ==============================================================================
-- FINTRACK: RECONCILE LIVE SCHEMA WITH THE COLUMNS THE APP EXPECTS
-- ==============================================================================
-- Idempotent. Run once in the Supabase SQL Editor on databases created before
-- the currency/audit and credit-limit columns were introduced. Safe to re-run.

-- payment_methods: credit limit applies to credit cards only.
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2);
-- Drop any legacy default that would fill debit/cash rows, and clear those rows.
ALTER TABLE public.payment_methods ALTER COLUMN credit_limit DROP DEFAULT;
UPDATE public.payment_methods SET credit_limit = NULL WHERE type <> 'credit';

-- payables: currency, exchange rate, PEN equivalent, issue date
ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS amount_pen NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS issue_date DATE DEFAULT CURRENT_DATE;

-- receivables: currency, exchange rate, PEN equivalent, loan date
ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS currency currency_code DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS amount_pen NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS loan_date DATE DEFAULT CURRENT_DATE;

-- transactions: refund flag
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT FALSE;

-- card_payments: payment origin + notes
ALTER TABLE public.card_payments
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'DEBIT_ACCOUNT',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Refresh the PostgREST schema cache so the API sees the new columns at once.
NOTIFY pgrst, 'reload schema';
