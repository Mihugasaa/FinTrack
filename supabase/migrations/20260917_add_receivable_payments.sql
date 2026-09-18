-- ============================================================================
-- Migración: Tabla de Cobros / Amortizaciones de Préstamos (Receivable Payments)
-- ============================================================================

-- 1. Tabla de Cobros de Préstamos Otorgados a Terceros
CREATE TABLE IF NOT EXISTS public.receivable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_id UUID NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_receivable_payments_receivable_id ON public.receivable_payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_payment_date ON public.receivable_payments(payment_date);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (RLS) para Receivable Payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'receivable_payments' AND policyname = 'Usuarios gestionan cobros de sus préstamos'
    ) THEN
        CREATE POLICY "Usuarios gestionan cobros de sus préstamos"
        ON public.receivable_payments
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.receivables
                WHERE public.receivables.id = receivable_payments.receivable_id
                AND public.receivables.user_id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.receivables
                WHERE public.receivables.id = receivable_payments.receivable_id
                AND public.receivables.user_id = auth.uid()
            )
        );
    END IF;
END $$;
