-- ==============================================================================
-- Corrige las alertas del Security Advisor de Supabase (de raíz, sin parches)
-- ==============================================================================

-- 1) ERROR: view_monthly_summary corría como SECURITY DEFINER (permisos del creador,
--    se saltaba la RLS). Con security_invoker respeta la RLS del usuario que consulta.
ALTER VIEW public.view_monthly_summary SET (security_invoker = true);

-- 2) WARNING (function_search_path_mutable): las funciones no fijaban search_path.
--    Se recrean con `SET search_path = ''` y TODOS los objetos calificados por esquema
--    (public.*), que es la forma robusta: la función no puede resolver objetos de otro
--    esquema inyectado. Se recrea el cuerpo completo (no basta ALTER: con search_path
--    vacío los nombres sin calificar dejarían de resolverse).

CREATE OR REPLACE FUNCTION public.fn_calculate_payment_due_date(
    p_date DATE,
    p_payment_method_id UUID
) RETURNS DATE AS $$
DECLARE
    v_type public.payment_method_type;
    v_corte INT;
    v_pago INT;
    v_exp_day INT;
    v_cierre_date DATE;
    v_due_date DATE;
BEGIN
    SELECT type, billing_close_day, payment_due_day
    INTO v_type, v_corte, v_pago
    FROM public.payment_methods
    WHERE id = p_payment_method_id;

    IF v_type IS NULL OR v_type <> 'credit' OR v_corte IS NULL OR v_corte <= 0 THEN
        RETURN p_date;
    END IF;

    v_exp_day := EXTRACT(DAY FROM p_date);

    IF v_exp_day <= v_corte THEN
        v_cierre_date := (DATE_TRUNC('month', p_date) + (v_corte - 1) * INTERVAL '1 day')::DATE;
    ELSE
        v_cierre_date := (DATE_TRUNC('month', p_date + INTERVAL '1 month') + (v_corte - 1) * INTERVAL '1 day')::DATE;
    END IF;

    IF v_pago IS NULL OR v_pago = 0 THEN
        RETURN v_cierre_date;
    END IF;

    IF v_pago > v_corte THEN
        v_due_date := (DATE_TRUNC('month', v_cierre_date) + (v_pago - 1) * INTERVAL '1 day')::DATE;
    ELSE
        v_due_date := (DATE_TRUNC('month', v_cierre_date + INTERVAL '1 month') + (v_pago - 1) * INTERVAL '1 day')::DATE;
    END IF;

    RETURN v_due_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.trg_calculate_transaction_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.currency = 'USD'::public.currency_code AND NEW.exchange_rate IS NOT NULL AND NEW.exchange_rate > 0 THEN
        NEW.amount_pen := ROUND(NEW.original_amount * NEW.exchange_rate, 2);
    ELSE
        NEW.amount_pen := NEW.original_amount;
    END IF;

    IF NEW.payment_due_date IS NULL THEN
        NEW.payment_due_date := public.fn_calculate_payment_due_date(NEW.date, NEW.payment_method_id);
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- El trigger sigue apuntando a la misma función (recreada). No requiere cambios,
-- pero se re-vincula por claridad.
DROP TRIGGER IF EXISTS trg_transactions_before_upsert ON public.transactions;
CREATE TRIGGER trg_transactions_before_upsert
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_calculate_transaction_fields();

-- 3) WARNING (Leaked Password Protection Disabled): NO es SQL, es un ajuste de Auth.
--    Actívalo en el Dashboard: Authentication > Policies (Password) > habilitar
--    "Leaked password protection" (verifica contra HaveIBeenPwned). No hay forma de
--    hacerlo por migración; queda documentado aquí.
