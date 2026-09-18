import { PaymentMethod, Transaction, MonthlyBudget, Receivable, LiquidityDiagnostic, CardDebtSummary, OtherIncome, Payable, CardPayment } from '@/types';
import { FALLBACK_USD_PEN_RATE } from './constants';

/**
 * Días feriados oficiales del sistema financiero y laboral en Perú (MM-DD)
 */
export function isPeruvianBankHoliday(month: number, day: number): boolean {
  const md = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const holidays = [
    '01-01', // Año Nuevo
    '05-01', // Día del Trabajo
    '06-07', // Batalla de Arica y Día de la Bandera
    '06-29', // San Pedro y San Pablo
    '07-23', // Día de la Fuerza Aérea del Perú
    '07-28', // Fiestas Patrias
    '07-29', // Fiestas Patrias
    '08-06', // Batalla de Junín
    '08-30', // Santa Rosa de Lima
    '10-08', // Combate de Angamos
    '11-01', // Día de Todos los Santos
    '12-08', // Inmaculada Concepción
    '12-09', // Batalla de Ayacucho
    '12-25', // Navidad
  ];
  return holidays.includes(md);
}

/**
 * Traslada una fecha al siguiente día hábil bancario si cae sábado, domingo o feriado oficial
 */
export function adjustToNextBusinessDay(dateStr: string): {
  originalDate: string;
  adjustedDate: string;
  wasAdjusted: boolean;
  originalDayOfWeek?: string;
} {
  if (!dateStr || !dateStr.includes('-')) {
    return { originalDate: dateStr, adjustedDate: dateStr, wasAdjusted: false };
  }

  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  // Usar las 12:00 para evitar desajustes por horario de verano o zonas horarias
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  const originalDay = dateObj.getDay();
  let wasAdjusted = false;

  while (true) {
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
    const curMonth = dateObj.getMonth() + 1;
    const curDay = dateObj.getDate();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = isPeruvianBankHoliday(curMonth, curDay);

    if (isWeekend || isHoliday) {
      wasAdjusted = true;
      dateObj.setDate(dateObj.getDate() + 1);
    } else {
      break;
    }
  }

  const finalY = dateObj.getFullYear();
  const finalM = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const finalD = dateObj.getDate().toString().padStart(2, '0');
  const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return {
    originalDate: dateStr,
    adjustedDate: `${finalY}-${finalM}-${finalD}`,
    wasAdjusted,
    originalDayOfWeek: daysMap[originalDay]
  };
}

export interface DueDateDetail {
  nominalDueDate: string;
  dueDate: string;
  wasAdjusted: boolean;
  originalDayOfWeek?: string;
}

/**
 * Retorna la cantidad real de días en un mes específico (1-12) y año dado
 * Ej: Febrero 2026 -> 28, Febrero 2024 -> 29, Abril -> 30, Enero -> 31
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Ajusta un día objetivo (ej. 29, 30, 31) al número máximo de días del mes.
 * Si el usuario programó el día 31 y el mes tiene 28, retorna 28.
 */
export function getEffectiveDayOfMonth(year: number, month: number, targetDay: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.max(1, Math.min(targetDay, maxDays));
}

/**
 * Devuelve la fecha ISO exacta del último día del mes: YYYY-MM-DD
 */
export function getEndOfMonthDate(year: number, month: number): string {
  const maxDays = getDaysInMonth(year, month);
  const mStr = month.toString().padStart(2, '0');
  const dStr = maxDays.toString().padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
}

/**
 * Convierte cualquier fecha (YYYY-MM-DD o ISO timestamp) al formato legible DD/MM/YYYY
 */
export function formatDisplayDate(dateStr?: string | null, fallback: string = 'Sin fecha'): string {
  if (!dateStr || typeof dateStr !== 'string') return fallback;
  const str = dateStr.trim();
  if (!str) return fallback;

  // Si ya viene en formato DD/MM/YYYY o DD-MM-YYYY
  if (/^\d{2}[\/-]\d{2}[\/-]\d{4}/.test(str)) {
    return str.replace(/-/g, '/');
  }

  // Extraer la porción de fecha (ignorar hora, T, zona horaria)
  const dateOnly = str.split('T')[0].split(' ')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    return `${day}/${month}/${y}`;
  }

  return str;
}

/**
 * Calcula la fecha de pago real según el ciclo de facturación de la tarjeta y ajusta a días hábiles
 * Réplica matemática exacta de la lógica del Excel bancario
 */
export function calculatePaymentDueDate(
  dateStr: string,
  method?: PaymentMethod,
  adjustBusinessDay: boolean = true
): string {
  if (!method || method.type !== 'credit' || !method.billingCloseDay) {
    return dateStr;
  }

  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10); // 1-12
  const day = parseInt(dStr, 10);

  const daysInCurrentMonth = getDaysInMonth(year, month);
  const corte = method.billingCloseDay;
  // En meses cortos (ej. febrero), el corte no puede exceder el fin de mes
  const effectiveCorte = Math.min(corte, daysInCurrentMonth);
  const pago = method.paymentDueDay || corte;

  // 1. Determinar fecha de cierre de facturación
  let cierreYear = year;
  let cierreMonth = month;

  if (day > effectiveCorte) {
    // Si la compra fue después del corte, entra en el ciclo del mes siguiente
    cierreMonth += 1;
    if (cierreMonth > 12) {
      cierreMonth = 1;
      cierreYear += 1;
    }
  }

  // 2. Determinar fecha límite de pago
  let dueYear = cierreYear;
  let dueMonth = cierreMonth;

  if (pago <= corte) {
    // El pago vence en el mes siguiente al cierre
    dueMonth += 1;
    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }
  }

  // Ajustar si el día excede el fin de mes (ej. día 30 en febrero)
  const daysInDueMonth = getDaysInMonth(dueYear, dueMonth);
  const finalDay = Math.min(pago, daysInDueMonth);

  const finalMonthStr = dueMonth.toString().padStart(2, '0');
  const finalDayStr = finalDay.toString().padStart(2, '0');
  const rawDueDate = `${dueYear}-${finalMonthStr}-${finalDayStr}`;

  if (adjustBusinessDay) {
    return adjustToNextBusinessDay(rawDueDate).adjustedDate;
  }

  return rawDueDate;
}

