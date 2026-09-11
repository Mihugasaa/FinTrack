/**
 * FINTRACK - DATA STORAGE SERVICE
 * Persistencia modular de datos por usuario (Multi-inquilino)
 */

import { Transaction, PaymentMethod, Receivable, OtherIncome, SalaryIncome, Category, Payable } from '@/types';
import {
  initialCategories,
  initialPaymentMethods,
  initialSalaries,
  initialReceivables,
  initialPayables,
  initialCardPayments,
  initialTransactions
} from '@/lib/mockData';

export interface UserFinancialData {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  transactions: Transaction[];
  receivables: Receivable[];
  payables?: Payable[];
  cardPayments: { id?: string; paymentMethodId: string; amountPaid: number; paymentDate: string; sourceType?: 'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT'; note?: string }[];
  salaries: SalaryIncome[];
  extraIncomes: Record<string, OtherIncome[]>;
  initialDebitBalances: Record<string, number>;
}

const DEFAULT_INITIAL_DEBIT_BALANCES: Record<string, number> = {
  '2026-08': 2044.67,
  '2026-09': 3904.66,
  '2026-10': 1994.46,
  '2026-11': 2308.74,
  '2026-12': 4141.37
};

const DEFAULT_EXTRA_INCOMES: Record<string, OtherIncome[]> = {
  '2026-08': [],
  '2026-09': [{ id: 'oi-1', description: 'Disney', amount: 103.50, receivedDate: '2026-09-05' }]
};

export class StorageService {
  private static getKey(username: string): string {
    return `fintrack_data_${username.toLowerCase()}`;
  }

  // Cargar datos del usuario
  public static loadUserData(username: string): UserFinancialData {
    if (typeof window === 'undefined') {
      return this.getDefaultData(username);
    }

    const key = this.getKey(username);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        if (data && Array.isArray(data.transactions)) {
          const seenIds = new Set<string>();
          data.transactions = data.transactions.filter((t: any) => {
            if (!t || !t.id) return false;
            if (seenIds.has(t.id)) return false;
            seenIds.add(t.id);
            return true;
          });
        }
        if (data && Array.isArray(data.cardPayments)) {
          data.cardPayments = data.cardPayments.map((cp: any, idx: number) => ({
            ...cp,
            id: cp.id || `cp-saved-${idx}`
          }));
        }
        return data;
      }
    } catch (e) {
      console.error('Error al cargar datos del usuario:', e);
    }

    // Si no existen datos guardados aún, inicializar según el usuario
    const initial = this.getDefaultData(username);
    this.saveUserData(username, initial);
    return initial;
  }

  // Guardar datos completos del usuario
  public static saveUserData(username: string, data: UserFinancialData): void {
    if (typeof window === 'undefined') return;
    const key = this.getKey(username);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Error al guardar datos:', e);
    }
  }

  // Obtener datos iniciales (Miguel recibe la plantilla Excel completa, nuevos usuarios reciben starter limpio)
  public static getDefaultData(username: string): UserFinancialData {
    if (username.toLowerCase() === 'miguel') {
      return {
        categories: initialCategories,
        paymentMethods: initialPaymentMethods,
        transactions: initialTransactions,
        receivables: initialReceivables,
        payables: initialPayables,
        cardPayments: initialCardPayments,
        salaries: initialSalaries,
        extraIncomes: DEFAULT_EXTRA_INCOMES,
        initialDebitBalances: DEFAULT_INITIAL_DEBIT_BALANCES
      };
    }

    // Nuevo usuario con plantilla limpia y cuentas con UUID estándar
    return {
      categories: initialCategories,
      paymentMethods: [
        {
          id: 'd1111111-1111-4111-a111-111111111111',
          name: 'Cuenta Débito Principal',
          type: 'debit',
          color: '#10b981',
          icon: 'Landmark',
          isActive: true
        },
        {
          id: 'c2222222-2222-4222-b222-222222222222',
          name: 'Tarjeta de Crédito',
          type: 'credit',
          billingCloseDay: 25,
          paymentDueDay: 20,
          creditLimit: 3000,
          color: '#2563eb',
          icon: 'CreditCard',
          isActive: true
        }
      ],
      transactions: [],
      receivables: [],
      payables: [],
      cardPayments: [],
      salaries: [
        {
          id: 'sal-1',
          source: 'Sueldo / Empleo Principal',
          amount: 2500.00,
          payDay: 30
        }
      ],
      extraIncomes: {},
      initialDebitBalances: {
        [`${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`]: 1000.00
      }
    };
  }
}
