import { Transaction, PaymentMethod, Receivable } from '@/types';
import { initialPaymentMethods } from '@/lib/defaults';

// Salida de dinero generada al registrar un préstamo: sus notas guardan el id del
// préstamo ("Desembolso de préstamo registrado en FinTrack (#<uuid>)").
const LOAN_DISBURSEMENT_REGEX = /Desembolso de préstamo registrado en FinTrack \(#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/i;

/** Id del préstamo al que pertenece una salida de desembolso, o null si no lo es. */
export const getLoanDisbursementReceivableId = (t: Pick<Transaction, 'notes'>): string | null => {
  const match = (t.notes || '').match(LOAN_DISBURSEMENT_REGEX);
  return match ? match[1].toLowerCase() : null;
};

/**
 * Reconstruye un préstamo (pendiente de cobro) a partir de su salida de desembolso:
 * mismo id, deudor, descripción, monto, moneda y fecha. Sirve para recuperar
 * préstamos borrados cuya salida sigue registrada en Movimientos.
 */
export const buildReceivableFromDisbursement = (t: Transaction): Receivable | null => {
  const id = getLoanDisbursementReceivableId(t);
  if (!id) return null;

  // La descripción se generó como "Préstamo a <deudor>[ - <detalle>]"
  const body = (t.description || '').replace(/^Préstamo a\s+/i, '').trim();
  const sepIdx = body.indexOf(' - ');
  const debtorName = (sepIdx >= 0 ? body.slice(0, sepIdx) : body).trim() || 'Deudor';
  const description = sepIdx >= 0 ? body.slice(sepIdx + 3).trim() || 'Préstamo' : 'Préstamo';

  const isUsd = t.currency === 'USD';
  const createdAt = (t.notes || '').match(/\[created:([^\]]+)\]/)?.[1] || t.createdAt || `${t.date}T12:00:00.000Z`;

  return {
    id,
    debtorName,
    description,
    originalAmount: t.originalAmount,
    paidAmount: 0,
    remainingAmount: t.originalAmount,
    currency: t.currency || 'PEN',
    exchangeRate: isUsd ? t.exchangeRate : undefined,
    amountPen: t.amountPen,
    loanDate: t.date,
    status: 'pending',
    isDebitedFromAccount: true,
    fundingPaymentMethodId: t.paymentMethodId,
    createdAt,
    payments: []
  };
};

// Generador de UUID estándar RFC4122 (compatible con Supabase)
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Deduplicador estricto por ID único (permite compras legítimas con misma tarjeta, monto y fecha)
export const deduplicateTransactions = (list: Transaction[]): Transaction[] => {
  const seenIds = new Set<string>();
  const result: Transaction[] = [];

  for (const t of list) {
    if (!t || !t.id) continue;
    if (seenIds.has(t.id)) continue;
    seenIds.add(t.id);
    result.push(t);
  }
  return result;
};

// Resolver de método de pago con soporte de UUID, respaldo en notas [pmId:UUID] y compatibilidad hacia atrás
export const resolvePaymentMethod = (
  tx: { paymentMethodId?: string; notes?: string | null },
  methods: PaymentMethod[]
): PaymentMethod | undefined => {
  if (tx.paymentMethodId) {
    const direct = methods.find(p => p.id === tx.paymentMethodId);
    if (direct) return direct;

    // Compatibilidad y puente entre IDs iniciales ('pm-1', 'pm-2', etc.) y UUIDs de Supabase
    const initialPm = initialPaymentMethods.find(ip => ip.id === tx.paymentMethodId);
    if (initialPm) {
      const matchByName = methods.find(p => p.name.toLowerCase() === initialPm.name.toLowerCase());
      if (matchByName) return matchByName;
    }
  }
  if (tx.notes) {
    const match = tx.notes.match(/\[pmId:([^\]]+)\]/);
    if (match && match[1]) {
      const fromNote = methods.find(p => p.id === match[1]);
      if (fromNote) return fromNote;
    }
  }
  if (tx.paymentMethodId === 'pm-1' || tx.paymentMethodId === 'pm-deb-1') {
    const deb = methods.find(p => p.type === 'debit');
    if (deb) return deb;
  }
  if (methods.length > 0) {
    return methods[0];
  }
  return undefined;
};
