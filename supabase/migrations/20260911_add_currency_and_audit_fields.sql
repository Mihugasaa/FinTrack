-- ==============================================================================
-- MIGRACIÓN FINTRACK: MONEDA Y TRAZABILIDAD CAMBIARIA EN PRÉSTAMOS Y DEUDAS
-- ==============================================================================
-- Garantiza la persistencia nativa en Supabase/PostgreSQL de la moneda (USD/PEN),
-- el tipo de cambio oficial de la fecha de la operación y el contravalor en soles.

-- 1. Actualizar tabla de Cuentas por Cobrar (Receivables / Préstamos a Terceros)
ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS currency currency_code DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS amount_pen NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS loan_date DATE DEFAULT CURRENT_DATE;

-- 2. Actualizar tabla de Deudas por Pagar (Payables / Dinero que me prestaron)
ALTER TABLE public.payables 
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS amount_pen NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS issue_date DATE DEFAULT CURRENT_DATE;

-- 3. Índices para trazabilidad de moneda y fechas
CREATE INDEX IF NOT EXISTS idx_receivables_currency ON public.receivables(currency);
CREATE INDEX IF NOT EXISTS idx_receivables_loan_date ON public.receivables(loan_date);
CREATE INDEX IF NOT EXISTS idx_payables_currency ON public.payables(currency);
CREATE INDEX IF NOT EXISTS idx_payables_issue_date ON public.payables(issue_date);
