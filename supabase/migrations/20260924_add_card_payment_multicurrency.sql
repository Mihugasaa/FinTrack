-- ==============================================================================
-- MIGRACIÓN FINTRACK: SOPORTE BIMONEDA Y TIPO DE CAMBIO EN ABONOS A TARJETAS
-- ==============================================================================
-- Permite registrar abonos a tarjetas de crédito en Dólares (USD) o Soles (PEN),
-- guardando el tipo de cambio efectivo aplicado (tasa de mercado o preferencial)
-- y el contravalor exacto en Soles (amount_pen) para descontar con precisión de
-- la cuenta de ahorros (saldo débito).

-- 1. Añadir columnas de moneda y tipo de cambio a card_payments
ALTER TABLE public.card_payments
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS amount_pen NUMERIC(12, 2);

-- 2. Poblar retroactivamente registros anteriores si existen
UPDATE public.card_payments
SET 
  currency = COALESCE(currency, 'PEN'),
  original_amount = COALESCE(original_amount, amount_paid),
  exchange_rate = COALESCE(exchange_rate, 1.0000),
  amount_pen = COALESCE(amount_pen, amount_paid)
WHERE amount_pen IS NULL;

-- 3. Índices para trazabilidad y consultas por moneda
CREATE INDEX IF NOT EXISTS idx_card_payments_currency ON public.card_payments(currency);
CREATE INDEX IF NOT EXISTS idx_card_payments_date ON public.card_payments(payment_date);

-- 4. Comentarios descriptivos
COMMENT ON COLUMN public.card_payments.currency IS 'Moneda del abono realizado: PEN o USD';
COMMENT ON COLUMN public.card_payments.original_amount IS 'Monto nominal en la moneda del pago (ej. 100.00 USD)';
COMMENT ON COLUMN public.card_payments.exchange_rate IS 'Tipo de cambio aplicado para la operación';
COMMENT ON COLUMN public.card_payments.amount_pen IS 'Contravalor en Soles efectivamente debitado de la cuenta bancaria';