/**
 * Retorna detalles ampliados del vencimiento (fecha nominal vs ajustada por día hábil)
 */
export function calculatePaymentDueDateDetail(
  dateStr: string,
  method?: PaymentMethod
): DueDateDetail {
  if (!method || method.type !== 'credit' || !method.billingCloseDay) {
    return {
      nominalDueDate: dateStr,
      dueDate: dateStr,
      wasAdjusted: false
    };
  }

  const nominalDueDate = calculatePaymentDueDate(dateStr, method, false);
  const adjustment = adjustToNextBusinessDay(nominalDueDate);

  return {
    nominalDueDate,
    dueDate: adjustment.adjustedDate,
    wasAdjusted: adjustment.wasAdjusted,
    originalDayOfWeek: adjustment.originalDayOfWeek
  };
}

/**
 * Asesor Inteligente: Evalúa qué tarjeta conviene usar hoy para maximizar crédito gratis
 */
export function getBestCardRecommendation(
  cards: PaymentMethod[],
  referenceDate: Date = new Date(),
  utilizationByCard: Record<string, number> = {}
): {
  recommendedCard?: PaymentMethod;
  creditDays: number;
  reason: string;
  allRanked: { card: PaymentMethod; creditDays: number; daysUntilClose: number; utilization: number }[];
} {
  const creditCards = cards.filter(c => c.type === 'credit' && c.isActive && c.billingCloseDay);
  if (creditCards.length === 0) {
    return {
      creditDays: 0,
      reason: 'No tienes tarjetas de crédito configuradas.',
      allRanked: []
    };
  }

  const todayYear = referenceDate.getFullYear();
  const todayMonth = (referenceDate.getMonth() + 1).toString().padStart(2, '0');
  const todayDay = referenceDate.getDate().toString().padStart(2, '0');
  const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

  const evaluated = creditCards.map(card => {
    const dueDateStr = calculatePaymentDueDate(todayStr, card);
    const dueDate = new Date(dueDateStr);
    const diffTime = dueDate.getTime() - referenceDate.getTime();
    const creditDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Días hasta el próximo corte evitando desbordamiento de fin de mes en JS
    const curYear = referenceDate.getFullYear();
    const curMonth = referenceDate.getMonth(); // 0-11
    const daysThisMonth = getDaysInMonth(curYear, curMonth + 1);
    const effCloseDayThisMonth = Math.min(card.billingCloseDay || 1, daysThisMonth);

    let closeDateThisMonth = new Date(curYear, curMonth, effCloseDayThisMonth);
    if (referenceDate.getDate() > effCloseDayThisMonth) {
      let nextMonthYear = curYear;
      let nextMonth = curMonth + 1;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextMonthYear += 1;
      }
      const daysNextMonth = getDaysInMonth(nextMonthYear, nextMonth + 1);
      const effCloseDayNextMonth = Math.min(card.billingCloseDay || 1, daysNextMonth);
      closeDateThisMonth = new Date(nextMonthYear, nextMonth, effCloseDayNextMonth);
    }
    const daysUntilClose = Math.max(0, Math.ceil((closeDateThisMonth.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)));

    const utilization = Math.max(0, Math.min(100, utilizationByCard[card.id] ?? 0));

    return {
      card,
      creditDays,
      daysUntilClose,
      utilization
    };
  });

  // Orden: primero las tarjetas con utilización sana (una tarjeta casi al tope no
  // conviene para cuidar el historial crediticio ni cabría el consumo); dentro de
  // cada grupo, la que da más días de crédito sin intereses; a igualdad, la de
  // menor utilización.
  evaluated.sort((a, b) => {
    const aRisky = a.utilization >= 80 ? 1 : 0;
    const bRisky = b.utilization >= 80 ? 1 : 0;
    if (aRisky !== bRisky) return aRisky - bRisky;
    if (b.creditDays !== a.creditDays) return b.creditDays - a.creditDays;
    return a.utilization - b.utilization;
  });

  const best = evaluated[0];
  let reason = `Te da ${best.creditDays} días sin intereses: su corte es el ${best.card.billingCloseDay} (en ${best.daysUntilClose} días) y pagas recién el ${formatDisplayDate(calculatePaymentDueDate(todayStr, best.card))}.`;
  if (best.utilization >= 80) {
    reason += ` Uso al ${Math.round(best.utilization)}%. Conviene reducir el saldo antes de seguir.`;
  } else if (best.utilization > 30) {
    reason += ` Vas al ${Math.round(best.utilization)}% de la línea. Bájala del 30% para el corte y cuidas tu historial.`;
  }

  return {
    recommendedCard: best.card,
    creditDays: best.creditDays,
    reason,
    allRanked: evaluated
  };
}

export interface DebitBalanceResult {
  currentDebitBalanceToday: number;
  projectedDebitBalanceMonthEnd: number;
  salariesReceivedToday: number;
  salariesPending: number;
  isSalaryCreditedToday: boolean;
  salaryPayDay: number;
  otherIncomesReceivedToday: number;
  otherIncomesTotalMonth: number;
  collectedFromDebtors: number;
  debitExpensesPaidToday: number;
  debitExpensesPendingFuture: number;
  debitExpensesTotalMonth: number;
  debitExpenses: number;
  cardPaymentsPaidMonth: number;
  paidToCreditorsToday?: number;
  paidToCreditorsMonth?: number;
  borrowedCreditedToDebitToday?: number;
}

/**
 * Calcula el Saldo Débito Real a la fecha actual de corte (ej. 09/09/2026)
 * Réplica matemática exacta de la fórmula P9 del Excel:
 * P5 + IF(hoy >= dia_sueldo, C5, 0) + C6 + N48 - SUMIFS(debito <= hoy) - N56
 */
