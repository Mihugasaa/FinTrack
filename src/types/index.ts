export type CurrencyCode = 'PEN' | 'USD';

export type PaymentMethodType = 'debit' | 'credit' | 'cash';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  budgetLimit?: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  billingCloseDay?: number; // Día de corte
  paymentDueDay?: number;   // Día de pago
  color: string;
  icon: string;
  isActive: boolean;
  creditLimit?: number;
  initialDebt?: number; // Deuda previa arrastrada de meses anteriores (ej. Agosto)
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  categoryId: string;
  paymentMethodId: string;
  currency: CurrencyCode;
  originalAmount: number;
  exchangeRate: number;
  amountPen: number;
  paymentDueDate: string; // YYYY-MM-DD (Calculado por ciclo)
  isFixedSubscription?: boolean;
  isRefund?: boolean;
  isInstallment?: boolean;
  totalInstallments?: number;
  currentInstallment?: number;
  installmentPlanId?: string;
  originalTotalAmount?: number;
  hasInterest?: boolean;
  notes?: string;
}

export interface Receivable {
  id: string;
  debtorName: string;
  description: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency?: CurrencyCode;
  exchangeRate?: number;
  amountPen?: number;
  loanDate?: string;
  status: 'pending' | 'partial' | 'paid';
  dueDate?: string;
  isDebitedFromAccount?: boolean;
  fundingPaymentMethodId?: string;
  createdAt: string;
}

export interface SalaryIncome {
  id: string;
  source: string;
  amount: number;
  payDay: number;
  isReceivedThisMonth?: boolean;
}

export interface OtherIncome {
  id: string;
  description: string;
  amount: number;
  receivedDate: string;
}

export interface MonthlyBudget {
  year: number;
  month: number;
  baseSalary: number;
  salaries?: SalaryIncome[];
  initialDebitBalance: number;
  otherIncomes: OtherIncome[];
  notes?: string;
}

export interface CardDebtSummary {
  paymentMethodId: string;
  cardName: string;
  cardColor: string;
  consumedThisMonth: number;
  consumedToDate: number;
  paidThisMonth: number;
  paidToDate: number;
  initialDebt?: number;
  totalAccumulatedDebt: number;
  hasPositiveBalance?: boolean;
  creditBalanceAmount?: number;
  netBalance?: number;
  billingCloseDay: number;
  paymentDueDay: number;
  daysUntilClose: number;
  daysUntilPayment: number;
  creditDaysAdvantage: number;
  dueInSelectedMonth: number;
  paidInSelectedMonth: number;
  netDueInSelectedMonth: number;
  isPaidThisMonth: boolean;
  overdueFromPastMonths?: number;
}

export interface CardPayment {
  id?: string;
  paymentMethodId: string;
  amountPaid: number;
  paymentDate: string;
  sourceType?: 'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT';
  notes?: string;
}

export interface PayablePayment {
  id: string;
  payableId?: string;
  amountPaid: number;
  amount: number;
  paymentDate: string;
  paymentMethodId?: string;
  notes?: string;
}

export interface Payable {
  id: string;
  creditorName: string;
  description: string;
  totalAmount: number;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency?: 'PEN' | 'USD';
  exchangeRate?: number;
  amountPen?: number;
  issueDate: string;
  createdAt?: string;
  dueDate?: string;
  isCreditedToDebit?: boolean;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
  notes?: string;
  payments?: PayablePayment[];
}

export interface CreditorGroup {
  key: string;
  creditorName: string;
  items: Payable[];
  totalOriginal: number;
  totalPaid: number;
  totalRemaining: number;
  totalOriginalUsd?: number;
  totalPaidUsd?: number;
  totalRemainingUsd?: number;
  hasUsd?: boolean;
  isPureUsd?: boolean;
  paidPercentage: number;
  isFullyPaid: boolean;
}

export interface LiquidityDiagnostic {
  totalAvailable: number;         // Saldo Inicial + Sueldo + Otros Ingresos + Cobros a Terceros
  realCashOutflow: number;        // Salida real del mes (Débito del mes + Vencimientos de Tarjeta este mes)
  liquidityMargin: number;        // totalAvailable - realCashOutflow
  isPositive: boolean;            // Margen >= 0
  statusText: string;             // "Alcanza: sobra S/ X.XX" o "NO ALCANZA: falta S/ X.XX"
  savingsRatePercentage: number;  // (Ingresos - Gastos) / Ingresos
  totalExpensesConsumed: number;  // Suma de gastos con fecha de este mes
  simpleRemaining: number;        // Ingresos - Gastos de este mes
}

export interface StatementTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // Importe en la moneda del movimiento (ver currency)
  currency?: CurrencyCode; // Moneda del movimiento en el extracto (PEN por defecto)
  type: 'debit' | 'credit';
  originalRowIndex?: number;
}

export type ReconciliationMatchStatus = 'matched' | 'unmatched_in_app' | 'unmatched_in_bank' | 'amount_mismatch';

export interface ReconciliationItem {
  id: string;
  status: ReconciliationMatchStatus;
  statementTx?: StatementTransaction;
  appTx?: Transaction;
  confidence: number; // 0 to 1
  difference?: number;
  suggestedCategory?: string;
  notes?: string;
}

export interface ReconciliationSummary {
  totalStatementAmount: number;
  totalAppAmount: number;
  matchedCount: number;
  unmatchedInAppCount: number;
  unmatchedInBankCount: number;
  mismatchCount: number;
  matchPercentage: number;
  netDifference: number;
  items: ReconciliationItem[];
}

export interface AIAnomaly {
  id: string;
  type: 'duplicate_charge' | 'unusual_spike' | 'unregistered_subscription' | 'close_day_warning';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  transactionId?: string;
  amount?: number;
  date?: string;
  suggestedAction?: string;
}

export interface CashflowForecastMonth {
  year: number;
  month: number;
  monthLabel: string;
  projectedInitialBalance: number;
  expectedIncome: number;
  fixedExpenses: number;
  projectedVariableExpenses: number;
  projectedCardOutflows: number;
  totalProjectedOutflow: number;
  projectedEndingBalance: number;
  liquidityMargin: number;
  isDeficitRisk: boolean;
  // Deudas propias con vencimiento programado en este mes (salida) y cobranzas
  // esperadas de terceros con fecha de devolución en este mes (entrada).
  scheduledDebtDue?: number;
  scheduledReceivableDue?: number;
}

export interface DebtConfirmData {
  type: 'payable' | 'receivable';
  title: string;
  partyName: string;
  description: string;
  amount: number;
  currency?: 'PEN' | 'USD';
  exchangeRate?: number;
  amountPen?: number;
  date: string;
  currentRemaining: number;
  newRemaining: number;
  notes?: string;
  isDirectAction?: boolean;
  onConfirm: () => void;
}

