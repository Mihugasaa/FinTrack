import { Transaction, PaymentMethod } from '@/types';
import { initialPaymentMethods } from '@/lib/defaults';

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
