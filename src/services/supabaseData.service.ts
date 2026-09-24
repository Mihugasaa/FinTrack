/**
 * FINTRACK - SUPABASE DATA SERVICE
 * Implementa las operaciones completas de API: GET, POST, PUT, DELETE
 * Conecta el dashboard directamente con la base de datos PostgreSQL en la nube
 * Bajo Row Level Security (RLS) y autenticación JWT
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Transaction, PaymentMethod, Receivable, ReceivablePayment, Category, OtherIncome, Payable, PayablePayment, CardPayment } from '@/types';

const isUUID = (str?: string | null): boolean =>
  typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// Map any payable status to the lowercase values the schema CHECK accepts.
const normalizePayableStatus = (s?: string): 'pending' | 'partial' | 'paid' => {
  const v = (s || '').toString().toUpperCase();
  if (v === 'PAID') return 'paid';
  if (v === 'PARTIALLY_PAID' || v === 'PARTIAL') return 'partial';
  return 'pending';
};

export class SupabaseDataService {
  private static logSupabaseError(context: string, error: any) {
    const msg = typeof error === 'string' ? error : (error?.message || error?.details || JSON.stringify(error));
    if (
      msg?.includes('JWT') ||
      msg?.includes('future') ||
      msg?.includes('issued') ||
      msg?.includes('expired') ||
      msg?.includes('clock') ||
      msg?.includes('skew') ||
      msg?.includes('PGRST')
    ) {
      console.warn(`[Supabase Desfase Horario/JWT] ${context}: ${msg}. (Tu reloj local de Windows está en 2026 mientras el servidor Supabase está en tiempo real. Se maneja con fallback local sin interrumpir la app)`);
    } else {
      console.warn(`[Supabase] ${context}:`, msg);
    }
  }

  // Ejecutor resiliente con auto-reintento ante desfase de reloj (Clock Skew / Future JWT)
  public static async executeWithRetry<T = any[]>(
    operation: () => PromiseLike<{ data: T | null; error: any }>,
    context: string,
    maxRetries: number = 2
  ): Promise<{ data: T | null; error: any }> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      const res = await operation();
      if (!res.error) return res;

      const msg = typeof res.error === 'string' ? res.error : (res.error?.message || '');
      if (
        msg.includes('JWT') ||
        msg.includes('future') ||
        msg.includes('issued') ||
        msg.includes('PGRST301') ||
        msg.includes('clock')
      ) {
        attempt++;
        if (attempt <= maxRetries) {
          console.info(`[Supabase Auto-Sync] Desfase temporal detectado en ${context}. Reintentando en 2.5s para sincronizar reloj con el servidor (intento ${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 2500));
          continue;
        }
      }
      return res;
    }
    return { data: null, error: new Error('Exceeded max retries') };
  }

  // Obtener el ID del usuario autenticado en la sesión de Supabase
  private static async getAuthUserId(): Promise<string | null> {
    if (!supabase || !isSupabaseConfigured) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) return user.id;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) return session.user.id;

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('fintrack_current_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id && isUUID(parsed.id)) return parsed.id;
        }
      }
    } catch (e) {
      console.warn('No se pudo obtener el user_id de Supabase:', e);
    }
    return null;
  }

  // Asegurar o crear el periodo mensual en PostgreSQL (relación monthly_periods)
  public static async getOrCreateMonthlyPeriod(userId: string, dateStr: string): Promise<string | null> {
    if (!supabase || !isSupabaseConfigured) return null;
    try {
      const [yearStr, monthStr] = dateStr.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const { data: existing } = await supabase
        .from('monthly_periods')
        .select('id')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (existing?.id) return existing.id;

      const { data: created, error } = await supabase
        .from('monthly_periods')
        .insert({
          user_id: userId,
          year,
          month,
          base_salary: 0,
          initial_debit_balance: 0
        })
        .select('id')
        .single();

      if (error) {
        this.logSupabaseError('createMonthlyPeriod', error.message);
        return null;
      }
      return created?.id || null;
    } catch (e) {
      this.logSupabaseError('getOrCreateMonthlyPeriod (catch)', e);
      return null;
    }
  }

  // ============================================================================
  // 1. TRANSACCIONES (MOVIMIENTOS / GASTOS)
  // ============================================================================

  // GET: Obtener movimientos de un mes específico
  public static async getTransactions(monthKey: string): Promise<Transaction[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${monthKey}-01`;
      const endDate = `${monthKey}-${lastDay.toString().padStart(2, '0')}`;

      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('transactions')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        'getTransactions'
      );

      if (error || !data) {
        if (error) this.logSupabaseError('getTransactions', error.message);
        return null;
      }

      return data.map((row: any) => {
        let pmId = row.payment_method_id || '';
        if (!pmId && row.notes) {
          const m = row.notes.match(/\[pmId:([^\]]+)\]/);
          if (m && m[1]) pmId = m[1];
        }

        const isRefund = !!(row as any).is_refund ||
          (typeof row.notes === 'string' && (row.notes.includes('[isRefund:true]') || row.notes.includes('[refund]')));

        let anchorDay: number | undefined;
        if (typeof row.notes === 'string') {
          const am = row.notes.match(/\[anchorDay:(\d+)\]/);
          if (am && am[1]) anchorDay = parseInt(am[1], 10);
        }
        if (!anchorDay && row.date && !!row.is_fixed_subscription) {
          const parts = row.date.split('-');
          if (parts.length === 3) anchorDay = parseInt(parts[2], 10);
        }

        return {
          id: row.id,
          date: row.date,
          description: row.description,
          categoryId: row.category_id || '',
          paymentMethodId: pmId,
          currency: row.currency || 'PEN',
          originalAmount: parseFloat(row.original_amount),
          exchangeRate: parseFloat(row.exchange_rate || '1.0'),
          amountPen: parseFloat(row.amount_pen),
          paymentDueDate: row.payment_due_date,
          isFixedSubscription: !!row.is_fixed_subscription,
          isRefund: isRefund,
          notes: row.notes,
          createdAt: row.created_at || (row.notes ? (row.notes.match(/\[created:([^\]]+)\]/)?.[1]) : undefined) || undefined,
          anchorDay
        };
      });
    } catch (e) {
      this.logSupabaseError('getTransactions (catch)', e);
      return null;
    }
  }

  // GET: Historial COMPLETO de transacciones (sin filtro de mes).
  // Alimenta las vistas consolidadas (Anual / Analítica), donde el flujo mensual
  // debe derivarse de todos los movimientos reales y no solo del mes visible.
  public static async getAllTransactions(): Promise<Transaction[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('transactions')
          .select('*')
          .order('date', { ascending: false }),
        'getAllTransactions'
      );

      if (error || !data) {
        if (error) this.logSupabaseError('getAllTransactions', error.message);
        return null;
      }

      return data.map((row: any) => {
        let pmId = row.payment_method_id || '';
        if (!pmId && row.notes) {
          const m = row.notes.match(/\[pmId:([^\]]+)\]/);
          if (m && m[1]) pmId = m[1];
        }

        const isRefund = !!(row as any).is_refund ||
          (typeof row.notes === 'string' && (row.notes.includes('[isRefund:true]') || row.notes.includes('[refund]')));

        let anchorDay: number | undefined;
        if (typeof row.notes === 'string') {
          const am = row.notes.match(/\[anchorDay:(\d+)\]/);
          if (am && am[1]) anchorDay = parseInt(am[1], 10);
        }
        if (!anchorDay && row.date && !!row.is_fixed_subscription) {
          const parts = row.date.split('-');
          if (parts.length === 3) anchorDay = parseInt(parts[2], 10);
        }

        return {
          id: row.id,
          date: row.date,
          description: row.description,
          categoryId: row.category_id || '',
          paymentMethodId: pmId,
          currency: row.currency || 'PEN',
          originalAmount: parseFloat(row.original_amount),
          exchangeRate: parseFloat(row.exchange_rate || '1.0'),
          amountPen: parseFloat(row.amount_pen),
          paymentDueDate: row.payment_due_date,
          isFixedSubscription: !!row.is_fixed_subscription,
          isRefund: isRefund,
          notes: row.notes,
          createdAt: row.created_at || (row.notes ? (row.notes.match(/\[created:([^\]]+)\]/)?.[1]) : undefined) || undefined,
          anchorDay
        };
      });
    } catch (e) {
      this.logSupabaseError('getAllTransactions (catch)', e);
      return null;
    }
  }

  // GET: Obtener todas las suscripciones o gastos fijos recurrentes
  public static async getRecurringSubscriptions(): Promise<Transaction[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('transactions')
          .select('*')
          .eq('is_fixed_subscription', true)
          .order('date', { ascending: false }),
        'getRecurringSubscriptions'
      );

      if (error || !data) {
        if (error) this.logSupabaseError('getRecurringSubscriptions', error.message);
        return null;
      }

      return data.map((row: any) => {
        let pmId = row.payment_method_id || '';
        if (!pmId && row.notes) {
          const m = row.notes.match(/\[pmId:([^\]]+)\]/);
          if (m && m[1]) pmId = m[1];
        }

        const isRefund = !!(row as any).is_refund ||
          (typeof row.notes === 'string' && (row.notes.includes('[isRefund:true]') || row.notes.includes('[refund]')));

        let anchorDay: number | undefined;
        if (typeof row.notes === 'string') {
          const am = row.notes.match(/\[anchorDay:(\d+)\]/);
          if (am && am[1]) anchorDay = parseInt(am[1], 10);
        }
        if (!anchorDay && row.date && !!row.is_fixed_subscription) {
          const parts = row.date.split('-');
          if (parts.length === 3) anchorDay = parseInt(parts[2], 10);
        }

        return {
          id: row.id,
          date: row.date,
          description: row.description,
          categoryId: row.category_id || '',
          paymentMethodId: pmId,
          currency: row.currency || 'PEN',
          originalAmount: parseFloat(row.original_amount),
          exchangeRate: parseFloat(row.exchange_rate || '1.0'),
          amountPen: parseFloat(row.amount_pen),
          paymentDueDate: row.payment_due_date,
          isFixedSubscription: true,
          isRefund: isRefund,
          notes: row.notes,
          createdAt: row.created_at || (row.notes ? (row.notes.match(/\[created:([^\]]+)\]/)?.[1]) : undefined) || undefined,
          anchorDay
        };
      });
    } catch (e) {
      this.logSupabaseError('getRecurringSubscriptions (catch)', e);
      return null;
    }
  }

  // POST: Crear una nueva transacción
  public static async createTransaction(tx: Transaction): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) {
        console.warn('Usuario no autenticado en Supabase; guardando transacción en local');
        return false;
      }

      const monthlyPeriodId = await this.getOrCreateMonthlyPeriod(userId, tx.date);
      if (!monthlyPeriodId) return false;

      let finalNotes = tx.notes || '';
      if (tx.paymentMethodId && !finalNotes.includes('[pmId:')) {
        finalNotes = finalNotes ? `${finalNotes} [pmId:${tx.paymentMethodId}]` : `[pmId:${tx.paymentMethodId}]`;
      }
      if (tx.isRefund && !finalNotes.includes('[isRefund:true]')) {
        finalNotes = finalNotes ? `${finalNotes} [isRefund:true]` : `[isRefund:true]`;
      }
      if (tx.isFixedSubscription && tx.anchorDay && !finalNotes.includes('[anchorDay:')) {
        finalNotes = finalNotes ? `${finalNotes} [anchorDay:${tx.anchorDay}]` : `[anchorDay:${tx.anchorDay}]`;
      }

      const payload: Record<string, any> = {
        user_id: userId,
        monthly_period_id: monthlyPeriodId,
        date: tx.date,
        description: tx.description,
        currency: tx.currency || 'PEN',
        original_amount: tx.originalAmount,
        exchange_rate: tx.exchangeRate || 1.0,
        amount_pen: tx.amountPen,
        payment_due_date: tx.paymentDueDate,
        is_fixed_subscription: !!tx.isFixedSubscription,
        is_refund: !!tx.isRefund,
        notes: finalNotes || null
      };

      if (isUUID(tx.id)) {
        payload.id = tx.id;
      }
      if (isUUID(tx.categoryId)) {
        payload.category_id = tx.categoryId;
      }
      if (isUUID(tx.paymentMethodId)) {
        payload.payment_method_id = tx.paymentMethodId;
      }

      let { error } = await supabase.from('transactions').insert(payload);

      // Fallback si la migración de is_refund aún no se ejecutó en PostgreSQL
      if (error && error.message?.includes('is_refund')) {
        delete payload.is_refund;
        const retryRefund = await supabase.from('transactions').insert(payload);
        error = retryRefund.error;
      }

      if (error && (error.message?.includes('payment_method_id') || (error as any).code === '23503')) {
        console.warn('Foreign key violada para payment_method_id, insertando con fallback de notas:', error.message);
        delete payload.payment_method_id;
        const retry = await supabase.from('transactions').insert(payload);
        error = retry.error;
      }

      if (error) {
        this.logSupabaseError('createTransaction (POST)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('createTransaction (catch)', e);
      return false;
    }
  }

  // PUT: Actualizar una transacción existente
  public static async updateTransaction(tx: Transaction): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(tx.id)) return false;

    try {
      let finalNotes = tx.notes || '';
      if (tx.paymentMethodId && !finalNotes.includes('[pmId:')) {
        finalNotes = finalNotes ? `${finalNotes} [pmId:${tx.paymentMethodId}]` : `[pmId:${tx.paymentMethodId}]`;
      }
      if (tx.isRefund) {
        if (!finalNotes.includes('[isRefund:true]')) {
          finalNotes = finalNotes ? `${finalNotes} [isRefund:true]` : `[isRefund:true]`;
        }
      } else {
        finalNotes = finalNotes.replace(/\[isRefund:true\]/g, '').replace(/\[refund\]/g, '').trim();
      }
      if (tx.isFixedSubscription && tx.anchorDay && !finalNotes.includes('[anchorDay:')) {
        finalNotes = finalNotes ? `${finalNotes} [anchorDay:${tx.anchorDay}]` : `[anchorDay:${tx.anchorDay}]`;
      }

      const payload: Record<string, any> = {
        date: tx.date,
        description: tx.description,
        currency: tx.currency,
        original_amount: tx.originalAmount,
        exchange_rate: tx.exchangeRate || 1.0,
        amount_pen: tx.amountPen,
        payment_due_date: tx.paymentDueDate,
        is_fixed_subscription: !!tx.isFixedSubscription,
        is_refund: !!tx.isRefund,
        notes: finalNotes || null
      };

      if (isUUID(tx.categoryId)) {
        payload.category_id = tx.categoryId;
      }
      if (isUUID(tx.paymentMethodId)) {
        payload.payment_method_id = tx.paymentMethodId;
      }

      let { error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', tx.id);

      // Fallback si la migración de is_refund aún no se ejecutó en PostgreSQL
      if (error && error.message?.includes('is_refund')) {
        delete payload.is_refund;
        const retryRefund = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', tx.id);
        error = retryRefund.error;
      }

      if (error && (error.message?.includes('payment_method_id') || (error as any).code === '23503')) {
        console.warn('Foreign key violada para payment_method_id al actualizar, reintentando con fallback de notas:', error.message);
        delete payload.payment_method_id;
        const retry = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', tx.id);
        error = retry.error;
      }

      if (error) {
        this.logSupabaseError('updateTransaction (PUT)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('updateTransaction (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar una transacción
  public static async deleteTransaction(id: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        this.logSupabaseError('deleteTransaction (DELETE)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('deleteTransaction (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar transacciones en lote (ej. cancelación de suscripciones futuras)
  public static async deleteTransactions(ids: string[]): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    const validIds = ids.filter(id => isUUID(id));
    if (validIds.length === 0) return false;

    try {
      const { error } = await supabase.from('transactions').delete().in('id', validIds);
      if (error) {
        this.logSupabaseError('deleteTransactions (DELETE in)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('deleteTransactions (catch)', e);
      return false;
    }
  }

  // ============================================================================
  // 2. MEDIOS DE PAGO Y TARJETAS
  // ============================================================================

  // GET: Obtener medios de pago y tarjetas
  public static async getPaymentMethods(): Promise<PaymentMethod[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('payment_methods')
          .select('*')
          .order('type', { ascending: false }),
        'getPaymentMethods'
      );

      if (error || !data || data.length === 0) return null;

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        billingCloseDay: row.billing_close_day || undefined,
        paymentDueDay: row.payment_due_day || undefined,
        creditLimit: row.credit_limit != null ? parseFloat(row.credit_limit) : undefined,
        color: row.color || '#3b82f6',
        icon: row.icon || 'credit-card',
        isActive: row.is_active !== false,
        initialDebt: row.initial_debt != null ? parseFloat(row.initial_debt) : 0
      }));
    } catch (e) {
      this.logSupabaseError('getPaymentMethods (catch)', e);
      return null;
    }
  }

  // POST: Crear tarjeta o cuenta
  public static async createPaymentMethod(pm: PaymentMethod): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const payload: Record<string, any> = {
        user_id: userId,
        name: pm.name,
        type: pm.type,
        billing_close_day: pm.billingCloseDay || null,
        payment_due_day: pm.paymentDueDay || null,
        color: pm.color,
        icon: pm.icon,
        is_active: pm.isActive !== false
      };

      if (isUUID(pm.id)) {
        payload.id = pm.id;
      }
      // Only credit cards carry a limit; debit/cash stay null (avoids the schema default).
      payload.credit_limit = pm.type === 'credit' ? (pm.creditLimit ?? null) : null;
      // Deuda inicial arrastrada (solo tarjetas de crédito).
      payload.initial_debt = pm.type === 'credit' ? (pm.initialDebt ?? 0) : 0;

      let { error } = await supabase.from('payment_methods').insert(payload);

      // Fallback si la columna initial_debt aún no se migró en PostgreSQL.
      if (error && error.message?.includes('initial_debt')) {
        delete payload.initial_debt;
        const retry = await supabase.from('payment_methods').insert(payload);
        error = retry.error;
      }

      if (error) {
        this.logSupabaseError('createPaymentMethod (POST)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('createPaymentMethod (catch)', e);
      return false;
    }
  }

  // PUT: Actualizar tarjeta o cuenta
  public static async updatePaymentMethod(pm: PaymentMethod): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(pm.id)) return false;

    try {
      const payload: Record<string, any> = {
        name: pm.name,
        billing_close_day: pm.billingCloseDay || null,
        payment_due_day: pm.paymentDueDay || null,
        color: pm.color,
        // Only credit cards carry a limit; debit/cash stay null.
        credit_limit: pm.type === 'credit' ? (pm.creditLimit ?? null) : null,
        // Deuda inicial arrastrada (solo tarjetas de crédito).
        initial_debt: pm.type === 'credit' ? (pm.initialDebt ?? 0) : 0
      };

      let { error } = await supabase
        .from('payment_methods')
        .update(payload)
        .eq('id', pm.id);

      // Fallback si la columna initial_debt aún no se migró en PostgreSQL.
      if (error && error.message?.includes('initial_debt')) {
        delete payload.initial_debt;
        const retry = await supabase
          .from('payment_methods')
          .update(payload)
          .eq('id', pm.id);
        error = retry.error;
      }

      return !error;
    } catch (e) {
      this.logSupabaseError('updatePaymentMethod (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar tarjeta o cuenta
  public static async deletePaymentMethod(id: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) {
        this.logSupabaseError('deletePaymentMethod', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('deletePaymentMethod (catch)', e);
      return false;
    }
  }

  // ============================================================================
  // 3. CUENTAS POR COBRAR A TERCEROS
  // ============================================================================

  // GET: Obtener préstamos por cobrar con su historial de pagos
  public static async getReceivables(): Promise<Receivable[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      let data: any[] | null = null;
      // 1. Intentar consultar con relación a receivable_payments
      const resWithPayments = await this.executeWithRetry<any[]>(
        () => sb.from('receivables').select('*, receivable_payments(*)'),
        'getReceivablesWithPayments'
      );

      if (!resWithPayments.error && resWithPayments.data) {
        data = resWithPayments.data;
      } else {
        // 2. Fallback si la tabla aún no existe en Supabase
        const fallbackRes = await this.executeWithRetry<any[]>(
          () => sb.from('receivables').select('*'),
          'getReceivablesFallback'
        );
        if (fallbackRes.error || !fallbackRes.data) return null;
        data = fallbackRes.data;
      }

      if (!data || data.length === 0) return null;

      return data.map((row: any) => {
        const rawPayments: any[] = Array.isArray(row.receivable_payments) ? row.receivable_payments : [];
        const payments: ReceivablePayment[] = rawPayments.map((p: any) => ({
          id: p.id,
          receivableId: p.receivable_id || row.id,
          amountPaid: parseFloat(p.amount || '0'),
          amount: parseFloat(p.amount || '0'),
          paymentDate: p.payment_date,
          notes: p.notes || undefined,
          createdAt: p.created_at || (p.notes ? (p.notes.match(/\[created:([^\]]+)\]/)?.[1]) : undefined) || undefined
        }));

        return {
          id: row.id,
          debtorName: row.debtor_name,
          description: row.description || '',
          originalAmount: parseFloat(row.original_amount),
          paidAmount: parseFloat(row.paid_amount || '0'),
          remainingAmount: parseFloat(row.original_amount) - parseFloat(row.paid_amount || '0'),
          currency: row.currency || 'PEN',
          exchangeRate: row.exchange_rate ? parseFloat(row.exchange_rate) : undefined,
          amountPen: row.amount_pen ? parseFloat(row.amount_pen) : undefined,
          loanDate: row.loan_date || undefined,
          status: row.status,
          dueDate: row.due_date,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || undefined,
          payments
        };
      });
    } catch (e) {
      this.logSupabaseError('getReceivables (catch)', e);
      return null;
    }
  }

  // POST: Crear préstamo
  public static async createReceivable(r: Receivable): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const payload: Record<string, any> = {
        user_id: userId,
        debtor_name: r.debtorName,
        description: r.description,
        original_amount: r.originalAmount,
        paid_amount: r.paidAmount || 0,
        currency: r.currency || 'PEN',
        exchange_rate: r.exchangeRate || 1.0,
        amount_pen: r.amountPen || (r.currency === 'USD' ? r.originalAmount * (r.exchangeRate || 1) : r.originalAmount),
        loan_date: r.loanDate || new Date().toISOString().split('T')[0],
        status: r.status || 'pending',
        due_date: r.dueDate || null
      };

      if (isUUID(r.id)) {
        payload.id = r.id;
      }

      const { error } = await supabase.from('receivables').insert(payload);
      return !error;
    } catch (e) {
      this.logSupabaseError('createReceivable (catch)', e);
      return false;
    }
  }

  // PUT: Editar los datos de un préstamo existente (no toca los abonos ya hechos)
  public static async updateReceivable(r: Receivable): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(r.id)) return false;

    try {
      const { error } = await supabase
        .from('receivables')
        .update({
          debtor_name: r.debtorName,
          description: r.description,
          original_amount: r.originalAmount,
          currency: r.currency || 'PEN',
          exchange_rate: r.exchangeRate || 1.0,
          amount_pen: r.amountPen || (r.currency === 'USD' ? r.originalAmount * (r.exchangeRate || 1) : r.originalAmount),
          loan_date: r.loanDate || null,
          due_date: r.dueDate || null
        })
        .eq('id', r.id);
      return !error;
    } catch (e) {
      this.logSupabaseError('updateReceivable (catch)', e);
      return false;
    }
  }

  // POST/PUT: Registrar abono a préstamo y guardar en historial de pagos
  public static async recordReceivablePayment(
    id: string,
    newPaidAmount: number,
    isFullyPaid: boolean,
    payment?: ReceivablePayment
  ): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      // 1. Actualizar estado del préstamo
      const { error: updateError } = await supabase
        .from('receivables')
        .update({
          paid_amount: newPaidAmount,
          status: isFullyPaid ? 'paid' : 'partial',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        this.logSupabaseError('recordReceivablePayment (update)', updateError.message);
        return false;
      }

      // 2. Si se proporciona registro de pago, persistir en receivable_payments
      if (payment) {
        const paymentPayload: Record<string, any> = {
          receivable_id: id,
          amount: payment.amount || payment.amountPaid,
          payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
          notes: payment.notes || null,
          created_at: payment.createdAt || new Date().toISOString()
        };

        if (isUUID(payment.id)) {
          paymentPayload.id = payment.id;
        }

        const { error: payError } = await supabase.from('receivable_payments').insert(paymentPayload);
        if (payError) {
          this.logSupabaseError('recordReceivablePayment (insert payment)', payError.message);
        }
      }

      return true;
    } catch (e) {
      this.logSupabaseError('recordReceivablePayment (catch)', e);
      return false;
    }
  }

  // PUT/UPSERT: Actualizar fecha o notas de un abono/cobro
  public static async updateReceivablePayment(
    receivableId: string,
    paymentId: string,
    paymentDate: string,
    notes?: string,
    amount?: number
  ): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(receivableId)) return false;

    try {
      if (isUUID(paymentId)) {
        const { error } = await supabase
          .from('receivable_payments')
          .update({
            payment_date: paymentDate,
            notes: notes || null,
            ...(amount != null ? { amount } : {})
          })
          .eq('id', paymentId);
        return !error;
      } else {
        // Es un legacy payment sin id UUID en BD: insertar como nueva fila en receivable_payments
        const { error } = await supabase.from('receivable_payments').insert({
          receivable_id: receivableId,
          amount: amount || 0,
          payment_date: paymentDate,
          notes: notes || null
        });
        return !error;
      }
    } catch (e) {
      this.logSupabaseError('updateReceivablePayment (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar un abono/cobro revertiéndolo
  public static async deleteReceivablePayment(
    receivableId: string,
    paymentId: string,
    newPaidAmount: number
  ): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(receivableId)) return false;

    try {
      if (isUUID(paymentId)) {
        await supabase.from('receivable_payments').delete().eq('id', paymentId);
      }
      const { error } = await supabase
        .from('receivables')
        .update({
          paid_amount: newPaidAmount,
          status: newPaidAmount <= 0 ? 'pending' : 'partial',
          updated_at: new Date().toISOString()
        })
        .eq('id', receivableId);
      return !error;
    } catch (e) {
      this.logSupabaseError('deleteReceivablePayment (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar préstamo
  public static async deleteReceivable(id: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      const { error } = await supabase.from('receivables').delete().eq('id', id);
      if (error) {
        this.logSupabaseError('deleteReceivable', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('deleteReceivable (catch)', e);
      return false;
    }
  }

  // ============================================================================
  // 3B. DEUDAS POR PAGAR A ACREEDORES (PAYABLES)
  // ============================================================================

  // GET: Obtener deudas por pagar
  public static async getPayables(): Promise<Payable[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb.from('payables').select('*, payable_payments(*)'),
        'getPayables'
      );
      if (error || !data || data.length === 0) return null;

      return data.map((row: any) => ({
        id: row.id,
        creditorName: row.creditor_name,
        description: row.description || '',
        totalAmount: parseFloat(row.original_amount),
        originalAmount: parseFloat(row.original_amount),
        paidAmount: parseFloat(row.paid_amount || '0'),
        remainingAmount: parseFloat(row.original_amount) - parseFloat(row.paid_amount || '0'),
        currency: (row.currency === 'USD' ? 'USD' : 'PEN') as 'PEN' | 'USD',
        exchangeRate: row.exchange_rate ? parseFloat(row.exchange_rate) : undefined,
        amountPen: row.amount_pen ? parseFloat(row.amount_pen) : (row.currency === 'USD' && row.exchange_rate ? parseFloat(row.original_amount) * parseFloat(row.exchange_rate) : parseFloat(row.original_amount)),
        issueDate: row.issue_date || row.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        dueDate: row.due_date,
        isCreditedToDebit: !!row.is_credited_to_debit,
        status: row.status as 'PENDING' | 'PARTIALLY_PAID' | 'PAID',
        payments: Array.isArray(row.payable_payments) ? row.payable_payments.map((p: any) => ({
          id: p.id,
          payableId: p.payable_id,
          amountPaid: parseFloat(p.amount),
          amount: parseFloat(p.amount),
          paymentDate: p.payment_date,
          notes: p.notes,
          createdAt: p.created_at || (p.notes ? (p.notes.match(/\[created:([^\]]+)\]/)?.[1]) : undefined) || undefined
        })) : []
      }));
    } catch (e) {
      this.logSupabaseError('getPayables (catch)', e);
      return null;
    }
  }

  // POST: Crear deuda por pagar
  public static async createPayable(p: Payable): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const origAmount = p.totalAmount || p.originalAmount;
      const exRate = p.exchangeRate || 1.0;
      const amtPen = p.amountPen || (p.currency === 'USD' ? origAmount * exRate : origAmount);

      const payload: Record<string, any> = {
        user_id: userId,
        creditor_name: p.creditorName,
        description: p.description,
        original_amount: origAmount,
        paid_amount: p.paidAmount || 0,
        currency: p.currency || 'PEN',
        exchange_rate: exRate,
        amount_pen: amtPen,
        issue_date: p.issueDate || new Date().toISOString().split('T')[0],
        due_date: p.dueDate || null,
        is_credited_to_debit: !!p.isCreditedToDebit,
        status: normalizePayableStatus(p.status)
      };

      if (isUUID(p.id)) {
        payload.id = p.id;
      }

      const { error } = await supabase.from('payables').insert(payload);
      if (error) {
        this.logSupabaseError('createPayable (POST)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('createPayable (catch)', e);
      return false;
    }
  }

  // PUT: Editar los datos de una deuda existente (no toca los pagos ya realizados)
  public static async updatePayable(p: Payable): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(p.id)) return false;

    try {
      const origAmount = p.totalAmount || p.originalAmount;
      const exRate = p.exchangeRate || 1.0;
      const amtPen = p.amountPen || (p.currency === 'USD' ? origAmount * exRate : origAmount);

      const { error } = await supabase
        .from('payables')
        .update({
          creditor_name: p.creditorName,
          description: p.description,
          original_amount: origAmount,
          currency: p.currency || 'PEN',
          exchange_rate: exRate,
          amount_pen: amtPen,
          issue_date: p.issueDate || null,
          due_date: p.dueDate || null,
          is_credited_to_debit: !!p.isCreditedToDebit
        })
        .eq('id', p.id);
      return !error;
    } catch (e) {
      this.logSupabaseError('updatePayable (catch)', e);
      return false;
    }
  }

  // POST: Registrar pago/amortización de deuda
  public static async recordPayablePayment(payableId: string, payment: PayablePayment, newPaidAmount: number, isFullyPaid: boolean): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(payableId)) return false;

    try {
      // 1. Actualizar estado de la deuda
      const { error: updateError } = await supabase
        .from('payables')
        .update({
          paid_amount: newPaidAmount,
          status: isFullyPaid ? 'paid' : 'partial'
        })
        .eq('id', payableId);

      if (updateError) return false;

      // 2. Registrar en tabla de amortizaciones
      const paymentPayload: Record<string, any> = {
        payable_id: payableId,
        amount: payment.amount || payment.amountPaid,
        payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
        notes: payment.notes || null,
        created_at: payment.createdAt || new Date().toISOString()
      };

      if (isUUID(payment.id)) {
        paymentPayload.id = payment.id;
      }

      const { error: payError } = await supabase.from('payable_payments').insert(paymentPayload);
      return !payError;
    } catch (e) {
      this.logSupabaseError('recordPayablePayment (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar deuda
  public static async deletePayable(id: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      const { error } = await supabase.from('payables').delete().eq('id', id);
      return !error;
    } catch (e) {
      this.logSupabaseError('deletePayable (catch)', e);
      return false;
    }
  }

  // ============================================================================
  // 4. OTROS INGRESOS (other_incomes)
  // ============================================================================

  // GET: Obtener otros ingresos del mes
  public static async getOtherIncomes(monthKey: string): Promise<OtherIncome[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${monthKey}-01`;
      const endDate = `${monthKey}-${lastDay.toString().padStart(2, '0')}`;

      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('other_incomes')
          .select('*')
          .gte('received_date', startDate)
          .lte('received_date', endDate)
          .order('received_date', { ascending: false }),
        'getOtherIncomes'
      );

      if (error) {
        this.logSupabaseError('getOtherIncomes', error.message);
        return null;
      }

      if (!data) return [];

      return data.map((row: any) => ({
        id: row.id,
        description: row.description,
        amount: parseFloat(row.amount),
        receivedDate: row.received_date
      }));
    } catch (e) {
      this.logSupabaseError('getOtherIncomes (catch)', e);
      return null;
    }
  }

  // GET: Historial COMPLETO de otros ingresos, agrupado por mes (YYYY-MM).
  // Permite que el flujo consolidado use los ingresos extra reales de cada mes,
  // no solo los del mes visible.
  public static async getAllOtherIncomes(): Promise<Record<string, OtherIncome[]> | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('other_incomes')
          .select('*')
          .order('received_date', { ascending: false }),
        'getAllOtherIncomes'
      );

      if (error) {
        this.logSupabaseError('getAllOtherIncomes', error.message);
        return null;
      }

      if (!data) return {};

      const grouped: Record<string, OtherIncome[]> = {};
      data.forEach((row: any) => {
        const receivedDate: string = row.received_date;
        const monthKey = (receivedDate || '').slice(0, 7);
        if (!monthKey) return;
        const inc: OtherIncome = {
          id: row.id,
          description: row.description,
          amount: parseFloat(row.amount),
          receivedDate
        };
        (grouped[monthKey] = grouped[monthKey] || []).push(inc);
      });
      return grouped;
    } catch (e) {
      this.logSupabaseError('getAllOtherIncomes (catch)', e);
      return null;
    }
  }

  // POST: Crear otro ingreso
  public static async createOtherIncome(inc: OtherIncome, dateStr?: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const date = dateStr || inc.receivedDate || new Date().toISOString().split('T')[0];
      const monthlyPeriodId = await this.getOrCreateMonthlyPeriod(userId, date);
      if (!monthlyPeriodId) return false;

      const payload: Record<string, any> = {
        user_id: userId,
        monthly_period_id: monthlyPeriodId,
        description: inc.description,
        amount: inc.amount,
        received_date: date
      };

      if (isUUID(inc.id)) {
        payload.id = inc.id;
      }

      const { error } = await supabase.from('other_incomes').insert(payload);
      if (error) {
        this.logSupabaseError('createOtherIncome (POST)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('createOtherIncome (catch)', e);
      return false;
    }
  }

  // PUT: Actualizar otro ingreso
  public static async updateOtherIncome(inc: OtherIncome): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured || !isUUID(inc.id)) return false;

    try {
      const { error } = await supabase
        .from('other_incomes')
        .update({
          description: inc.description,
          amount: inc.amount,
          received_date: inc.receivedDate
        })
        .eq('id', inc.id);

      return !error;
    } catch (e) {
      this.logSupabaseError('updateOtherIncome (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar otro ingreso
  public static async deleteOtherIncome(id: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      const { error } = await supabase.from('other_incomes').delete().eq('id', id);
      if (error) {
        this.logSupabaseError('deleteOtherIncome (DELETE)', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('deleteOtherIncome (catch)', e);
      return false;
    }
  }

  // ============================================================================
  // 5. PERIODOS MENSUALES, SALDOS INICIALES Y SUELDO BASE
  // ============================================================================

  // GET: Obtener datos de periodo mensual (saldo débito y sueldo base)
  public static async getMonthlyPeriod(year: number, month: number): Promise<{ initialDebitBalance: number; baseSalary: number } | null> {
    if (!supabase || !isSupabaseConfigured) return null;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return null;

      const { data } = await supabase
        .from('monthly_periods')
        .select('initial_debit_balance, base_salary')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      let baseSalary = data ? parseFloat(data.base_salary || '0') : 0;
      const initialDebitBalance = data ? parseFloat(data.initial_debit_balance || '0') : 0;

      // Si este mes aún no tiene sueldo propio asignado, heredar el último sueldo vigente conocido (mes en adelante)
      if (baseSalary === 0) {
        const { data: periodsWithSalary } = await supabase
          .from('monthly_periods')
          .select('year, month, base_salary')
          .eq('user_id', userId)
          .gt('base_salary', 0)
          .order('year', { ascending: false })
          .order('month', { ascending: false });

        if (periodsWithSalary && periodsWithSalary.length > 0) {
          const relevant = periodsWithSalary.find(p => p.year < year || (p.year === year && p.month <= month));
          if (relevant && relevant.base_salary) {
            baseSalary = parseFloat(relevant.base_salary);
          }
        }
      }

      if (!data && baseSalary === 0 && initialDebitBalance === 0) return null;

      return {
        initialDebitBalance,
        baseSalary
      };
    } catch (e) {
      this.logSupabaseError('getMonthlyPeriod (catch)', e);
      return null;
    }
  }

  // GET: Historial COMPLETO de periodos mensuales (saldo inicial y sueldo base por mes),
  // indexado por clave YYYY-MM. Permite que las vistas consolidadas y el simulador usen
  // los saldos/sueldos reales de todos los meses sin tener que visitarlos uno por uno.
  public static async getAllMonthlyPeriods(): Promise<Record<string, { initialDebitBalance: number; baseSalary: number }> | null> {
    if (!supabase || !isSupabaseConfigured) return null;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return null;

      const { data, error } = await this.executeWithRetry<any[]>(
        () => supabase!
          .from('monthly_periods')
          .select('year, month, base_salary, initial_debit_balance')
          .eq('user_id', userId),
        'getAllMonthlyPeriods'
      );

      if (error || !data) {
        if (error) this.logSupabaseError('getAllMonthlyPeriods', error.message);
        return null;
      }

      const map: Record<string, { initialDebitBalance: number; baseSalary: number }> = {};
      data.forEach((row: any) => {
        const y = parseInt(row.year, 10);
        const m = parseInt(row.month, 10);
        if (!y || !m) return;
        const key = `${y}-${m.toString().padStart(2, '0')}`;
        map[key] = {
          initialDebitBalance: parseFloat(row.initial_debit_balance || '0'),
          baseSalary: parseFloat(row.base_salary || '0')
        };
      });
      return map;
    } catch (e) {
      this.logSupabaseError('getAllMonthlyPeriods (catch)', e);
      return null;
    }
  }

  // PUT: Actualizar saldo débito inicial para un mes específico
  public static async updateInitialDebitBalance(year: number, month: number, balance: number): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const dateStr = `${year}-${month.toString().padStart(2, '0')}-01`;
      const periodId = await this.getOrCreateMonthlyPeriod(userId, dateStr);
      if (!periodId) return false;

      const { error } = await supabase
        .from('monthly_periods')
        .update({ initial_debit_balance: balance })
        .eq('id', periodId);

      if (error) {
        this.logSupabaseError('updateInitialDebitBalance', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('updateInitialDebitBalance (catch)', e);
      return false;
    }
  }

  // PUT: Actualizar sueldo base para un mes específico
  public static async updateBaseSalary(year: number, month: number, salary: number): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const dateStr = `${year}-${month.toString().padStart(2, '0')}-01`;
      const periodId = await this.getOrCreateMonthlyPeriod(userId, dateStr);
      if (!periodId) return false;

      const { error } = await supabase
        .from('monthly_periods')
        .update({ base_salary: salary })
        .eq('id', periodId);

      if (error) {
        this.logSupabaseError('updateBaseSalary', error.message);
        return false;
      }
      return true;
    } catch (e) {
      this.logSupabaseError('updateBaseSalary (catch)', e);
      return false;
    }
  }

  // ============================================================================
  // 6. ABONOS A TARJETAS (card_payments)
  // ============================================================================

  // GET: Obtener abonos a tarjetas del mes
  public static async getCardPayments(monthKey: string): Promise<CardPayment[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${monthKey}-01`;
      const endDate = `${monthKey}-${lastDay.toString().padStart(2, '0')}`;

      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('card_payments')
          .select('*')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate),
        'getCardPayments'
      );

      if (error || !data) return null;

      return data.map((row: any): CardPayment => {
        let st: 'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT' | 'USD_SAVINGS_ACCOUNT' = 'DEBIT_ACCOUNT';
        if (row.source_type) {
          st = row.source_type;
        }
        const currency = (row.currency as 'PEN' | 'USD') || 'PEN';
        const amountPaid = parseFloat(row.amount_paid) || 0;
        const originalAmount = row.original_amount !== null && row.original_amount !== undefined ? parseFloat(row.original_amount) : amountPaid;
        const exchangeRate = row.exchange_rate !== null && row.exchange_rate !== undefined ? parseFloat(row.exchange_rate) : 1.0;
        const amountPen = row.amount_pen !== null && row.amount_pen !== undefined ? parseFloat(row.amount_pen) : amountPaid;

        return {
          id: row.id,
          paymentMethodId: row.payment_method_id,
          amountPaid,
          paymentDate: row.payment_date,
          sourceType: st,
          currency,
          originalAmount,
          exchangeRate,
          amountPen,
          notes: row.notes || undefined
        };
      });
    } catch (e) {
      this.logSupabaseError('getCardPayments (catch)', e);
      return null;
    }
  }

  // GET: Historial COMPLETO de abonos a tarjetas (sin filtro de mes).
  // Con esto el resumen de deuda "a la fecha" y las vistas consolidadas cubren
  // todos los pagos reales, no solo los del mes visitado.
  public static async getAllCardPayments(): Promise<CardPayment[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('card_payments')
          .select('*'),
        'getAllCardPayments'
      );

      if (error || !data) return null;

      return data.map((row: any): CardPayment => {
        let st: 'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT' | 'USD_SAVINGS_ACCOUNT' = 'DEBIT_ACCOUNT';
        if (row.source_type) {
          st = row.source_type;
        }
        const currency = (row.currency as 'PEN' | 'USD') || 'PEN';
        const amountPaid = parseFloat(row.amount_paid) || 0;
        const originalAmount = row.original_amount !== null && row.original_amount !== undefined ? parseFloat(row.original_amount) : amountPaid;
        const exchangeRate = row.exchange_rate !== null && row.exchange_rate !== undefined ? parseFloat(row.exchange_rate) : 1.0;
        const amountPen = row.amount_pen !== null && row.amount_pen !== undefined ? parseFloat(row.amount_pen) : amountPaid;

        return {
          id: row.id,
          paymentMethodId: row.payment_method_id,
          amountPaid,
          paymentDate: row.payment_date,
          sourceType: st,
          currency,
          originalAmount,
          exchangeRate,
          amountPen,
          notes: row.notes || undefined
        };
      });
    } catch (e) {
      this.logSupabaseError('getAllCardPayments (catch)', e);
      return null;
    }
  }

  // POST: Registrar abono a tarjeta
  public static async createCardPayment(pay: CardPayment): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const monthlyPeriodId = await this.getOrCreateMonthlyPeriod(userId, pay.paymentDate);
      if (!monthlyPeriodId) return false;

      const currency = pay.currency || 'PEN';
      const originalAmount = pay.originalAmount !== undefined ? pay.originalAmount : pay.amountPaid;
      const exchangeRate = currency === 'USD' ? (pay.exchangeRate || 1.0) : 1.0;
      const amountPen = pay.amountPen !== undefined 
        ? pay.amountPen 
        : (currency === 'USD' ? Math.round(originalAmount * exchangeRate * 100) / 100 : originalAmount);

      const payload: Record<string, any> = {
        user_id: userId,
        monthly_period_id: monthlyPeriodId,
        payment_method_id: isUUID(pay.paymentMethodId) ? pay.paymentMethodId : null,
        amount_paid: amountPen,
        payment_date: pay.paymentDate,
        source_type: pay.sourceType || 'DEBIT_ACCOUNT',
        currency,
        original_amount: originalAmount,
        exchange_rate: exchangeRate,
        amount_pen: amountPen,
        notes: pay.notes || null
      };

      if (pay.id && isUUID(pay.id)) {
        payload.id = pay.id;
      }

      let { error } = await supabase.from('card_payments').insert(payload);

      // Fallback si las nuevas columnas de moneda aún no se ejecutaron en PostgreSQL
      if (error && (error.message?.includes('currency') || error.message?.includes('original_amount') || error.message?.includes('exchange_rate') || error.message?.includes('amount_pen'))) {
        delete payload.currency;
        delete payload.original_amount;
        delete payload.exchange_rate;
        delete payload.amount_pen;
        const retryCols = await supabase.from('card_payments').insert(payload);
        error = retryCols.error;
      }

      // Fallback si la migración de source_type aún no se ejecutó en PostgreSQL
      if (error && error.message?.includes('source_type')) {
        delete payload.source_type;
        const retrySource = await supabase.from('card_payments').insert(payload);
        error = retrySource.error;
      }

      return !error;
    } catch (e) {
      this.logSupabaseError('createCardPayment (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar abono a tarjeta
  public static async deleteCardPayment(id: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      const { error } = await supabase.from('card_payments').delete().eq('id', id);
      return !error;
    } catch (e) {
      this.logSupabaseError('deleteCardPayment (catch)', e);
      return false;
    }
  }

  // ============================================================================
  // 7. CATEGORÍAS
  // ============================================================================

  // GET: Obtener categorías disponibles
  public static async getCategories(): Promise<Category[] | null> {
    const sb = supabase;
    if (!sb || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await this.executeWithRetry<any[]>(
        () => sb
          .from('categories')
          .select('*')
          .order('created_at', { ascending: true }),
        'getCategories'
      );

      if (error || !data || data.length === 0) return null;

      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        icon: row.icon || 'tag',
        color: row.color || '#64748b'
      }));
    } catch (e) {
      this.logSupabaseError('getCategories (catch)', e);
      return null;
    }
  }

  // POST: Crear categoría personalizada
  public static async createCategory(cat: Category): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const userId = await this.getAuthUserId();
      if (!userId) return false;

      const payload: Record<string, any> = {
        user_id: userId,
        name: cat.name,
        icon: cat.icon || 'tag',
        color: cat.color || '#64748b'
      };

      if (isUUID(cat.id)) {
        payload.id = cat.id;
      }

      const { error } = await supabase.from('categories').insert(payload);
      return !error;
    } catch (e) {
      this.logSupabaseError('createCategory (catch)', e);
      return false;
    }
  }

  // DELETE: Eliminar categoría
  public static async deleteCategory(id: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;
    if (!isUUID(id)) return false;

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      return !error;
    } catch (e) {
      this.logSupabaseError('deleteCategory (catch)', e);
      return false;
    }
  }
}
