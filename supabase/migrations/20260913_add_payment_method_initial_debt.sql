-- Deuda inicial arrastrada por tarjeta de crédito.
-- El dashboard ya la usaba en memoria (PaymentMethod.initialDebt) pero no se
-- persistía ni se leía de la nube, así que se perdía al refrescar. Esta columna
-- la vuelve durable. El servicio hace fallback si esta migración aún no se aplicó.
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS initial_debt NUMERIC(12, 2) DEFAULT 0.00;
