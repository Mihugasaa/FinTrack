-- ==============================================================================
-- MIGRACIÓN FINTRACK: SOPORTE DE IMPUESTO A LAS TRANSACCIONES FINANCIERAS (ITF)
-- ==============================================================================
-- Registra el ITF (0.005%) retenido por los bancos peruanos al realizar abonos
-- o transferencias a tarjetas de crédito desde cuentas de débito/ahorros,
-- permitiendo que el saldo débito y el flujo de caja coincidan al céntimo.

-- 1. Añadir columna itf_amount a card_payments
ALTER TABLE public.card_payments
  ADD COLUMN IF NOT EXISTS itf_amount NUMERIC(8, 2) DEFAULT 0.00;

-- 2. Poblar retroactivamente registros anteriores en cero si es null
UPDATE public.card_payments
SET itf_amount = 0.00
WHERE itf_amount IS NULL;

-- 3. Comentario explicativo
COMMENT ON COLUMN public.card_payments.itf_amount IS 'Monto retenido por ITF bancario (0.005% con redondeo oficial SUNAT/SBS a 5 céntimos)';