export function calculateCurrentDebitBalance(
  initialBalance: number,
  salaries: { id: string; source: string; amount: number; payDay: number }[],
  otherIncomes: OtherIncome[],
  receivables: Receivable[],
  monthTransactions: Transaction[],
  debitMethodIds: string[],
  cardPaymentsThisMonthTotal: number,
  currentDateStr: string,
  payables: Payable[] = []
): DebitBalanceResult {
  const currentDay = parseInt(currentDateStr.split('-')[2], 10);
  const targetYM = currentDateStr.substring(0, 7);
  const [targetYear, targetMonth] = targetYM.split('-').map(Number);

  // 1. Sueldos: se acota el día de abono a los días reales del mes consultado
  let salariesReceivedToday = 0;
  let salariesPending = 0;
  const primarySalary = salaries[0] || { amount: 2126.49, payDay: 30 };
  const salaryPayDay = getEffectiveDayOfMonth(targetYear, targetMonth, primarySalary.payDay || 30);

  salaries.forEach(sal => {
    const effectivePayDay = getEffectiveDayOfMonth(targetYear, targetMonth, sal.payDay);
    if (currentDay >= effectivePayDay) {
      salariesReceivedToday += sal.amount;
    } else {
      salariesPending += sal.amount;
    }
  });

  const isSalaryCreditedToday = salariesPending === 0 && salariesReceivedToday > 0;

  // 2. Otros ingresos recibidos hasta la fecha
  let otherIncomesReceivedToday = 0;
  let otherIncomesTotalMonth = 0;
  otherIncomes.forEach(oi => {
    otherIncomesTotalMonth += oi.amount;
    if (oi.receivedDate <= currentDateStr) {
      otherIncomesReceivedToday += oi.amount;
    }
  });

  // 3. Cobranzas a terceros ya cobradas (con paridad cambiaria en USD)
  const collectedFromDebtors = receivables.reduce((acc, curr) => {
    const isUsd = curr.currency === 'USD';
    const exRate = curr.exchangeRate || FALLBACK_USD_PEN_RATE;
    const paidPen = isUsd ? curr.paidAmount * exRate : curr.paidAmount;
    return acc + paidPen;
  }, 0);

  // 3.b Deudas mías personales (Préstamos recibidos que entraron a débito, y pagos que hice)
  let borrowedCreditedToDebitToday = 0;
  let borrowedCreditedToDebitMonth = 0;
  let paidToCreditorsToday = 0;
  let paidToCreditorsMonth = 0;

  payables.forEach(p => {
    const isUsd = p.currency === 'USD';
    const exRate = p.exchangeRate || FALLBACK_USD_PEN_RATE;
    const orig = (isUsd && p.originalAmount) ? p.originalAmount : (p.originalAmount ?? p.totalAmount ?? 0);
    const penAmount = isUsd ? (p.amountPen || orig * exRate) : orig;

    if (p.isCreditedToDebit && p.issueDate.startsWith(targetYM)) {
      borrowedCreditedToDebitMonth += penAmount;
      if (p.issueDate <= currentDateStr) {
        borrowedCreditedToDebitToday += penAmount;
      }
    }
    (p.payments || []).forEach(pay => {
      if (pay.paymentDate.startsWith(targetYM)) {
        const payPen = isUsd ? pay.amountPaid * exRate : pay.amountPaid;
        paidToCreditorsMonth += payPen;
        if (pay.paymentDate <= currentDateStr) {
          paidToCreditorsToday += payPen;
        }
      }
    });
  });

  // 4. Gastos con Débito o Efectivo (los reembolsos descuentan gasto)
  const debitTxs = monthTransactions.filter(t => debitMethodIds.includes(t.paymentMethodId));
  let debitExpensesPaidToday = 0;
  let debitExpensesPendingFuture = 0;

  debitTxs.forEach(t => {
    const netAmount = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
    if (t.date <= currentDateStr) {
      debitExpensesPaidToday += netAmount;
    } else {
      debitExpensesPendingFuture += netAmount;
    }
  });

  const debitExpensesTotalMonth = debitExpensesPaidToday + debitExpensesPendingFuture;

  // 5. Saldo Débito HOY (Fórmula P9 Excel + Préstamos Personales)
  const currentDebitBalanceToday =
    initialBalance +
    salariesReceivedToday +
    otherIncomesReceivedToday +
    collectedFromDebtors +
    borrowedCreditedToDebitToday -
    debitExpensesPaidToday -
    paidToCreditorsToday -
    cardPaymentsThisMonthTotal;

  // 6. Saldo Débito Proyectado a Fin de Mes (al cobrar el sueldo y pagar restantes)
  const totalSalaries = salaries.reduce((acc, curr) => acc + curr.amount, 0);
  const totalIncomesMonth = totalSalaries + otherIncomesTotalMonth;
  const projectedDebitBalanceMonthEnd =
    initialBalance +
    totalIncomesMonth +
    collectedFromDebtors +
    borrowedCreditedToDebitMonth -
    debitExpensesTotalMonth -
    paidToCreditorsMonth -
    cardPaymentsThisMonthTotal;

  return {
    currentDebitBalanceToday,
    projectedDebitBalanceMonthEnd,
    salariesReceivedToday,
    salariesPending,
    isSalaryCreditedToday,
    salaryPayDay,
    otherIncomesReceivedToday,
    otherIncomesTotalMonth,
    collectedFromDebtors,
    debitExpensesPaidToday,
    debitExpensesPendingFuture,
    debitExpensesTotalMonth,
    debitExpenses: debitExpensesTotalMonth,
    cardPaymentsPaidMonth: cardPaymentsThisMonthTotal,
    paidToCreditorsToday,
    paidToCreditorsMonth,
    borrowedCreditedToDebitToday
  };
}

