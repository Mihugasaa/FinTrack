-- ==============================================================================
-- Migración: Índices de Alto Rendimiento para Consultas y RLS en PostgreSQL
-- ==============================================================================

-- 1. Transacciones (Gastos y Movimientos)
-- Acelera el filtrado por usuario y rango de fechas (mes activo e historial completo)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);

-- Acelera el cálculo de cuotas y estados de cuenta de tarjeta por fecha de vencimiento
CREATE INDEX IF NOT EXISTS idx_transactions_user_payment_due_date ON public.transactions(user_id, payment_due_date);

-- Acelera las uniones con los periodos mensuales
CREATE INDEX IF NOT EXISTS idx_transactions_monthly_period_id ON public.transactions(monthly_period_id);

-- 2. Abonos y Pagos a Tarjetas de Crédito
CREATE INDEX IF NOT EXISTS idx_card_payments_user_payment_date ON public.card_payments(user_id, payment_date DESC);

-- 3. Otros Ingresos
CREATE INDEX IF NOT EXISTS idx_other_incomes_user_received_date ON public.other_incomes(user_id, received_date DESC);

-- 4. Deudas por Pagar a Acreedores (Payables)
CREATE INDEX IF NOT EXISTS idx_payables_user_id ON public.payables(user_id);

-- Acelera la comprobación de la política RLS en payable_payments (evita Sequential Scan)
CREATE INDEX IF NOT EXISTS idx_payable_payments_payable_id ON public.payable_payments(payable_id);

-- 5. Cuentas por Cobrar a Terceros (Receivables)
CREATE INDEX IF NOT EXISTS idx_receivables_user_id ON public.receivables(user_id);
