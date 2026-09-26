-- ==============================================================================
-- MIGRACIÓN FINTRACK: AUDITORÍA Y VERIFICACIÓN NATIVA DE GASTOS EN POSTGRESQL
-- ==============================================================================
-- Permite persistir en base de datos la confirmación de gastos auditados
-- (ej. cobros legítimos no duplicados o gastos extraordinarios aceptados),
-- asegurando sincronización entre múltiples dispositivos (móvil, tablet, desktop).

-- 1. Agregar campo is_audit_confirmed a la tabla transactions
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS is_audit_confirmed BOOLEAN DEFAULT FALSE;

-- 2. Índice para acelerar el filtrado de transacciones auditadas
CREATE INDEX IF NOT EXISTS idx_transactions_audit_confirmed ON public.transactions(is_audit_confirmed);

-- 3. Preferencias de usuario en profiles para sincronización multi-dispositivo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