/**
 * Mes (YYYY-MM) al que se atribuye la cobranza de una cuenta por cobrar.
 *
 * Los `Receivable` no guardan la fecha en que se recibió el pago, solo el monto
 * cobrado acumulado. Para que ese cobro se cuente UNA sola vez en el saldo de
 * débito (y no se duplique en cada mes que se visita), lo atribuimos de forma
 * determinista a un único mes: vencimiento pactado → creación → préstamo.
 */
export function getReceivableCollectionMonth(r: Receivable): string {
  return (r.dueDate || r.createdAt || r.loanDate || '').slice(0, 7);
}

/**
 * Cadena de saldos de débito mes a mes (running balance).
 *
 * El saldo inicial de cada mes se ARRASTRA automáticamente del cierre proyectado
 * del mes anterior, salvo que exista un override explícito para ese mes (la clave
 * está presente en `overrides`), que ancla el saldo y corta el arrastre aguas
 * arriba. Cada eslabón reutiliza `calculateCurrentDebitBalance` con inputs ya
 * acotados al mes, de modo que las cobranzas, abonos y payables se cuentan una
 * sola vez a lo largo de toda la cadena.
 *
 * Devuelve, por cada mes del rango con actividad, `{ initial, closing }`.
 */
export function computeMonthlyDebitChain(params: {
  overrides: Record<string, number>;
  transactions: Transaction[];
  extraIncomes: Record<string, OtherIncome[]>;
  cardPayments: { paymentMethodId: string; amountPaid: number; paymentDate: string; sourceType?: string }[];
  receivables: Receivable[];
  payables: Payable[];
  paymentMethods: PaymentMethod[];
  monthlySalaries: Record<string, number>;
  currentSalaryTotal: number;
  primaryPayDay?: number;
  extraKeys?: string[];
}): Record<string, { initial: number; closing: number }> {
  const {
    overrides,
    transactions,
    extraIncomes,
    cardPayments,
    receivables,
    payables,
    paymentMethods,
    monthlySalaries,
    currentSalaryTotal,
    primaryPayDay = 30,
    extraKeys = []
  } = params;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const isMonthKey = (k: string) => /^\d{4}-\d{2}$/.test(k);
  const pushTo = <T,>(m: Map<string, T[]>, k: string, v: T) => {
    const arr = m.get(k);
    if (arr) arr.push(v); else m.set(k, [v]);
  };

  const debitMethodIds = paymentMethods.filter(p => p.type === 'debit' || p.type === 'cash').map(p => p.id);
  const creditCardIds = paymentMethods.filter(p => p.type === 'credit').map(p => p.id);

  // "Hoy" real (mes en curso): los meses anteriores se reconcilian con movimientos
  // reales; los meses en curso/futuros restan compromisos (deudas y cuotas por vencer).
  const nowRef = new Date();
  const realTodayKey = `${nowRef.getFullYear()}-${(nowRef.getMonth() + 1).toString().padStart(2, '0')}`;

  // Índices por mes: evita recorrer todo el historial en cada eslabón de la cadena.
  const txByMonth = new Map<string, Transaction[]>();
  transactions.forEach(t => {
    const k = (t.date || '').slice(0, 7);
    if (isMonthKey(k)) pushTo(txByMonth, k, t);
  });

  const cardByMonth = new Map<string, number>();
  cardPayments.forEach(p => {
    if (p.sourceType === 'MERCHANT_REFUND' || p.sourceType === 'BANK_CREDIT') return;
    const k = (p.paymentDate || '').slice(0, 7);
    if (isMonthKey(k)) cardByMonth.set(k, (cardByMonth.get(k) || 0) + p.amountPaid);
  });

  // Cuotas/estados de cuenta de tarjeta por VENCIMIENTO bancario, por mes (neto de
  // reembolsos): lo que hay que pagar cada mes para no generar intereses.
  const cardBillDueByMonth = new Map<string, number>();
  transactions.forEach(t => {
    if (!creditCardIds.includes(t.paymentMethodId)) return;
    const k = (t.paymentDueDate || '').slice(0, 7);
    if (!isMonthKey(k)) return;
    const net = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
    cardBillDueByMonth.set(k, (cardBillDueByMonth.get(k) || 0) + net);
  });

  // Deudas propias con vencimiento programado, por mes (saldo pendiente en PEN).
  const scheduledDueByMonth = new Map<string, number>();
  payables.forEach(p => {
    if (p.status === 'PAID') return;
    const k = (p.dueDate || '').slice(0, 7);
    if (!isMonthKey(k)) return;
    const rem = p.remainingAmount ?? (p.totalAmount ?? p.originalAmount ?? 0);
    const pen = p.currency === 'USD' ? rem * (p.exchangeRate || FALLBACK_USD_PEN_RATE) : rem;
    // Si la deuda venció antes del mes en curso y sigue impaga, es un compromiso exigible hoy
    const targetKey = k < realTodayKey ? realTodayKey : k;
    scheduledDueByMonth.set(targetKey, (scheduledDueByMonth.get(targetKey) || 0) + Math.max(0, pen));
  });

  const recByMonth = new Map<string, Receivable[]>();
  receivables.forEach(r => {
    if (!r.paidAmount) return; // sin cobro no aporta caja
    const k = getReceivableCollectionMonth(r);
    if (isMonthKey(k)) pushTo(recByMonth, k, r);
  });

  // Universo de meses relevantes: overrides, gastos (por fecha y por vencimiento),
  // ingresos extra, abonos a tarjeta, cobranzas y los meses extra solicitados
  // (mes visible / mes en curso) para que el rango cubra la vista actual.
  const keys = new Set<string>();
  Object.keys(overrides).forEach(k => { if (isMonthKey(k)) keys.add(k); });
  txByMonth.forEach((_, k) => keys.add(k));
  transactions.forEach(t => { const k = (t.paymentDueDate || '').slice(0, 7); if (isMonthKey(k)) keys.add(k); });
  Object.keys(extraIncomes).forEach(k => { if (isMonthKey(k)) keys.add(k); });
  cardByMonth.forEach((_, k) => keys.add(k));
  scheduledDueByMonth.forEach((_, k) => keys.add(k));
  recByMonth.forEach((_, k) => keys.add(k));
  extraKeys.forEach(k => { if (isMonthKey(k)) keys.add(k); });

  if (keys.size === 0) return {};

  const sorted = Array.from(keys).sort();
  let [y, m] = sorted[0].split('-').map(Number);
  const [ey, em] = sorted[sorted.length - 1].split('-').map(Number);

  const out: Record<string, { initial: number; closing: number }> = {};
  let carry = 0;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 600) {
    guard++;
    const key = `${y}-${m.toString().padStart(2, '0')}`;
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, key);
    const initial = hasOverride ? overrides[key] : carry;

    const salaryAmt = monthlySalaries[key] || currentSalaryTotal;
    const effectivePayDay = getEffectiveDayOfMonth(y, m, primaryPayDay);
    const salariesArr = [{ id: 'chain-salary', source: 'salary', amount: salaryAmt, payDay: effectivePayDay }];
    const endOfMonthDate = getEndOfMonthDate(y, m);

    const res = calculateCurrentDebitBalance(
      initial,
      salariesArr,
      extraIncomes[key] || [],
      recByMonth.get(key) || [],
      txByMonth.get(key) || [],
      debitMethodIds,
      cardByMonth.get(key) || 0,
      endOfMonthDate,
      payables
    );

    // Compromisos que reducen la caja proyectada del mes: deudas propias por vencer +
    // cuotas de tarjeta por vencer no cubiertas por los abonos del mes. Solo en meses
    // en curso o futuros (en meses cerrados el saldo real ya refleja lo pagado). Se
    // restan del CIERRE para que lo proyectado que ve el usuario sea EXACTAMENTE lo que
    // se arrastra al mes siguiente (arrastre consistente entre meses).
    const commitments = key >= realTodayKey
      ? (scheduledDueByMonth.get(key) || 0) +
        Math.max(0, (cardBillDueByMonth.get(key) || 0) - (cardByMonth.get(key) || 0))
      : 0;

    const closing = round2(res.projectedDebitBalanceMonthEnd - commitments);
    out[key] = { initial: round2(initial), closing };
    carry = closing;

    m++;
    if (m > 12) { m = 1; y++; }
  }

  return out;
}

