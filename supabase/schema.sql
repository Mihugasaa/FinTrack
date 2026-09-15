-- ==============================================================================
-- FINTRACK WEB - SUPABASE POSTGRESQL SCHEMA
-- Sistema Inteligente de Control de Gastos, Ciclos de Tarjetas y Flujo de Caja
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TIPOS PERSONALIZADOS (ENUMS)
DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('debit', 'credit', 'cash');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE currency_code AS ENUM ('PEN', 'USD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE receivable_status AS ENUM ('pending', 'partial', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLA DE PERFILES DE USUARIO
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    base_currency currency_code DEFAULT 'PEN',
    default_salary NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE CATEGORÍAS
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'tag',
    color TEXT DEFAULT '#64748b',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE MEDIOS DE PAGO Y TARJETAS
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type payment_method_type NOT NULL DEFAULT 'debit',
    billing_close_day INT CHECK (billing_close_day BETWEEN 1 AND 31),
    payment_due_day INT CHECK (payment_due_day BETWEEN 1 AND 31),
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'credit-card',
    is_active BOOLEAN DEFAULT TRUE,
    credit_limit NUMERIC(12, 2) DEFAULT 4000.00,
    initial_debt NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE PERIODOS MENSUALES (PRESUPUESTOS)
CREATE TABLE IF NOT EXISTS monthly_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    base_salary NUMERIC(12, 2) DEFAULT 0.00,
    initial_debit_balance NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year, month)
);

