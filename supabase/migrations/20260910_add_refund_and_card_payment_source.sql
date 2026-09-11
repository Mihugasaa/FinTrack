-- ==============================================================================
-- MIGRACIÓN FINTRACK: SOPORTE NATIVO DE REEMBOLSOS Y ORIGEN DE ABONOS EN BD
-- ==============================================================================
-- Esta migración ataca el problema de raíz en la base de datos PostgreSQL de Supabase.
-- Añade soporte nativo para marcar reembolsos/devoluciones de dinero y rastrear
-- el origen del abono a las tarjetas de crédito (Débito, Reembolso Comercio, Saldo a Favor).

-- 1. Soporte de Reembolsos en Transacciones (Gastos negativos / devoluciones a favor)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT FALSE;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN transactions.is_refund IS 'Indica si el movimiento es un reembolso o nota de crédito que disminuye el gasto neto';

-- 2. Soporte de Tipo de Origen en Abonos / Pagos a Tarjetas de Crédito
ALTER TABLE card_payments 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'DEBIT_ACCOUNT';

-- 3. Campo de notas/comprobante en abonos de tarjetas
ALTER TABLE card_payments 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN card_payments.source_type IS 'Origen del abono: DEBIT_ACCOUNT (cuenta bancaria débito), MERCHANT_REFUND (devolución de comercio directo a TC), BANK_CREDIT (saldo a favor preexistente)';