/**
 * Diagnóstico de Liquidez Mensual ("¿Puedo cubrir este mes?")
 *
 * Mide la capacidad de pago del mes unificando todos los flujos de caja reales y
 * compromisos bancarios:
 * - Entradas: saldo inicial + sueldos + otros ingresos + cobranzas + préstamos recibidos a débito.
 * - Salidas ejecutadas: gastos en débito/efectivo + abonos a tarjeta + pagos a acreedores efectuados este mes.
 * - Compromisos por vencer: cuotas de tarjeta pendientes del mes + deudas propias programadas por vencer.
 *
 * Conserva la invariancia contable: pagar una deuda anticipadamente dentro del mismo mes
 * transfiere el saldo de "compromiso pendiente" a "salida pagada", manteniendo el
 * Margen de fin de mes exactamente inalterado.
 */
export function calculateMonthlyDiagnostic(
  budget: MonthlyBudget,
  transactions: Transaction[],
  receivables: Receivable[],
  allTransactions: Transaction[],
  payables: Payable[] = [],
  cardPayments: CardPayment[] = [],
  paymentMethods: PaymentMethod[] = [],
  isPastMonth: boolean = false
): LiquidityDiagnostic {
  const targetYearMonth = `${budget.year}-${budget.month.toString().padStart(2, '0')}`;

  // 1. Total Ingresos = Sueldo + Otros Ingresos
  const otherIncomesTotal = budget.otherIncomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalIncome = budget.baseSalary + otherIncomesTotal;

  // 2. Gastos consumidos en este mes calendario (descontando reembolsos y devoluciones)
  const totalExpensesConsumed = transactions.reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

  // 3. Saldo simple restante (Ingresos - Gastos). Tasa de ahorro = ingresos vs gasto
  // devengado (no toca deudas/cobranzas: mide cuánto del ingreso te quedas).
  const simpleRemaining = totalIncome - totalExpensesConsumed;
  const savingsRatePercentage = totalIncome > 0 ? (simpleRemaining / totalIncome) * 100 : 0;

  // 4. Cobranzas a terceros cobradas (con paridad cambiaria en USD)
  const collectedReceivables = receivables.reduce((acc, curr) => {
    const isUsd = curr.currency === 'USD';
    const exRate = curr.exchangeRate || FALLBACK_USD_PEN_RATE;
    const paidPen = isUsd ? curr.paidAmount * exRate : curr.paidAmount;
    return acc + paidPen;
  }, 0);

  // 4.b Préstamos recibidos acreditados a débito ESTE mes: entran como caja real
  // disponible (mismo criterio que el saldo de débito).
  const borrowedToDebit = payables
    .filter(p => p.isCreditedToDebit && (p.issueDate || '').startsWith(targetYearMonth))
    .reduce((acc, p) => {
      const isUsd = p.currency === 'USD';
      const orig = (isUsd && p.originalAmount) ? p.originalAmount : (p.originalAmount ?? p.totalAmount ?? 0);
      const pen = isUsd ? (p.amountPen || orig * (p.exchangeRate || FALLBACK_USD_PEN_RATE)) : orig;
      return acc + Math.max(0, pen);
    }, 0);

  // 5. Total disponible en cuenta (incluye préstamos acreditados a débito)
  const totalAvailable = budget.initialDebitBalance + totalIncome + collectedReceivables + borrowedToDebit;

  // 6.a Amortizaciones pagadas a acreedores en este mes (salida de caja real ejecutada):
  let paidPayablesThisMonth = 0;
  payables.forEach(p => {
    const isUsd = p.currency === 'USD';
    const exRate = p.exchangeRate || FALLBACK_USD_PEN_RATE;
    (p.payments || []).forEach(pay => {
      if ((pay.paymentDate || '').startsWith(targetYearMonth)) {
        const amt = pay.amountPaid || pay.amount || 0;
        paidPayablesThisMonth += isUsd ? amt * exRate : amt;
      }
    });
  });

  // 6.b Deudas propias pendientes con vencimiento este mes (o vencidas impagas de meses previos si no es mes cerrado):
  const scheduledPayablesDue = payables
    .filter(p => {
      if (p.status === 'PAID') return false;
      const due = (p.dueDate || '');
      if (due.startsWith(targetYearMonth)) return true;
      if (!isPastMonth && due.length >= 7 && due < targetYearMonth) return true;
      return false;
    })
    .reduce((acc, p) => {
      const rem = p.remainingAmount ?? (p.totalAmount ?? p.originalAmount ?? 0);
      const pen = p.currency === 'USD' ? rem * (p.exchangeRate || FALLBACK_USD_PEN_RATE) : rem;
      return acc + Math.max(0, pen);
    }, 0);

  // 6.c Salidas de tarjeta de crédito y gastos débito:
  const creditCardIds = paymentMethods.filter(p => p.type === 'credit').map(p => p.id);
  let debitExpensesThisMonth = 0;
  let cardOutflowThisMonth = 0;

  if (paymentMethods.length > 0) {
    // Gastos pagados con débito o efectivo en el mes
    debitExpensesThisMonth = transactions
      .filter(t => !creditCardIds.includes(t.paymentMethodId))
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    // Abonos pagados a tarjeta en el mes (excluyendo reembolsos de banco o comercio)
    const cardPaymentsTotal = cardPayments
      .filter(p => p.paymentDate.startsWith(targetYearMonth) && p.sourceType !== 'MERCHANT_REFUND' && p.sourceType !== 'BANK_CREDIT')
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    // Vencimientos de tarjeta este mes (netos de reembolsos)
    const cardBillsDue = allTransactions
      .filter(t => creditCardIds.includes(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYearMonth))
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    // En mes cerrado manda lo efectivamente abonado. En mes en curso/futuro manda el mayor entre lo abonado y lo que vence
    cardOutflowThisMonth = isPastMonth
      ? cardPaymentsTotal
      : Math.max(cardPaymentsTotal, Math.max(0, cardBillsDue));
  } else {
    // Fallback si no se pasan paymentMethods: usa cálculo por vencimiento de allTransactions
    cardOutflowThisMonth = allTransactions
      .filter(t => t.paymentDueDate.startsWith(targetYearMonth))
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);
  }

  // Salida total de caja del mes (incluye pagos ya realizados a acreedores):
  const realCashOutflow = debitExpensesThisMonth + cardOutflowThisMonth + paidPayablesThisMonth;

  // 7. Margen de Liquidez = disponible - salidas del mes (débito + tarjetas + deudas pagadas) - deudas pendientes programadas
  const liquidityMargin = Math.round((totalAvailable - realCashOutflow - scheduledPayablesDue) * 100) / 100;
  const isPositive = liquidityMargin >= 0;

  const statusText = isPositive
    ? `Alcanza: sobra S/ ${liquidityMargin.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `NO ALCANZA: falta S/ ${Math.abs(liquidityMargin).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return {
    totalAvailable: Math.round(totalAvailable * 100) / 100,
    realCashOutflow: Math.round(realCashOutflow * 100) / 100,
    liquidityMargin,
    isPositive,
    statusText,
    savingsRatePercentage,
    totalExpensesConsumed,
    simpleRemaining
  };
}