-- 7. TABLA DE OTROS INGRESOS
CREATE TABLE IF NOT EXISTS other_incomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monthly_period_id UUID NOT NULL REFERENCES monthly_periods(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    received_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA DE TRANSACCIONES (GASTOS)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monthly_period_id UUID NOT NULL REFERENCES monthly_periods(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT,
    currency currency_code NOT NULL DEFAULT 'PEN',
    original_amount NUMERIC(12, 2) NOT NULL,
    exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
    amount_pen NUMERIC(12, 2) NOT NULL,
    payment_due_date DATE NOT NULL,
    is_fixed_subscription BOOLEAN DEFAULT FALSE,
    is_refund BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA DE CUENTAS POR COBRAR A TERCEROS
CREATE TABLE IF NOT EXISTS receivables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_period_id UUID REFERENCES monthly_periods(id) ON DELETE SET NULL,
    debtor_name TEXT NOT NULL,
    description TEXT,
    original_amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(12, 2) GENERATED ALWAYS AS (original_amount - paid_amount) STORED,
    status receivable_status DEFAULT 'pending',
    currency currency_code DEFAULT 'PEN',
    exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
    amount_pen NUMERIC(12, 2),
    loan_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABLA DE PAGOS Y ABONOS A TARJETAS
CREATE TABLE IF NOT EXISTS card_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_period_id UUID NOT NULL REFERENCES monthly_periods(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source_type TEXT DEFAULT 'DEBIT_ACCOUNT',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10B. TABLA DE DEUDAS POR PAGAR (Acreedores) Y AMORTIZACIONES
CREATE TABLE IF NOT EXISTS payables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creditor_name TEXT NOT NULL,
    description TEXT,
    original_amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(12, 2) GENERATED ALWAYS AS (original_amount - paid_amount) STORED,
    currency TEXT DEFAULT 'PEN',
    exchange_rate NUMERIC(8, 4) DEFAULT 1.0000,
    amount_pen NUMERIC(12, 2),
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'PENDING', 'PARTIALLY_PAID', 'PAID')),
    is_credited_to_debit BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payable_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payable_id UUID NOT NULL REFERENCES payables(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- 11. FUNCIÓN DE CÁLCULO DE FECHA DE PAGO (CICLO DE TARJETAS)
-- Réplica exacta de la fórmula matemática del Excel
-- ==============================================================================
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
    -- Obtener datos del método de pago
    SELECT type, billing_close_day, payment_due_day
    INTO v_type, v_corte, v_pago
    FROM public.payment_methods
    WHERE id = p_payment_method_id;

    -- Si es débito o efectivo, el pago es inmediato
    IF v_type IS NULL OR v_type <> 'credit' OR v_corte IS NULL OR v_corte <= 0 THEN
        RETURN p_date;
    END IF;

    v_exp_day := EXTRACT(DAY FROM p_date);

    -- 1. Determinar fecha de cierre de facturación
    IF v_exp_day <= v_corte THEN
        -- Cierre en el mes actual del gasto
        v_cierre_date := (DATE_TRUNC('month', p_date) + (v_corte - 1) * INTERVAL '1 day')::DATE;
    ELSE
        -- Cierre en el mes siguiente
        v_cierre_date := (DATE_TRUNC('month', p_date + INTERVAL '1 month') + (v_corte - 1) * INTERVAL '1 day')::DATE;
    END IF;

    -- 2. Determinar fecha límite de pago
    IF v_pago IS NULL OR v_pago = 0 THEN
        RETURN v_cierre_date;
    END IF;

    IF v_pago > v_corte THEN
        -- El pago vence en el mismo mes del cierre
        v_due_date := (DATE_TRUNC('month', v_cierre_date) + (v_pago - 1) * INTERVAL '1 day')::DATE;
    ELSE
        -- El pago vence en el mes posterior al cierre
        v_due_date := (DATE_TRUNC('month', v_cierre_date + INTERVAL '1 month') + (v_pago - 1) * INTERVAL '1 day')::DATE;
    END IF;

    RETURN v_due_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = '';

-- Trigger automático para calcular amount_pen y payment_due_date antes de insertar/actualizar
CREATE OR REPLACE FUNCTION public.trg_calculate_transaction_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular monto en soles
    IF NEW.currency = 'USD'::public.currency_code AND NEW.exchange_rate IS NOT NULL AND NEW.exchange_rate > 0 THEN
        NEW.amount_pen := ROUND(NEW.original_amount * NEW.exchange_rate, 2);
    ELSE
        NEW.amount_pen := NEW.original_amount;
    END IF;

    -- Calcular fecha de pago si no viene explícita
    IF NEW.payment_due_date IS NULL THEN
        NEW.payment_due_date := public.fn_calculate_payment_due_date(NEW.date, NEW.payment_method_id);
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS trg_transactions_before_upsert ON transactions;
CREATE TRIGGER trg_transactions_before_upsert
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_calculate_transaction_fields();

-- ==============================================================================
-- 12. VISTA DE SALUD FINANCIERA MENSUAL (¿PUEDO CUBRIR ESTE MES?)
-- ==============================================================================
-- security_invoker: la vista respeta las políticas RLS del usuario que consulta
-- (cada quien ve solo sus filas), en lugar de las del creador de la vista.
CREATE OR REPLACE VIEW view_monthly_summary WITH (security_invoker = true) AS
WITH period_totals AS (
    SELECT 
        mp.id AS monthly_period_id,
        mp.user_id,
        mp.year,
        mp.month,
        mp.base_salary,
        mp.initial_debit_balance,
        COALESCE(SUM(oi.amount), 0) AS other_incomes_total,
        (mp.base_salary + COALESCE(SUM(oi.amount), 0)) AS total_income
    FROM monthly_periods mp
    LEFT JOIN other_incomes oi ON oi.monthly_period_id = mp.id
    GROUP BY mp.id, mp.user_id, mp.year, mp.month, mp.base_salary, mp.initial_debit_balance
),
expenses_consumed AS (
    SELECT 
        monthly_period_id,
        COALESCE(SUM(amount_pen), 0) AS total_consumed_expenses
    FROM transactions
    GROUP BY monthly_period_id
),
receivables_summary AS (
    SELECT 
        monthly_period_id,
        COALESCE(SUM(original_amount), 0) AS total_receivables,
        COALESCE(SUM(paid_amount), 0) AS collected_receivables,
        COALESCE(SUM(remaining_amount), 0) AS pending_receivables
    FROM receivables
    GROUP BY monthly_period_id
),
real_cash_outflows AS (
    -- Salida real del mes: Pagos que vencen en este mes calendario
    SELECT 
        t.user_id,
        EXTRACT(YEAR FROM t.payment_due_date)::INT AS due_year,
        EXTRACT(MONTH FROM t.payment_due_date)::INT AS due_month,
        COALESCE(SUM(t.amount_pen), 0) AS real_outflow_amount
    FROM transactions t
    GROUP BY t.user_id, EXTRACT(YEAR FROM t.payment_due_date), EXTRACT(MONTH FROM t.payment_due_date)
)
SELECT 
    pt.monthly_period_id,
    pt.user_id,
    pt.year,
    pt.month,
    pt.base_salary,
    pt.other_incomes_total,
    pt.total_income,
    pt.initial_debit_balance,
    COALESCE(ec.total_consumed_expenses, 0) AS total_consumed_expenses,
    (pt.total_income - COALESCE(ec.total_consumed_expenses, 0)) AS simple_remaining,
    COALESCE(rs.pending_receivables, 0) AS pending_receivables,
    (COALESCE(ec.total_consumed_expenses, 0) - COALESCE(rs.pending_receivables, 0)) AS net_expenses,
    COALESCE(rco.real_outflow_amount, 0) AS real_cash_outflow,
    -- Diagnóstico de liquidez: Disponible vs Salida real
    (pt.initial_debit_balance + pt.total_income + COALESCE(rs.collected_receivables, 0)) AS total_available,
    ( (pt.initial_debit_balance + pt.total_income + COALESCE(rs.collected_receivables, 0)) - COALESCE(rco.real_outflow_amount, 0) ) AS liquidity_margin,
    CASE 
        WHEN ( (pt.initial_debit_balance + pt.total_income + COALESCE(rs.collected_receivables, 0)) - COALESCE(rco.real_outflow_amount, 0) ) >= 0 
        THEN 'ALCANZA'
        ELSE 'NO_ALCANZA'
    END AS liquidity_status
FROM period_totals pt
LEFT JOIN expenses_consumed ec ON ec.monthly_period_id = pt.monthly_period_id
LEFT JOIN receivables_summary rs ON rs.monthly_period_id = pt.monthly_period_id
LEFT JOIN real_cash_outflows rco ON rco.user_id = pt.user_id AND rco.due_year = pt.year AND rco.due_month = pt.month;

-- 13. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payable_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para que cada usuario solo acceda a su información
CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage their own categories" ON categories FOR ALL USING (auth.uid() = user_id OR is_default = TRUE);
CREATE POLICY "Users can manage their own payment methods" ON payment_methods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their monthly periods" ON monthly_periods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their other incomes" ON other_incomes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their transactions" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their receivables" ON receivables FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their card payments" ON card_payments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their payables" ON payables FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their payable payments" ON payable_payments FOR ALL USING (
    EXISTS (SELECT 1 FROM payables WHERE payables.id = payable_payments.payable_id AND payables.user_id = auth.uid())
);
