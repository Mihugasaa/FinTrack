-- ==============================================================================
-- MIGRACIÓN FINTRACK: TABLAS NATIVAS DE DEUDAS POR PAGAR (PAYABLES) Y PARIDAD TOTAL
-- ==============================================================================
-- Ejecutar este script en el SQL Editor de Supabase para tener persistencia nativa
-- completa de "Mis Deudas por Pagar a Personas" y sus amortizaciones.

-- 1. Tabla de Deudas por Pagar (Mis Deudas a Personas / Acreedores)
CREATE TABLE IF NOT EXISTS public.payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creditor_name TEXT NOT NULL,
    description TEXT,
    original_amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    is_credited_to_debit BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de Amortizaciones de Deudas (Historial de Pagos a Acreedores)
CREATE TABLE IF NOT EXISTS public.payable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payable_id UUID NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_payables_user_id ON public.payables(user_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON public.payables(status);
CREATE INDEX IF NOT EXISTS idx_payable_payments_payable_id ON public.payable_payments(payable_id);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_payments ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Seguridad (RLS) para Payables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payables' AND policyname = 'Usuarios gestionan sus propias deudas'
    ) THEN
        CREATE POLICY "Usuarios gestionan sus propias deudas"
        ON public.payables
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 6. Políticas de Seguridad (RLS) para Payable Payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payable_payments' AND policyname = 'Usuarios gestionan pagos de sus deudas'
    ) THEN
        CREATE POLICY "Usuarios gestionan pagos de sus deudas"
        ON public.payable_payments
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.payables
                WHERE public.payables.id = payable_payments.payable_id
                AND public.payables.user_id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.payables
                WHERE public.payables.id = payable_payments.payable_id
                AND public.payables.user_id = auth.uid()
            )
        );
    END IF;
END $$;