/**
 * Score de Salud Financiera DETERMINISTA y explicable (0-100).
 *
 * Se calcula íntegramente en código (sin IA) para que sea reproducible: los mismos
 * datos siempre dan el mismo puntaje. La IA solo se usa después para redactar y
 * priorizar en lenguaje natural, nunca para inventar el número.
 *
 * Ponderación: liquidez 35 · tasa de ahorro 30 · carga de deuda TC 20 · tendencia 15.
 */
export type HealthLevel = 'Excelente' | 'Saludable' | 'Alerta' | 'Crítico';

export interface HealthScoreComponent {
  key: string;
  label: string;
  points: number;   // puntos obtenidos
  max: number;      // puntos posibles
  detail: string;   // explicación breve del porqué
}

export interface FinancialHealthResult {
  score: number;
  level: HealthLevel;
  components: HealthScoreComponent[];
  trend: { avgPriorSavings: number; currentSavings: number; improving: boolean };
}

export function computeFinancialHealthScore(params: {
  totalIncome: number;
  liquidityMargin: number;
  savingsRatePercentage: number;
  cardObligations: number;   // consumo + deuda inicial acumulados a la fecha
  cardPaid: number;          // pagado a la fecha
  historicalFlow: { key: string; savings: number; isProjected: boolean }[];
  currentMonthKey: string;
}): FinancialHealthResult {
  const {
    totalIncome,
    liquidityMargin,
    savingsRatePercentage,
    cardObligations,
    cardPaid,
    historicalFlow,
    currentMonthKey
  } = params;

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const income = totalIncome > 0 ? totalIncome : 1;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // 1. Liquidez (35): margen del mes relativo al ingreso. -20% → 0 pts, +20% → 35 pts.
  const marginRatio = liquidityMargin / income;
  const liquidityPts = clamp01((marginRatio + 0.2) / 0.4) * 35;

  // 2. Tasa de ahorro (30): meta 20%. 0% → 0 pts, ≥20% → 30 pts.
  const savingsPts = clamp01(savingsRatePercentage / 20) * 30;

  // 3. Carga de deuda TC (20): deuda neta pendiente relativa al ingreso mensual.
  const netDebt = Math.max(0, cardObligations - cardPaid);
  const debtBurden = netDebt / income;
  const debtPts = clamp01(1 - debtBurden) * 20;

  // 4. Tendencia (15): ahorro del mes vs promedio de meses cerrados anteriores.
  const priorClosed = historicalFlow.filter(m => !m.isProjected && m.key < currentMonthKey);
  const avgPriorSavings = priorClosed.length > 0
    ? priorClosed.reduce((acc, m) => acc + m.savings, 0) / priorClosed.length
    : 0;
  const currentSavings = historicalFlow.find(m => m.key === currentMonthKey)?.savings ?? 0;
  let trendPts: number;
  if (priorClosed.length === 0) {
    trendPts = 7.5; // sin histórico suficiente: neutral
  } else {
    const trendRatio = (currentSavings - avgPriorSavings) / income;
    trendPts = clamp01(0.5 + trendRatio * 2) * 15;
  }

  const rawScore = liquidityPts + savingsPts + debtPts + trendPts;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const level: HealthLevel = score >= 80 ? 'Excelente' : score >= 60 ? 'Saludable' : score >= 40 ? 'Alerta' : 'Crítico';

  const components: HealthScoreComponent[] = [
    {
      key: 'liquidity',
      label: 'Liquidez del mes',
      points: round1(liquidityPts),
      max: 35,
      detail: liquidityMargin >= 0
        ? `Margen positivo de ${(marginRatio * 100).toFixed(0)}% sobre tus ingresos.`
        : `Déficit de ${Math.abs(marginRatio * 100).toFixed(0)}% frente a tus ingresos.`
    },
    {
      key: 'savings',
      label: 'Tasa de ahorro',
      points: round1(savingsPts),
      max: 30,
      detail: `Ahorras ${savingsRatePercentage.toFixed(1)}% del ingreso • meta 20%.`
    },
    {
      key: 'debt',
      label: 'Carga de deuda TC',
      points: round1(debtPts),
      max: 20,
      detail: netDebt > 0
        ? `Deuda neta pendiente equivale a ${(debtBurden * 100).toFixed(0)}% de un mes de ingreso.`
        : 'Sin deuda de tarjeta pendiente.'
    },
    {
      key: 'trend',
      label: 'Tendencia',
      points: round1(trendPts),
      max: 15,
      detail: priorClosed.length === 0
        ? 'Aún no hay meses cerrados previos para comparar.'
        : currentSavings >= avgPriorSavings
        ? 'Tu ahorro mejora respecto a meses anteriores.'
        : 'Tu ahorro cae respecto a meses anteriores.'
    }
  ];

  return {
    score,
    level,
    components,
    trend: {
      avgPriorSavings: round1(avgPriorSavings),
      currentSavings: round1(currentSavings),
      improving: currentSavings >= avgPriorSavings
    }
  };
}

