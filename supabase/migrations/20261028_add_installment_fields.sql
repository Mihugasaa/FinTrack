-- Migración para soporte de primera clase de compras en cuotas en transactions
-- Permite rastrear la pertenencia a un plan de cuotas, el progreso (cuota i de N)
-- y el monto original de la compra diferida.

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS is_installment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS installment_plan_id TEXT,
ADD COLUMN IF NOT EXISTS current_installment INT,
ADD COLUMN IF NOT EXISTS total_installments INT,
ADD COLUMN IF NOT EXISTS original_total_amount NUMERIC(12, 2);

-- Índices de consulta rápida para amortizaciones y agregaciones por plan de cuotas
CREATE INDEX IF NOT EXISTS idx_transactions_installment_plan ON public.transactions(installment_plan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_installment ON public.transactions(is_installment);

COMMENT ON COLUMN public.transactions.is_installment IS 'Indica si el movimiento pertenece a un plan de compras en cuotas diferidas';
COMMENT ON COLUMN public.transactions.installment_plan_id IS 'Identificador único del plan de cuotas que agrupa todas las cuotas de la misma compra';
COMMENT ON COLUMN public.transactions.current_installment IS 'Número de la cuota actual (1..N)';
COMMENT ON COLUMN public.transactions.total_installments IS 'Número total de cuotas del plan (N)';
COMMENT ON COLUMN public.transactions.original_total_amount IS 'Monto total original de la compra diferida';
