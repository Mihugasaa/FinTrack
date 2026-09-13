import { PaymentMethod, Transaction, MonthlyBudget, Receivable, LiquidityDiagnostic, CardDebtSummary, OtherIncome, Payable } from '@/types';
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

  const corte = method.billingCloseDay;
  const pago = method.paymentDueDay || corte;

  // 1. Determinar fecha de cierre de facturación
  let cierreYear = year;
  let cierreMonth = month;

  if (day > corte) {
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
  const daysInDueMonth = new Date(dueYear, dueMonth, 0).getDate();
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
  referenceDate: Date = new Date()
): {
  recommendedCard?: PaymentMethod;
  creditDays: number;
  reason: string;
  allRanked: { card: PaymentMethod; creditDays: number; daysUntilClose: number }[];
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

    // Días hasta el próximo corte
    let closeDateThisMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), card.billingCloseDay);
    if (referenceDate.getDate() > (card.billingCloseDay || 0)) {
      closeDateThisMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, card.billingCloseDay);
    }
    const daysUntilClose = Math.max(0, Math.ceil((closeDateThisMonth.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      card,
      creditDays,
      daysUntilClose
    };
  });

  evaluated.sort((a, b) => b.creditDays - a.creditDays);

  const best = evaluated[0];
  const reason = `Te otorga ${best.creditDays} días de crédito sin intereses. Su corte es el día ${best.card.billingCloseDay} (en ${best.daysUntilClose} días) y pagarás recién el ${calculatePaymentDueDate(todayStr, best.card)}.`;

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

  // 1. Sueldos
  let salariesReceivedToday = 0;
  let salariesPending = 0;
  const primarySalary = salaries[0] || { amount: 2126.49, payDay: 30 };
  const salaryPayDay = primarySalary.payDay || 30;

  salaries.forEach(sal => {
    if (currentDay >= sal.payDay) {
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

  // 3. Cobranzas a terceros ya cobradas
  const collectedFromDebtors = receivables.reduce((acc, curr) => acc + curr.paidAmount, 0);

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
    borrowedCreditedToDebitToday
  };
}

/**
 * Diagnóstico de Liquidez Mensual ("¿Puedo cubrir este mes?")
 */
export function calculateMonthlyDiagnostic(
  budget: MonthlyBudget,
  transactions: Transaction[],
  receivables: Receivable[],
  allTransactions: Transaction[]
): LiquidityDiagnostic {
  // 1. Total Ingresos = Sueldo + Otros Ingresos
  const otherIncomesTotal = budget.otherIncomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalIncome = budget.baseSalary + otherIncomesTotal;

  // 2. Gastos consumidos en este mes calendario (descontando reembolsos y devoluciones)
  const totalExpensesConsumed = transactions.reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

  // 3. Saldo simple restante (Ingresos - Gastos)
  const simpleRemaining = totalIncome - totalExpensesConsumed;
  const savingsRatePercentage = totalIncome > 0 ? (simpleRemaining / totalIncome) * 100 : 0;

  // 4. Cobranzas a terceros cobradas
  const collectedReceivables = receivables.reduce((acc, curr) => acc + curr.paidAmount, 0);

  // 5. Total disponible en cuenta
  const totalAvailable = budget.initialDebitBalance + totalIncome + collectedReceivables;

  // 6. Salida Real de Dinero del Mes:
  // Todos los pagos cuya FECHA DE PAGO calculada cae en este año y mes (descontando reembolsos)
  const targetYearMonth = `${budget.year}-${budget.month.toString().padStart(2, '0')}`;
  
  const realCashOutflow = allTransactions
    .filter(t => t.paymentDueDate.startsWith(targetYearMonth))
    .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

  // 7. Margen de Liquidez
  const liquidityMargin = totalAvailable - realCashOutflow;
  const isPositive = liquidityMargin >= 0;

  const statusText = isPositive
    ? `Alcanza: sobra S/ ${liquidityMargin.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `NO ALCANZA: falta S/ ${Math.abs(liquidityMargin).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return {
    totalAvailable,
    realCashOutflow,
    liquidityMargin,
    isPositive,
    statusText,
    savingsRatePercentage,
    totalExpensesConsumed,
    simpleRemaining
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

    // Días hasta corte y pago
    let closeDate = new Date(currentYear, currentMonth - 1, card.billingCloseDay || 1);
    if (now.getDate() > (card.billingCloseDay || 1)) {
      closeDate = new Date(currentYear, currentMonth, card.billingCloseDay || 1);
    }
    const daysUntilClose = Math.max(0, Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    let paymentDate = new Date(currentYear, currentMonth - 1, card.paymentDueDay || 1);
    if (now.getDate() > (card.paymentDueDay || 1)) {
      paymentDate = new Date(currentYear, currentMonth, card.paymentDueDay || 1);
    }
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
    const maxDays = new Date(currentYear, currentMonth, 0).getDate();
    const actualDay = Math.min(day, maxDays).toString().padStart(2, '0');
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