/**
 * Resumen de Deuda y Estado por Tarjeta de Crédito
 */
export function calculateCardsDebtSummary(
  cards: PaymentMethod[],
  currentMonthTransactions: Transaction[],
  allTransactions: Transaction[],
  cardPayments: { paymentMethodId: string; amountPaid: number; paymentDate: string }[],
  currentYear: number,
  currentMonth: number
): CardDebtSummary[] {
  const creditCards = cards.filter(c => c.type === 'credit');

  return creditCards.map(card => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const targetYM = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

    // Match by direct id, or by same-name alias against the real methods list
    // (handles a legacy id that points to a card now stored under a new id).
    const matchesCard = (methodId?: string) => {
      if (!methodId) return false;
      if (methodId === card.id) return true;
      const aliased = cards.find(p => p.id === methodId);
      return !!aliased && aliased.name.toLowerCase() === card.name.toLowerCase();
    };

    // Consumo total registrado en el mes calendario (incluye programados y descuenta reembolsos)
    const consumedThisMonth = currentMonthTransactions
      .filter(t => matchesCard(t.paymentMethodId))
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    // Consumo acumulado devengado en la tarjeta a la fecha de hoy across ALL history:
    // Incluye todos los consumos realizados con esta tarjeta hasta la fecha de hoy (t.date <= todayStr),
    // descontando reembolsos de comercio y devoluciones.
    const consumedToDate = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && t.date <= todayStr)
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    // Pagado total en el mes calendario seleccionado
    const paidThisMonth = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate.startsWith(targetYM))
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    // Pagos y abonos acumulados efectivamente realizados a la tarjeta a la fecha de hoy across ALL history:
    const paidToDate = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate <= todayStr)
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    const initialDebt = card.initialDebt || 0;

    // Balance neto real a la fecha de hoy:
    // Deuda previa arrastrada + compras devengadas hasta hoy - abonos/reembolsos realizados hasta hoy
    const netBalance = initialDebt + consumedToDate - paidToDate;
    const hasPositiveBalance = netBalance < -0.009;
    const creditBalanceAmount = hasPositiveBalance ? Math.abs(netBalance) : 0;
    const totalAccumulatedDebt = Math.max(0, netBalance);

    // Días hasta corte y pago evitando desbordamiento de mes en JS
    const daysInCurMonth = getDaysInMonth(currentYear, currentMonth);
    const effCloseDay = Math.min(card.billingCloseDay || 1, daysInCurMonth);

    let nextCloseYear = currentYear;
    let nextCloseMonth = currentMonth; // 1-12
    if (now.getDate() > effCloseDay) {
      nextCloseMonth += 1;
      if (nextCloseMonth > 12) {
        nextCloseMonth = 1;
        nextCloseYear += 1;
      }
    }
    const daysInCloseMonth = getDaysInMonth(nextCloseYear, nextCloseMonth);
    const finalCloseDay = Math.min(card.billingCloseDay || 1, daysInCloseMonth);
    const closeDate = new Date(nextCloseYear, nextCloseMonth - 1, finalCloseDay);
    const daysUntilClose = Math.max(0, Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const effPayDay = Math.min(card.paymentDueDay || 1, daysInCurMonth);
    let nextPayYear = currentYear;
    let nextPayMonth = currentMonth;
    if (now.getDate() > effPayDay) {
      nextPayMonth += 1;
      if (nextPayMonth > 12) {
        nextPayMonth = 1;
        nextPayYear += 1;
      }
    }
    const daysInPayMonth = getDaysInMonth(nextPayYear, nextPayMonth);
    const finalPayDay = Math.min(card.paymentDueDay || 1, daysInPayMonth);
    const paymentDate = new Date(nextPayYear, nextPayMonth - 1, finalPayDay);
    const daysUntilPayment = Math.max(0, Math.ceil((paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const dueDateStr = calculatePaymentDueDate(todayStr, card);
    const dueDate = new Date(dueDateStr);
    const creditDaysAdvantage = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // ==========================================
    // CRONOGRAMA MENSUAL DE VENCIMIENTOS (targetYM)
    // ==========================================
    // 1. Compras cuyo vencimiento bancario cae en el mes seleccionado
    const dueInSelectedMonth = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYM))
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    // 2. Abonos registrados a la tarjeta en el mes seleccionado
    const paidInSelectedMonth = paidThisMonth;

    // 3. Saldo neto exigible en este mes
    let netDueInSelectedMonth = Math.max(0, dueInSelectedMonth - paidInSelectedMonth);
    if (hasPositiveBalance) {
      netDueInSelectedMonth = 0;
    }

    const isPaidThisMonth = dueInSelectedMonth > 0 && paidInSelectedMonth >= dueInSelectedMonth;

    // 4. Saldo vencido arrastrado de meses previos sin pagar
    const dueBeforeSelectedMonth = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && (t.paymentDueDate || '') < `${targetYM}-01`)
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    const paidBeforeSelectedMonth = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && (p.paymentDate || '') < `${targetYM}-01`)
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    const overdueFromPastMonths = Math.max(0, dueBeforeSelectedMonth - paidBeforeSelectedMonth);

    return {
      paymentMethodId: card.id,
      cardName: card.name,
      cardColor: card.color,
      consumedThisMonth,
      consumedToDate,
      paidThisMonth,
      paidToDate,
      initialDebt,
      totalAccumulatedDebt,
      hasPositiveBalance,
      creditBalanceAmount,
      netBalance,
      billingCloseDay: card.billingCloseDay || 0,
      paymentDueDay: card.paymentDueDay || 0,
      daysUntilClose,
      daysUntilPayment,
      creditDaysAdvantage,
      dueInSelectedMonth,
      paidInSelectedMonth,
      netDueInSelectedMonth,
      isPaidThisMonth,
      overdueFromPastMonths
    };
  });
}

/**
 * Generador inteligente de Compras en Cuotas (con o sin intereses)
 * Proyecta N cuotas mensuales distribuidas en el tiempo con sus paymentDueDate bancarios
 */
export function generateInstallmentTransactions(
  baseTx: {
    description: string;
    categoryId: string;
    paymentMethodId: string;
    currency: 'PEN' | 'USD';
    date: string; // YYYY-MM-DD
    notes?: string;
    isFixedSubscription?: boolean;
  },
  totalInstallments: number,
  totalAmount: number,
  exchangeRate: number,
  method?: PaymentMethod,
  monthlyInstallmentOverride?: number
): Transaction[] {
  const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const monthlyAmount = monthlyInstallmentOverride && monthlyInstallmentOverride > 0
    ? monthlyInstallmentOverride
    : Number((totalAmount / totalInstallments).toFixed(2));

  const results: Transaction[] = [];
  const [baseYStr, baseMStr, baseDStr] = baseTx.date.split('-');
  let currentYear = parseInt(baseYStr, 10);
  let currentMonth = parseInt(baseMStr, 10); // 1-12
  const day = parseInt(baseDStr, 10);

  for (let i = 1; i <= totalInstallments; i++) {
    const monthStr = currentMonth.toString().padStart(2, '0');
    const actualDay = getEffectiveDayOfMonth(currentYear, currentMonth, day).toString().padStart(2, '0');
    const txDate = `${currentYear}-${monthStr}-${actualDay}`;

    // Calcular la fecha de pago bancaria según el ciclo de la tarjeta
    const paymentDueDate = calculatePaymentDueDate(txDate, method);

    results.push({
      ...baseTx,
      id: `tx-${Date.now()}-c${i}-${Math.random().toString(36).substring(2, 5)}`,
      date: txDate,
      originalAmount: monthlyAmount,
      exchangeRate,
      amountPen: baseTx.currency === 'USD' ? Number((monthlyAmount * exchangeRate).toFixed(2)) : monthlyAmount,
      paymentDueDate,
      isInstallment: true,
      totalInstallments,
      currentInstallment: i,
      installmentPlanId: planId,
      originalTotalAmount: totalAmount,
      hasInterest: Boolean(monthlyInstallmentOverride && monthlyInstallmentOverride > (totalAmount / totalInstallments + 0.05)),
      description: `${baseTx.description} (Cuota ${i}/${totalInstallments})`
    });

    // Avanzar 1 mes
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
  }

  return results;
}

export function formatSoles(amount?: number | null): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `S/ ${num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Determina la fecha de cobro para préstamos históricos que no cuenten con tabla
 * de amortizaciones hija (receivable_payments).
 * Si updatedAt coincide con la fecha de desembolso (loanDate) o de creación,
 * NO es la fecha de pago (es solo la fecha en que se registró el préstamo original);
 * en tal caso retorna currentDateStr.
 */
export function getFallbackReceivablePaymentDate(r: Receivable, monthKey: string, currentDateStr: string): string {
  const upDay = r.updatedAt ? r.updatedAt.split('T')[0] : '';
  const loanDay = r.loanDate || '';
  const createdDay = r.createdAt ? r.createdAt.split('T')[0] : '';

  if (upDay && upDay !== loanDay && upDay !== createdDay && upDay.startsWith(monthKey)) {
    return upDay;
  }
  return currentDateStr;
}

