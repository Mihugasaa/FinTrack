import {
  PaymentMethod,
  Transaction,
  MonthlyBudget,
  Receivable,
  LiquidityDiagnostic,
  CardDebtSummary,
  OtherIncome,
  Payable,
  CardPayment,
  CardLiquidityStatus,
  CardLiquidityCoverage,
  CardPaymentPlanItem,
  CardsGlobalLiquidityAssessment,
  CardMonthCoverage,
  CardAmortizationSchedule
} from '@/types';
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

/**
 * Traslada una fecha al día hábil bancario anterior si cae sábado, domingo o feriado oficial
 * (regla estándar bancaria para el corte contable de facturación de tarjetas de crédito)
 */
export function adjustToPreviousBusinessDay(dateStr: string): {
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
      dateObj.setDate(dateObj.getDate() - 1);
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

/**
 * Calcula el Impuesto a las Transacciones Financieras (ITF) en Perú (0.005%)
 * según el TUO de la Ley N° 28194 y la regla oficial de redondeo bancario de la SBS / SUNAT:
 * 1. Multiplica el monto por la alícuota 0.00005 (0.005%).
 * 2. Trunca a 2 decimales (elimina el 3er decimal en adelante).
 * 3. Si el 2do decimal es >= 5, ajusta a 5 céntimos; si es < 5, ajusta a 0 céntimos.
 * 4. Por efecto del redondeo, toda operación menor a S/ 1,000.00 genera S/ 0.00 de ITF.
 */
export function calculateItf(amount: number): number {
  if (!amount || isNaN(amount) || amount < 1000) return 0;
  const raw = amount * 0.00005;
  const truncated = Math.floor(raw * 100) / 100;
  const secondDecimal = Math.round((truncated * 100) % 10);
  const integerAndTenths = Math.floor(truncated * 10) / 10;
  
  return secondDecimal >= 5 
    ? Math.round((integerAndTenths + 0.05) * 100) / 100 
    : Math.round(integerAndTenths * 100) / 100;
}

/**
 * Retorna la fecha exacta de corte de facturación para un año y mes dados,
 * ajustando al día hábil anterior si cae sábado, domingo o feriado oficial bancario.
 */
export function getEffectiveBillingCloseDate(
  year: number,
  month: number,
  billingCloseDay: number,
  adjustPriorBusinessDay: boolean = true
): {
  nominalDate: string;
  effectiveDate: string;
  wasAdjusted: boolean;
  originalDayOfWeek?: string;
} {
  const maxDays = getDaysInMonth(year, month);
  const clampedDay = Math.min(billingCloseDay, maxDays);
  const mStr = month.toString().padStart(2, '0');
  const dStr = clampedDay.toString().padStart(2, '0');
  const nominalDate = `${year}-${mStr}-${dStr}`;

  if (!adjustPriorBusinessDay) {
    return {
      nominalDate,
      effectiveDate: nominalDate,
      wasAdjusted: false
    };
  }

  const adjustment = adjustToPreviousBusinessDay(nominalDate);
  return {
    nominalDate,
    effectiveDate: adjustment.adjustedDate,
    wasAdjusted: adjustment.wasAdjusted,
    originalDayOfWeek: adjustment.originalDayOfWeek
  };
}

export interface DueDateDetail {
  nominalDueDate: string;
  dueDate: string;
  wasAdjusted: boolean;
  originalDayOfWeek?: string;
  nominalCloseDate?: string;
  effectiveCloseDate?: string;
  closeWasAdjusted?: boolean;
  closeOriginalDayOfWeek?: string;
  belongsToNextCycle?: boolean;
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
 * Extrae o infiere el día ancla original de un gasto recurrente.
 * 1. Prioridad: notas con [anchorDay:XX].
 * 2. Si no existe en notas, busca en el historial completo de transacciones de la misma suscripción
 *    (misma descripción y categoría) el día de cobro en meses de 30 o 31 días.
 * 3. Si no hay historial o el día actual no es fin de mes de febrero, usa el día de dateStr.
 */
export function resolveTransactionAnchorDay(
  dateStr: string,
  notes?: string,
  history?: Transaction[],
  description?: string,
  categoryId?: string
): number {
  if (notes) {
    const match = notes.match(/\[anchorDay:(\d+)\]/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 31) return parsed;
    }
  }

  // Si tenemos historial, buscar si en otros meses tenía un día de cobro de fin de mes (ej. 30 o 31)
  if (history && description) {
    const normDesc = description.trim().toLowerCase();
    const matches = history.filter(t =>
      t.isFixedSubscription &&
      t.description.trim().toLowerCase() === normDesc &&
      (!categoryId || t.categoryId === categoryId)
    );
    for (const m of matches) {
      if (m.anchorDay && m.anchorDay >= 1 && m.anchorDay <= 31) {
        return m.anchorDay;
      }
      if (m.notes) {
        const match = m.notes.match(/\[anchorDay:(\d+)\]/);
        if (match && match[1]) {
          const parsed = parseInt(match[1], 10);
          if (parsed >= 1 && parsed <= 31) return parsed;
        }
      }
      if (m.date) {
        const p = m.date.split('-');
        if (p.length === 3) {
          const d = parseInt(p[2], 10);
          if (d >= 29) return d;
        }
      }
    }
  }

  if (dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (parsed >= 1 && parsed <= 31) return parsed;
    }
  }
  return 30;
}

/**
 * Calcula la fecha ISO (YYYY-MM-DD) para un gasto recurrente en un año y mes objetivo,
 * respetando el día ancla (ej. si el ancla es 30, en febrero retorna día 28, pero en marzo vuelve al 30).
 */
export function computeRecurringDate(year: number, month: number, anchorDay: number): string {
  const safeDay = getEffectiveDayOfMonth(year, month, anchorDay);
  const mStr = month.toString().padStart(2, '0');
  const dStr = safeDay.toString().padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
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
 * - Corte de facturación: si cae sábado, domingo o feriado bancario, se traslada al día hábil anterior.
 * - Fecha límite de pago: si cae sábado, domingo o feriado, se traslada al siguiente día hábil.
 */
export function calculatePaymentDueDate(
  dateStr: string,
  method?: PaymentMethod,
  adjustBusinessDay: boolean = true
): string {
  if (!method || method.type !== 'credit' || !method.billingCloseDay) {
    return dateStr;
  }

  const [yStr, mStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10); // 1-12

  const corte = method.billingCloseDay;
  const pago = method.paymentDueDay || corte;

  // 1. Determinar fecha de cierre de facturación nominal y efectiva
  const closeInfo = getEffectiveBillingCloseDate(year, month, corte);

  let cierreYear = year;
  let cierreMonth = month;

  const txDay = parseInt(dateStr.split('-')[2], 10);
  const maxDays = getDaysInMonth(year, month);
  const effectiveCorteDay = Math.min(corte, maxDays);

  // Si la compra ocurrió estrictamente después de la fecha efectiva de corte:
  // - Si fue en el día nominal de corte o después (txDay >= effectiveCorteDay), entra al ciclo siguiente
  //   (ej. compra hoy sábado 26 cuando el corte bancario fue el viernes 25, ganando un mes).
  // - Si fue antes del día nominal de corte (txDay < effectiveCorteDay, ej. cobro del día 25 cuando
  //   el corte nominal es 26 y se adelantó por feriado de Navidad al 24), se mantiene
  //   en el ciclo del mes actual.
  if (dateStr > closeInfo.effectiveDate && txDay >= effectiveCorteDay) {
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
 * Retorna detalles ampliados del vencimiento (fecha nominal vs ajustada por día hábil,
 * así como la fecha de corte efectiva ajustada al día hábil anterior).
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

  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const txDay = parseInt(dStr, 10);
  const maxDays = getDaysInMonth(year, month);
  const effectiveCorteDay = Math.min(method.billingCloseDay, maxDays);

  const closeInfo = getEffectiveBillingCloseDate(year, month, method.billingCloseDay);
  const belongsToNextCycle = dateStr > closeInfo.effectiveDate && txDay >= effectiveCorteDay;

  const nominalDueDate = calculatePaymentDueDate(dateStr, method, false);
  const adjustment = adjustToNextBusinessDay(nominalDueDate);

  return {
    nominalDueDate,
    dueDate: adjustment.adjustedDate,
    wasAdjusted: adjustment.wasAdjusted,
    originalDayOfWeek: adjustment.originalDayOfWeek,
    nominalCloseDate: closeInfo.nominalDate,
    effectiveCloseDate: closeInfo.effectiveDate,
    closeWasAdjusted: closeInfo.wasAdjusted,
    closeOriginalDayOfWeek: closeInfo.originalDayOfWeek,
    belongsToNextCycle
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
      reason: 'Sin tarjetas de crédito activas registradas.',
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

    // Días hasta el próximo corte considerando ajuste a día hábil anterior
    const curYear = referenceDate.getFullYear();
    const curMonth = referenceDate.getMonth() + 1; // 1-12
    const closeThisMonth = getEffectiveBillingCloseDate(curYear, curMonth, card.billingCloseDay || 1);

    let nextEffectiveCloseDateStr = closeThisMonth.effectiveDate;
    if (todayStr > closeThisMonth.effectiveDate) {
      let nextMonthYear = curYear;
      let nextMonth = curMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextMonthYear += 1;
      }
      const closeNextMonth = getEffectiveBillingCloseDate(nextMonthYear, nextMonth, card.billingCloseDay || 1);
      nextEffectiveCloseDateStr = closeNextMonth.effectiveDate;
    }
    const [cYear, cMonth, cDay] = nextEffectiveCloseDateStr.split('-').map(Number);
    const closeDateObj = new Date(cYear, cMonth - 1, cDay, 12, 0, 0);
    const daysUntilClose = Math.max(0, Math.ceil((closeDateObj.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)));

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
  const curM = referenceDate.getMonth() + 1;
  const curY = referenceDate.getFullYear();
  const nextCloseInfo = getEffectiveBillingCloseDate(curY, curM, best.card.billingCloseDay || 1);
  const targetCloseInfo = todayStr > nextCloseInfo.effectiveDate
    ? getEffectiveBillingCloseDate(curM === 12 ? curY + 1 : curY, curM === 12 ? 1 : curM + 1, best.card.billingCloseDay || 1)
    : nextCloseInfo;

  const dueDateFormatted = formatDisplayDate(calculatePaymentDueDate(todayStr, best.card));
  const remainingDaysLabel = best.daysUntilClose === 1 ? 'queda 1 día' : `quedan ${best.daysUntilClose} días`;
  let reason = `Tu próximo corte es el día ${best.card.billingCloseDay}${targetCloseInfo.wasAdjusted ? ` (adelantado al ${formatDisplayDate(targetCloseInfo.effectiveDate)})` : ''} (${remainingDaysLabel}). Tus consumos de hoy vencerán el ${dueDateFormatted}.`;
  if (best.utilization >= 80) {
    reason += ` Atención: tu línea está al ${Math.round(best.utilization)}% de uso. Te sugerimos amortizar consumos previos antes de registrar nuevos gastos.`;
  } else if (best.utilization > 30) {
    reason += ` Nivel de uso al ${Math.round(best.utilization)}% de la línea (recomendado: hasta 30%).`;
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
  borrowedCreditedToDebitMonth?: number;
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
    // Si es un ingreso legado generado por préstamo recibido (inc-loan-...), lo excluimos
    // para no duplicar con borrowedCreditedToDebitToday/borrowedCreditedToDebitMonth
    if (oi.id && oi.id.startsWith('inc-loan-')) return;
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
  const debitTxs = monthTransactions.filter(t =>
    debitMethodIds.includes(t.paymentMethodId) ||
    (debitMethodIds.length > 0 && (t.paymentMethodId === 'pm-1' || t.paymentMethodId === 'pm-deb-1'))
  );
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
    borrowedCreditedToDebitToday,
    borrowedCreditedToDebitMonth
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
 * Amortización y cobertura de facturación de tarjetas de crédito.
 * 
 * Vincula los abonos realizados a las tarjetas con los vencimientos de ciclo bancario,
 * soportando tanto imputación explícita (targetMonth) como amortización cronológica (FIFO).
 * Resuelve la discrepancia de timing cuando un abono se realiza a fin de mes (ej. 30 de septiembre)
 * para cubrir el estado de cuenta que vence el mes siguiente (ej. 15 de octubre).
 */
export function computeCardBillingAmortization(params: {
  transactions: Transaction[];
  cardPayments: CardPayment[];
  paymentMethods: PaymentMethod[];
}): CardAmortizationSchedule {
  const { transactions, cardPayments, paymentMethods } = params;
  const isMonthKey = (k: string) => /^\d{4}-\d{2}$/.test(k);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const creditCards = paymentMethods.filter(p => p.type === 'credit');

  const byCardAndMonth = new Map<string, CardMonthCoverage>();
  const unpaidPenByMonth = new Map<string, number>();
  const unpaidUsdByMonth = new Map<string, number>();
  const billedPenByMonth = new Map<string, number>();
  const billedUsdByMonth = new Map<string, number>();
  const paidInAdvanceByMonth = new Map<string, number>();
  const pendingCyclesByCard = new Map<string, Array<{ monthKey: string; dueDate: string; unpaidPen: number; unpaidUsd: number; unpaidUsdInPen?: number; label: string }>>();

  const MONTH_NAMES_LOCAL = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  creditCards.forEach(card => {
    // 1. Filtrar transacciones de esta tarjeta
    const cardTxs = transactions.filter(t => {
      if (t.paymentMethodId === card.id) return true;
      const aliased = paymentMethods.find(p => p.id === t.paymentMethodId);
      return !!aliased && aliased.name.toLowerCase() === card.name.toLowerCase();
    });

    // 2. Agrupar consumos facturados por mes de vencimiento
    interface CycleBucket {
      monthKey: string;
      dueDate: string;
      billedPen: number;
      billedUsd: number;
      billedUsdInPen: number;
      coveredPen: number;
      coveredUsd: number;
      paidInAdvancePen: number;
      paidInMonthPen: number;
    }

    const bucketsMap = new Map<string, CycleBucket>();

    cardTxs.forEach(t => {
      const netPen = t.isRefund ? -Math.abs(t.amountPen || 0) : (t.amountPen || 0);
      const netUsd = t.isRefund ? -Math.abs(t.originalAmount || 0) : (t.originalAmount || 0);
      const dd = t.paymentDueDate || t.date || '';
      const mk = dd.slice(0, 7);
      if (!isMonthKey(mk)) return;

      let b = bucketsMap.get(mk);
      if (!b) {
        b = {
          monthKey: mk,
          dueDate: dd || `${mk}-15`,
          billedPen: 0,
          billedUsd: 0,
          billedUsdInPen: 0,
          coveredPen: 0,
          coveredUsd: 0,
          paidInAdvancePen: 0,
          paidInMonthPen: 0
        };
        bucketsMap.set(mk, b);
      }
      if (t.currency === 'USD') {
        b.billedUsd += netUsd;
        b.billedUsdInPen += netPen;
      } else {
        b.billedPen += netPen;
      }
      if (dd && dd > b.dueDate) {
        b.dueDate = dd;
      }
    });

    // 3. Filtrar abonos de esta tarjeta (excluyendo reembolsos y créditos de banco que ya netean)
    const validPayments = cardPayments
      .filter(p => {
        if (p.sourceType === 'MERCHANT_REFUND' || p.sourceType === 'BANK_CREDIT') return false;
        if (p.paymentMethodId === card.id) return true;
        const aliased = paymentMethods.find(pm => pm.id === p.paymentMethodId);
        return !!aliased && aliased.name.toLowerCase() === card.name.toLowerCase();
      })
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || (a.id || '').localeCompare(b.id || ''));

    // Estructurar array de pagos con saldo disponible para amortizar
    const paymentRem = validPayments.map(p => {
      const isUsd = p.currency === 'USD';
      const nom = p.originalAmount !== undefined ? p.originalAmount : p.amountPaid;
      const pen = p.amountPen !== undefined 
        ? p.amountPen 
        : (isUsd && p.exchangeRate ? Math.round(nom * p.exchangeRate * 100) / 100 : p.amountPaid);
      return {
        raw: p,
        isUsd,
        remPen: Math.max(0, pen),
        remUsd: isUsd ? Math.max(0, nom) : 0,
        targetMonth: p.targetMonth && isMonthKey(p.targetMonth) ? p.targetMonth : null,
        paymentDate: p.paymentDate
      };
    });

    // PASO 1: Imputación explícita (pagos que especifican targetMonth)
    paymentRem.forEach(p => {
      if (!p.targetMonth) return;
      const b = bucketsMap.get(p.targetMonth);
      if (!b) return;

      const pPayMonth = p.paymentDate.slice(0, 7);

      if (p.isUsd && p.remUsd > 0) {
        const neededUsd = Math.max(0, b.billedUsd - b.coveredUsd);
        const appliedUsd = Math.min(neededUsd, p.remUsd);
        b.coveredUsd += appliedUsd;
        p.remUsd -= appliedUsd;
      }

      if (p.remPen > 0) {
        const neededPen = Math.max(0, b.billedPen - b.coveredPen);
        const appliedPen = Math.min(neededPen, p.remPen);
        b.coveredPen += appliedPen;
        p.remPen -= appliedPen;

        if (pPayMonth < b.monthKey) {
          b.paidInAdvancePen += appliedPen;
        } else {
          b.paidInMonthPen += appliedPen;
        }
      }
    });

    // PASO 2: Amortización cronológica FIFO (pagos sin targetMonth o remanentes)
    const sortedBuckets = Array.from(bucketsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    paymentRem.forEach(p => {
      if (p.remPen <= 0.005 && p.remUsd <= 0.005) return;
      const pPayMonth = p.paymentDate.slice(0, 7);

      for (const b of sortedBuckets) {
        if (p.isUsd && p.remUsd > 0.005) {
          const neededUsd = Math.max(0, b.billedUsd - b.coveredUsd);
          if (neededUsd > 0.005) {
            const appliedUsd = Math.min(neededUsd, p.remUsd);
            b.coveredUsd += appliedUsd;
            p.remUsd -= appliedUsd;
          }
        }

        if (p.remPen > 0.005) {
          const neededPen = Math.max(0, b.billedPen - b.coveredPen);
          if (neededPen > 0.005) {
            const appliedPen = Math.min(neededPen, p.remPen);
            b.coveredPen += appliedPen;
            p.remPen -= appliedPen;

            if (pPayMonth < b.monthKey) {
              b.paidInAdvancePen += appliedPen;
            } else {
              b.paidInMonthPen += appliedPen;
            }
          }
        }

        if (p.remPen <= 0.005 && p.remUsd <= 0.005) break;
      }
    });

    // 4. Registrar la cobertura mensual y acumular globales
    const cardPendingCycles: Array<{ monthKey: string; dueDate: string; unpaidPen: number; unpaidUsd: number; unpaidUsdInPen?: number; label: string }> = [];

    sortedBuckets.forEach(b => {
      const unpaidPen = round2(Math.max(0, b.billedPen - b.coveredPen));
      const unpaidUsd = round2(Math.max(0, b.billedUsd - b.coveredUsd));
      const isCovered = unpaidPen <= 0.009 && unpaidUsd <= 0.009;

      const cov: CardMonthCoverage = {
        cardId: card.id,
        monthKey: b.monthKey,
        representativeDueDate: b.dueDate,
        billedDuePen: round2(b.billedPen),
        billedDueUsd: round2(b.billedUsd),
        coveredPen: round2(b.coveredPen),
        coveredUsd: round2(b.coveredUsd),
        unpaidPen,
        unpaidUsd,
        paidInAdvancePen: round2(b.paidInAdvancePen),
        paidInMonthPen: round2(b.paidInMonthPen),
        isCovered
      };

      byCardAndMonth.set(`${card.id}_${b.monthKey}`, cov);

      // Acumuladores por mes calendario de vencimiento
      billedPenByMonth.set(b.monthKey, round2((billedPenByMonth.get(b.monthKey) || 0) + b.billedPen));
      billedUsdByMonth.set(b.monthKey, round2((billedUsdByMonth.get(b.monthKey) || 0) + b.billedUsd));
      unpaidPenByMonth.set(b.monthKey, round2((unpaidPenByMonth.get(b.monthKey) || 0) + unpaidPen));
      unpaidUsdByMonth.set(b.monthKey, round2((unpaidUsdByMonth.get(b.monthKey) || 0) + unpaidUsd));
      paidInAdvanceByMonth.set(b.monthKey, round2((paidInAdvanceByMonth.get(b.monthKey) || 0) + b.paidInAdvancePen));

      if (!isCovered) {
        const [yStr, mStr] = b.monthKey.split('-');
        const mIdx = parseInt(mStr, 10) - 1;
        const monthName = MONTH_NAMES_LOCAL[mIdx] || b.monthKey;
        const dayStr = b.dueDate.split('-')[2] || '';
        const label = `${monthName} ${yStr} (Vence el ${dayStr}/${mStr})`;
        const cycleUsdRate = b.billedUsd > 0.005 ? (b.billedUsdInPen / b.billedUsd) : 1;
        const unpaidUsdInPen = unpaidUsd > 0.005 ? round2(unpaidUsd * cycleUsdRate) : 0;
        cardPendingCycles.push({
          monthKey: b.monthKey,
          dueDate: b.dueDate,
          unpaidPen,
          unpaidUsd,
          unpaidUsdInPen,
          label
        });
      }
    });

    pendingCyclesByCard.set(card.id, cardPendingCycles);
  });

  return {
    byCardAndMonth,
    unpaidPenByMonth,
    unpaidUsdByMonth,
    billedPenByMonth,
    billedUsdByMonth,
    paidInAdvanceByMonth,
    pendingCyclesByCard
  };
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
  cardPayments: {
    paymentMethodId: string;
    amountPaid: number;
    paymentDate: string;
    sourceType?: string;
    currency?: string;
    originalAmount?: number;
    exchangeRate?: number;
    amountPen?: number;
    itfAmount?: number;
    targetMonth?: string;
  }[];
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

  // Amortización inteligente y cobertura real de cuotas/estados de cuenta de tarjeta
  // Resuelve timing mismatches (ej. pago el 30/09 para estado de cuenta que vence el 15/10)
  // evitando que el compromiso se reste dos veces del débito en meses futuros.
  const cardAmortization = computeCardBillingAmortization({
    transactions,
    cardPayments: cardPayments as CardPayment[],
    paymentMethods
  });

  // Salidas reales en cuenta bancaria (soles) y amortizaciones por divisa
  const cardByMonth = new Map<string, number>();
  const cardPaidPenByMonth = new Map<string, number>();
  const cardPaidUsdByMonth = new Map<string, number>();

  cardPayments.forEach(p => {
    const isRefund = p.sourceType === 'MERCHANT_REFUND' || p.sourceType === 'BANK_CREDIT';
    const isUsdSavings = p.sourceType === 'USD_SAVINGS_ACCOUNT';
    const isUsd = p.currency === 'USD';
    const nominalAmt = p.originalAmount !== undefined ? p.originalAmount : p.amountPaid;
    const penDeduction = p.amountPen !== undefined 
      ? p.amountPen 
      : (isUsd && p.exchangeRate ? Math.round(nominalAmt * p.exchangeRate * 100) / 100 : p.amountPaid);

    const k = (p.paymentDate || '').slice(0, 7);
    if (!isMonthKey(k)) return;

    // Solo descuenta de saldo débito si no es reembolso ni ahorros directos en USD.
    // Incluye el ITF bancario retenido (salida real de liquidez en cuenta).
    if (!isRefund && !isUsdSavings) {
      const itf = p.itfAmount || 0;
      cardByMonth.set(k, (cardByMonth.get(k) || 0) + penDeduction + itf);
    }

    // Cobertura de cuotas bancarias por divisa
    if (isUsd) {
      cardPaidUsdByMonth.set(k, (cardPaidUsdByMonth.get(k) || 0) + nominalAmt);
    } else {
      cardPaidPenByMonth.set(k, (cardPaidPenByMonth.get(k) || 0) + penDeduction);
    }
  });

  // Cuotas/estados de cuenta de tarjeta por VENCIMIENTO bancario, por mes (neto de
  // reembolsos) separado por PEN y USD para evitar discrepancias por T.C.
  const cardBillDuePenByMonth = new Map<string, number>();
  const cardBillDueUsdByMonth = new Map<string, number>();
  const cardBillRateByMonth = new Map<string, number>();

  transactions.forEach(t => {
    if (!creditCardIds.includes(t.paymentMethodId)) return;
    const k = (t.paymentDueDate || '').slice(0, 7);
    if (!isMonthKey(k)) return;

    if (t.currency === 'USD') {
      const netUsd = t.isRefund ? -Math.abs(t.originalAmount) : t.originalAmount;
      cardBillDueUsdByMonth.set(k, (cardBillDueUsdByMonth.get(k) || 0) + netUsd);
      if (t.exchangeRate && t.exchangeRate > 0) {
        cardBillRateByMonth.set(k, t.exchangeRate);
      }
    } else {
      const netPen = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
      cardBillDuePenByMonth.set(k, (cardBillDuePenByMonth.get(k) || 0) + netPen);
    }
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
    // cuotas de tarjeta por vencer no cubiertas por los abonos.
    // Usamos cardAmortization para tomar el saldo NETO impago real de ese ciclo,
    // garantizando que si el ciclo ya fue pagado con anticipación en el mes anterior,
    // el compromiso sea S/ 0 y NO se descuente doblemente.
    const pendingPenCard = cardAmortization.unpaidPenByMonth.get(key) || 0;
    const pendingUsdCard = cardAmortization.unpaidUsdByMonth.get(key) || 0;
    const usdRate = cardBillRateByMonth.get(key) || FALLBACK_USD_PEN_RATE;
    const pendingCardTotal = round2(pendingPenCard + (pendingUsdCard * usdRate));

    const commitments = key >= realTodayKey
      ? (scheduledDueByMonth.get(key) || 0) + pendingCardTotal
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
  isPastMonth: boolean = false,
  cardAmortization?: CardAmortizationSchedule
): LiquidityDiagnostic {
  const targetYearMonth = `${budget.year}-${budget.month.toString().padStart(2, '0')}`;

  // 1. Total Ingresos = Sueldo + Otros Ingresos (excluyendo préstamos de deuda legados)
  const otherIncomesTotal = budget.otherIncomes
    .filter(curr => !curr.id || !curr.id.startsWith('inc-loan-'))
    .reduce((acc, curr) => acc + curr.amount, 0);
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

    // Abonos pagados a tarjeta en el mes (excluyendo reembolsos de banco o comercio o cuenta propia en USD).
    // Suma la amortización nominal y el ITF bancario retenido para reflejar el egreso exacto de fondos.
    const cardPaymentsTotal = cardPayments
      .filter(p => p.paymentDate.startsWith(targetYearMonth) && p.sourceType !== 'MERCHANT_REFUND' && p.sourceType !== 'BANK_CREDIT' && p.sourceType !== 'USD_SAVINGS_ACCOUNT')
      .reduce((acc, curr) => {
        const nominalAmt = curr.originalAmount !== undefined ? curr.originalAmount : curr.amountPaid;
        const penAmt = curr.amountPen !== undefined 
          ? curr.amountPen 
          : (curr.currency === 'USD' && curr.exchangeRate ? Math.round(nominalAmt * curr.exchangeRate * 100) / 100 : curr.amountPaid);
        const itf = curr.itfAmount || 0;
        return acc + penAmt + itf;
      }, 0);

    // Vencimientos de tarjeta este mes por moneda
    const cardBillsDuePen = allTransactions
      .filter(t => creditCardIds.includes(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYearMonth) && t.currency !== 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    const cardBillsDueUsd = allTransactions
      .filter(t => creditCardIds.includes(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYearMonth) && t.currency === 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.originalAmount) : curr.originalAmount), 0);

    // Abonos del mes por moneda (para verificar cobertura de vencimientos bancarios)
    const cardPaidPenThisMonth = cardPayments
      .filter(p => p.paymentDate.startsWith(targetYearMonth) && p.currency !== 'USD')
      .reduce((acc, curr) => acc + (curr.amountPen !== undefined ? curr.amountPen : curr.amountPaid), 0);

    const cardPaidUsdThisMonth = cardPayments
      .filter(p => p.paymentDate.startsWith(targetYearMonth) && p.currency === 'USD')
      .reduce((acc, curr) => acc + (curr.originalAmount !== undefined ? curr.originalAmount : curr.amountPaid), 0);

    // Amortización inteligente y cobertura real de cuotas/estados de cuenta de tarjeta:
    // Vincula abonos previos o anticipados con los ciclos correspondientes para evitar doble penalización.
    const amort = cardAmortization || computeCardBillingAmortization({
      transactions: allTransactions,
      cardPayments: cardPayments as CardPayment[],
      paymentMethods
    });

    const pendingCardPenDue = isPastMonth
      ? 0
      : (amort ? (amort.unpaidPenByMonth.get(targetYearMonth) ?? Math.max(0, cardBillsDuePen - cardPaidPenThisMonth)) : Math.max(0, cardBillsDuePen - cardPaidPenThisMonth));

    const pendingCardUsdDue = isPastMonth
      ? 0
      : (amort ? (amort.unpaidUsdByMonth.get(targetYearMonth) ?? Math.max(0, cardBillsDueUsd - cardPaidUsdThisMonth)) : Math.max(0, cardBillsDueUsd - cardPaidUsdThisMonth));

    const usdTx = allTransactions.find(t => creditCardIds.includes(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYearMonth) && t.currency === 'USD' && t.exchangeRate && t.exchangeRate > 0);
    const usdPendingRate = usdTx?.exchangeRate || FALLBACK_USD_PEN_RATE;
    const pendingCardTotalDue = pendingCardPenDue + (pendingCardUsdDue * usdPendingRate);

    // En mes cerrado manda lo efectivamente abonado. En mes en curso/futuro es lo abonado más lo pendiente neto que falta pagar
    cardOutflowThisMonth = isPastMonth
      ? cardPaymentsTotal
      : (cardPaymentsTotal + pendingCardTotalDue);
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
  cardPayments: {
    paymentMethodId: string;
    amountPaid: number;
    paymentDate: string;
    sourceType?: string;
    currency?: string;
    originalAmount?: number;
    exchangeRate?: number;
    amountPen?: number;
    itfAmount?: number;
  }[],
  currentYear: number,
  currentMonth: number
): CardDebtSummary[] {
  const creditCards = cards.filter(c => c.type === 'credit');

  const cardAmortization = computeCardBillingAmortization({
    transactions: allTransactions,
    cardPayments: cardPayments as CardPayment[],
    paymentMethods: cards
  });

  return creditCards.map(card => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const targetYM = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

    // Match by direct id, or by same-name alias against the real methods list
    const matchesCard = (methodId?: string) => {
      if (!methodId) return false;
      if (methodId === card.id) return true;
      const aliased = cards.find(p => p.id === methodId);
      return !!aliased && aliased.name.toLowerCase() === card.name.toLowerCase();
    };

    // 1. DESGLOSE DE CONSUMOS POR MONEDA (Soles y Dólares)
    const consumedPenThisMonth = currentMonthTransactions
      .filter(t => matchesCard(t.paymentMethodId) && t.currency !== 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    const consumedPenToDate = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && t.date <= todayStr && t.currency !== 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    const consumedThisMonthUsd = currentMonthTransactions
      .filter(t => matchesCard(t.paymentMethodId) && t.currency === 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.originalAmount) : curr.originalAmount), 0);

    const consumedToDateUsd = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && t.date <= todayStr && t.currency === 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.originalAmount) : curr.originalAmount), 0);

    // 2. DESGLOSE DE ABONOS POR MONEDA (Soles y Dólares)
    const paidPenThisMonth = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate.startsWith(targetYM) && p.currency !== 'USD')
      .reduce((acc, curr) => acc + (curr.amountPen !== undefined ? curr.amountPen : curr.amountPaid), 0);

    const paidPenToDate = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate <= todayStr && p.currency !== 'USD')
      .reduce((acc, curr) => acc + (curr.amountPen !== undefined ? curr.amountPen : curr.amountPaid), 0);

    const paidThisMonthUsd = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate.startsWith(targetYM) && p.currency === 'USD')
      .reduce((acc, curr) => acc + (curr.originalAmount !== undefined ? curr.originalAmount : curr.amountPaid), 0);

    const paidToDateUsd = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate <= todayStr && p.currency === 'USD')
      .reduce((acc, curr) => acc + (curr.originalAmount !== undefined ? curr.originalAmount : curr.amountPaid), 0);

    // 3. ESTADO DE DEUDA EN DÓLARES (Bimonetario)
    const totalAccumulatedDebtUsd = Math.max(0, consumedToDateUsd - paidToDateUsd);
    const hasUsdDebt = totalAccumulatedDebtUsd > 0.009 || consumedThisMonthUsd > 0.009;

    // Transacciones en USD ordenadas cronológicamente para amortización FIFO del contravalor en soles
    const usdTransactionsToDate = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && t.date <= todayStr && t.currency === 'USD')
      .sort((a, b) => a.date.localeCompare(b.date));

    // Cálculo del contravalor en soles del saldo pendiente en USD (Opción A: estabilidad histórica FIFO)
    let usdPendingInPen = 0;
    if (totalAccumulatedDebtUsd > 0.009) {
      let coveredUsd = paidToDateUsd;
      for (const t of usdTransactionsToDate) {
        const txUsd = t.isRefund ? -Math.abs(t.originalAmount || 0) : (t.originalAmount || 0);
        const txPen = t.isRefund ? -Math.abs(t.amountPen || 0) : (t.amountPen || 0);
        if (coveredUsd >= txUsd) {
          // Ya cubierto por abonos previos
          coveredUsd -= txUsd;
        } else if (coveredUsd > 0) {
          // Parcialmente cubierto
          const unpaidTxUsd = txUsd - coveredUsd;
          const ratio = txUsd > 0 ? unpaidTxUsd / txUsd : 0;
          usdPendingInPen += ratio * txPen;
          coveredUsd = 0;
        } else {
          // Totalmente pendiente con su monto_soles histórico
          usdPendingInPen += txPen;
        }
      }
      usdPendingInPen = Math.round(usdPendingInPen * 100) / 100;
    }

    // 4. BALANCES TOTALES Y CONSOLIDADOS
    const initialDebt = card.initialDebt || 0;
    const netBalancePen = initialDebt + consumedPenToDate - paidPenToDate;
    const totalAccumulatedDebtPen = Math.max(0, netBalancePen);

    // Balance consolidado en Soles (congelado con tipo de cambio histórico de compra):
    const netBalance = netBalancePen + usdPendingInPen;
    const hasPositiveBalance = netBalance < -0.009 && totalAccumulatedDebtUsd <= 0.009;
    const creditBalanceAmount = hasPositiveBalance ? Math.abs(netBalance) : 0;
    const totalAccumulatedDebt = Math.max(0, netBalance);

    // Métricas totales agregadas en PEN (usando el amountPen histórico individual de cada consumo):
    const consumedThisMonthPen = consumedPenThisMonth;
    const consumedToDatePen = consumedPenToDate;
    const consumedThisMonth = currentMonthTransactions
      .filter(t => matchesCard(t.paymentMethodId))
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen || 0) : (curr.amountPen || 0)), 0);

    const consumedToDate = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && t.date <= todayStr)
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen || 0) : (curr.amountPen || 0)), 0);

    const paidThisMonthPen = paidPenThisMonth;
    const paidToDatePen = paidPenToDate;
    const paidThisMonth = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate.startsWith(targetYM))
      .reduce((acc, curr) => acc + (curr.amountPen !== undefined ? curr.amountPen : (curr.currency === 'USD' && curr.exchangeRate ? (curr.originalAmount || curr.amountPaid) * curr.exchangeRate : curr.amountPaid)), 0);

    const paidToDate = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && p.paymentDate <= todayStr)
      .reduce((acc, curr) => acc + (curr.amountPen !== undefined ? curr.amountPen : (curr.currency === 'USD' && curr.exchangeRate ? (curr.originalAmount || curr.amountPaid) * curr.exchangeRate : curr.amountPaid)), 0);

    // Días hasta corte y pago (corte efectivo ajustado al día hábil anterior)
    const closeThisMonth = getEffectiveBillingCloseDate(currentYear, currentMonth, card.billingCloseDay || 1);
    let nextEffectiveCloseDateStr = closeThisMonth.effectiveDate;
    if (todayStr > closeThisMonth.effectiveDate) {
      let nextCloseYear = currentYear;
      let nextCloseMonth = currentMonth + 1;
      if (nextCloseMonth > 12) {
        nextCloseMonth = 1;
        nextCloseYear += 1;
      }
      nextEffectiveCloseDateStr = getEffectiveBillingCloseDate(nextCloseYear, nextCloseMonth, card.billingCloseDay || 1).effectiveDate;
    }
    const [cYear, cMonth, cDay] = nextEffectiveCloseDateStr.split('-').map(Number);
    const closeDate = new Date(cYear, cMonth - 1, cDay, 12, 0, 0);
    const daysUntilClose = Math.max(0, Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const daysInCurMonth = getDaysInMonth(currentYear, currentMonth);
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
    const duePenInSelectedMonth = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYM) && t.currency !== 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    const dueInSelectedMonthUsd = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYM) && t.currency === 'USD')
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.originalAmount) : curr.originalAmount), 0);

    // Suma de amountPen histórico para las transacciones que vencen en el mes seleccionado
    const dueInSelectedMonth = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYM))
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    const cov = cardAmortization.byCardAndMonth.get(`${card.id}_${targetYM}`);
    const netDuePenInSelectedMonth = cov ? cov.unpaidPen : Math.max(0, duePenInSelectedMonth - paidPenThisMonth);
    const netDueInSelectedMonthUsd = cov ? cov.unpaidUsd : Math.max(0, dueInSelectedMonthUsd - paidThisMonthUsd);

    // Tipo de cambio histórico ponderado para el componente en USD del ciclo targetYM
    const usdCycleTxs = allTransactions.filter(t => matchesCard(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYM) && t.currency === 'USD');
    const usdCycleBilled = usdCycleTxs.reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.originalAmount) : curr.originalAmount), 0);
    const usdCyclePen = usdCycleTxs.reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);
    const cycleUsdRate = usdCycleBilled > 0.005
      ? (usdCyclePen / usdCycleBilled)
      : (allTransactions.find(t => matchesCard(t.paymentMethodId) && t.currency === 'USD' && t.exchangeRate && t.exchangeRate > 0)?.exchangeRate || FALLBACK_USD_PEN_RATE);

    const netDueUsdInPen = netDueInSelectedMonthUsd > 0.005 ? Math.round(netDueInSelectedMonthUsd * cycleUsdRate * 100) / 100 : 0;
    let netDueInSelectedMonth = netDuePenInSelectedMonth + netDueUsdInPen;
    if (hasPositiveBalance) {
      netDueInSelectedMonth = 0;
    }

    const paidInSelectedMonth = cov 
      ? Math.round((cov.coveredPen + (cov.coveredUsd * cycleUsdRate)) * 100) / 100
      : Math.round((paidPenThisMonth + (paidThisMonthUsd * cycleUsdRate)) * 100) / 100;

    // El mes se considera pagado si tanto el componente en soles como en dólares están cubiertos
    const isPenCovered = duePenInSelectedMonth <= 0.009 || netDuePenInSelectedMonth <= 0.009;
    const isUsdCovered = dueInSelectedMonthUsd <= 0.009 || netDueInSelectedMonthUsd <= 0.009;
    const hasAnyDue = duePenInSelectedMonth > 0.009 || dueInSelectedMonthUsd > 0.009;
    const isPaidThisMonth = hasAnyDue && isPenCovered && isUsdCovered;

    // Saldo vencido arrastrado de meses previos sin pagar
    const dueBeforeSelectedMonth = allTransactions
      .filter(t => matchesCard(t.paymentMethodId) && (t.paymentDueDate || '') < `${targetYM}-01`)
      .reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);

    const paidBeforeSelectedMonth = cardPayments
      .filter(p => matchesCard(p.paymentMethodId) && (p.paymentDate || '') < `${targetYM}-01`)
      .reduce((acc, curr) => acc + (curr.amountPen !== undefined ? curr.amountPen : curr.amountPaid), 0);

    const overdueFromPastMonths = Math.max(0, dueBeforeSelectedMonth - paidBeforeSelectedMonth);

    return {
      paymentMethodId: card.id,
      cardName: card.name,
      cardColor: card.color,
      consumedThisMonth,
      consumedThisMonthPen,
      consumedToDate,
      consumedToDatePen,
      paidThisMonth,
      paidThisMonthPen,
      paidToDate,
      paidToDatePen,
      initialDebt,
      totalAccumulatedDebt,
      totalAccumulatedDebtPen,
      hasPositiveBalance,
      creditBalanceAmount,
      netBalance,
      netBalancePen,
      billingCloseDay: card.billingCloseDay || 0,
      paymentDueDay: card.paymentDueDay || 0,
      daysUntilClose,
      daysUntilPayment,
      creditDaysAdvantage,
      dueInSelectedMonth,
      dueInSelectedMonthPen: duePenInSelectedMonth,
      paidInSelectedMonth,
      paidInSelectedMonthPen: cov ? cov.coveredPen : paidPenThisMonth,
      netDueInSelectedMonth,
      netDueInSelectedMonthPen: netDuePenInSelectedMonth,
      isPaidThisMonth,
      overdueFromPastMonths,
      // Desglose bimoneda para UI y validación financiera
      hasUsdDebt,
      consumedThisMonthUsd,
      consumedToDateUsd,
      dueInSelectedMonthUsd,
      paidThisMonthUsd,
      paidToDateUsd,
      totalAccumulatedDebtUsd,
      netDueInSelectedMonthUsd,
      paidInAdvanceForSelectedMonth: cov ? cov.paidInAdvancePen : 0
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

/**
 * Evalúa la liquidez real a la FECHA DE PAGO de cada tarjeta de crédito frente
 * a la fecha de abono del sueldo (análisis de desfase de flujo de caja).
 *
 * Resuelve el "espejismo de fin de mes": si una tarjeta vence el día 15 y el sueldo
 * ingresa el día 30, el saldo proyectado a fin de mes puede ser positivo, pero en la
 * fecha exacta del vencimiento la persona no tendrá liquidez suficiente.
 */
export function evaluateCardsLiquidityCoverage(params: {
  paymentPlans: {
    cardId: string;
    cardName: string;
    cardColor: string;
    billingCloseDay: number;
    paymentDueDay: number;
    limit: number;
    totalUnpaid: number;
    utilizationPct: number;
    nextDueDate: string | null;
    nextDueAmount: number;
    isOverdue: boolean;
    nextCloseDate: string | null;
    scorePayByDate: string | null;
  }[];
  currentDebitBalanceToday: number;
  projectedDebitBalanceMonthEnd: number;
  salaries: { id: string; source: string; amount: number; payDay: number }[];
  otherIncomes?: OtherIncome[];
  payables?: Payable[];
  receivables?: Receivable[];
  monthTransactions?: Transaction[];
  currentDateStr: string;
  currentYear: number;
  currentMonth: number;
}): CardsGlobalLiquidityAssessment {
  const {
    paymentPlans,
    currentDebitBalanceToday,
    projectedDebitBalanceMonthEnd,
    salaries,
    otherIncomes = [],
    payables = [],
    receivables = [],
    monthTransactions = [],
    currentDateStr,
    currentYear,
    currentMonth
  } = params;

  const todayStr = currentDateStr || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
  const [curY, curM, curD] = todayStr.split('-').map(Number);

  // 1. Sueldo principal y calendario de abono
  const primarySalary = salaries[0] || { amount: 2126.49, payDay: 30 };
  const effectiveSalaryDay = getEffectiveDayOfMonth(curY, curM, primarySalary.payDay || 30);
  const totalSalaries = salaries.reduce((acc, s) => acc + (s.amount || 0), 0);
  const isSalaryCreditedToday = curD >= effectiveSalaryDay;

  // Fecha del próximo sueldo esperado (en el mes actual o en el siguiente)
  let salaryYear = curY;
  let salaryMonth = curM;
  let salaryDay = effectiveSalaryDay;

  if (isSalaryCreditedToday) {
    // El sueldo de este mes ya se cobró (está en currentDebitBalanceToday).
    // El próximo sueldo corresponde al mes siguiente.
    salaryMonth += 1;
    if (salaryMonth > 12) {
      salaryMonth = 1;
      salaryYear += 1;
    }
    salaryDay = getEffectiveDayOfMonth(salaryYear, salaryMonth, primarySalary.payDay || 30);
  }

  const upcomingSalaryDate = `${salaryYear}-${salaryMonth.toString().padStart(2, '0')}-${salaryDay.toString().padStart(2, '0')}`;

  // 2. Tarjetas ordenadas por fecha de vencimiento ascendente
  const sortedPlans = [...paymentPlans].sort((a, b) => {
    const dueA = a.nextDueDate || '9999-12-31';
    const dueB = b.nextDueDate || '9999-12-31';
    return dueA.localeCompare(dueB);
  });

  let runningAvailable = currentDebitBalanceToday;
  let lastEvaluatedDate = todayStr;
  let totalDueSoon = 0;
  let totalDueBeforeSalary = 0;
  let shortfallBeforeSalary = 0;
  let hasAnySalaryMismatch = false;
  let hasAnyDeficit = false;

  const enrichedItems: CardPaymentPlanItem[] = [];

  for (const plan of sortedPlans) {
    const hasDue = plan.nextDueAmount > 0.005 && !!plan.nextDueDate;

    if (!hasDue) {
      enrichedItems.push({
        ...plan,
        liquidityCoverage: {
          status: 'PAID',
          estimatedDebitAtDueDate: runningAvailable,
          requiredAmount: 0,
          shortfallAmount: 0,
          salaryPayDay: effectiveSalaryDay,
          salaryDate: upcomingSalaryDate,
          salaryIsAfterDue: false,
          salaryAmount: totalSalaries,
          projectedBalanceMonthEnd: projectedDebitBalanceMonthEnd,
          daysDiffSalaryVsDue: 0,
          headline: 'Al día',
          message: 'Sin obligaciones pendientes en el período.'
        }
      });
      continue;
    }

    const dueDate = plan.nextDueDate!;
    const dueAmt = plan.nextDueAmount;
    totalDueSoon += dueAmt;

    // ¿El sueldo entra después del vencimiento?
    const salaryIsAfterDue = dueDate < upcomingSalaryDate;
    if (salaryIsAfterDue) {
      totalDueBeforeSalary += dueAmt;
    }

    // Calcular días de desfase: sueldo date vs due date
    const dueTime = new Date(`${dueDate}T12:00:00`).getTime();
    const salaryTime = new Date(`${upcomingSalaryDate}T12:00:00`).getTime();
    const daysDiffSalaryVsDue = Math.round((salaryTime - dueTime) / 86400000);

    // Flujos entre lastEvaluatedDate y dueDate
    let periodInflows = 0;
    let periodOutflows = 0;

    // Otros ingresos en ese intervalo
    otherIncomes.forEach(oi => {
      if (oi.receivedDate > lastEvaluatedDate && oi.receivedDate <= dueDate) {
        periodInflows += oi.amount || 0;
      }
    });

    // Cobranzas a deudores que vencen en ese intervalo
    receivables.forEach(r => {
      if (r.dueDate && r.dueDate > lastEvaluatedDate && r.dueDate <= dueDate && r.status !== 'paid') {
        const isUsd = r.currency === 'USD';
        const rem = r.remainingAmount ?? 0;
        const pen = isUsd ? rem * (r.exchangeRate || FALLBACK_USD_PEN_RATE) : rem;
        periodInflows += pen;
      }
    });

    // Si el sueldo ingresa justamente en este intervalo (antes o el mismo día del vencimiento):
    if (upcomingSalaryDate > lastEvaluatedDate && upcomingSalaryDate <= dueDate) {
      periodInflows += totalSalaries;
    }

    // Salidas por deudas personales en ese intervalo
    payables.forEach(p => {
      if (p.dueDate && p.dueDate > lastEvaluatedDate && p.dueDate <= dueDate && p.status !== 'PAID') {
        const isUsd = p.currency === 'USD';
        const rem = p.remainingAmount ?? (p.totalAmount ?? p.originalAmount ?? 0);
        const pen = isUsd ? rem * (p.exchangeRate || FALLBACK_USD_PEN_RATE) : rem;
        periodOutflows += pen;
      }
    });

    // Gastos débito registrados en ese intervalo
    monthTransactions.forEach(t => {
      if (t.paymentMethodId && (t.paymentMethodId === 'pm-1' || t.paymentMethodId.includes('deb') || t.paymentMethodId.includes('cash'))) {
        if (t.date > lastEvaluatedDate && t.date <= dueDate) {
          periodOutflows += t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
        }
      }
    });

    const estimatedDebitAtDueDate = Math.round((runningAvailable + periodInflows - periodOutflows) * 100) / 100;

    let status: CardLiquidityStatus = 'COVERED';
    let shortfallAmount = 0;
    let headline = 'Cobertura confirmada';
    let message = '';
    let actionTip: string | undefined;

    if (estimatedDebitAtDueDate >= dueAmt) {
      status = 'COVERED';
      shortfallAmount = 0;
      headline = 'Cobertura confirmada';
      runningAvailable = Math.max(0, Math.round((estimatedDebitAtDueDate - dueAmt) * 100) / 100);
      message = salaryIsAfterDue
        ? `Tu saldo disponible (${formatSoles(estimatedDebitAtDueDate)}) cubre este pago antes de tu sueldo (día ${effectiveSalaryDay}).`
        : `Tu sueldo ingresa antes del vencimiento (${formatDisplayDate(dueDate)}). Saldo proyectado: ${formatSoles(estimatedDebitAtDueDate)}.`;
    } else {
      shortfallAmount = Math.round((dueAmt - estimatedDebitAtDueDate) * 100) / 100;
      runningAvailable = 0;

      if (salaryIsAfterDue) {
        shortfallBeforeSalary += shortfallAmount;

        // Comprobar si al ingresar el sueldo a fin de mes el saldo alcanza
        const canCoverWithSalary = projectedDebitBalanceMonthEnd >= 0 || (estimatedDebitAtDueDate + totalSalaries >= dueAmt);

        if (canCoverWithSalary) {
          status = 'SALARY_MISMATCH';
          hasAnySalaryMismatch = true;
          headline = 'Desfase pre-sueldo';
          message = `Vence el ${formatDisplayDate(dueDate)} antes de cobrar tu sueldo (día ${effectiveSalaryDay}, faltan ${daysDiffSalaryVsDue} días). Cerrarás el mes con saldo a favor.`;

          if (estimatedDebitAtDueDate > 0) {
            actionTip = `Te sugerimos abonar ${formatSoles(estimatedDebitAtDueDate)} con tu saldo disponible para no generar intereses.`;
          } else {
            actionTip = `Consejo: Puedes solicitar al banco cambiar tu fecha de pago al día ${Math.min(28, effectiveSalaryDay + 3)} para pagar después de tu sueldo.`;
          }
        } else {
          status = 'DEFICIT';
          hasAnyDeficit = true;
          headline = 'Déficit de ciclo';
          message = `Los pagos del período superan tu saldo estimado al cierre del mes (brecha: ${formatSoles(shortfallAmount)}).`;
          actionTip = 'Prioriza pagar las tarjetas con mayor tasa de interés o evalúa refinanciar.';
        }
      } else {
        status = 'DEFICIT';
        hasAnyDeficit = true;
        headline = 'Déficit de ciclo';
        message = `Vence el ${formatDisplayDate(dueDate)}. Con los ingresos del ciclo faltan ${formatSoles(shortfallAmount)} para cubrirlo.`;
        actionTip = 'Evalúa coordinar con el banco una reprogramación antes del vencimiento.';
      }
    }

    lastEvaluatedDate = dueDate > lastEvaluatedDate ? dueDate : lastEvaluatedDate;

    enrichedItems.push({
      ...plan,
      liquidityCoverage: {
        status,
        estimatedDebitAtDueDate,
        requiredAmount: dueAmt,
        shortfallAmount,
        salaryPayDay: effectiveSalaryDay,
        salaryDate: upcomingSalaryDate,
        salaryIsAfterDue,
        salaryAmount: totalSalaries,
        projectedBalanceMonthEnd: projectedDebitBalanceMonthEnd,
        daysDiffSalaryVsDue,
        headline,
        message,
        actionTip
      }
    });
  }

  // Resumen global para el Asesor de Tarjetas y Hero
  let summaryMessage = '';
  let recommendedAction: string | undefined;

  const allCovered = !hasAnySalaryMismatch && !hasAnyDeficit && totalDueSoon > 0;

  if (totalDueSoon <= 0.005) {
    summaryMessage = 'No tienes pagos pendientes de tarjeta este mes.';
  } else if (hasAnySalaryMismatch) {
    summaryMessage = `Tienes ${formatSoles(totalDueBeforeSalary)} en pagos que vencen antes de tu sueldo (día ${effectiveSalaryDay}). Faltan ${formatSoles(shortfallBeforeSalary)} respecto a tu saldo de hoy (${formatSoles(currentDebitBalanceToday)}).`;
    recommendedAction = `Puedes hacer un abono parcial con tu saldo disponible o cambiar tu fecha de pago en el banco al día ${Math.min(28, effectiveSalaryDay + 3)}.`;
  } else if (hasAnyDeficit) {
    summaryMessage = `Los pagos del mes (${formatSoles(totalDueSoon)}) superan tu saldo proyectado.`;
    recommendedAction = 'Te sugerimos priorizar el pago de las tarjetas con mayor tasa de interés.';
  } else if (allCovered) {
    summaryMessage = `Tus próximos pagos (${formatSoles(totalDueSoon)}) están cubiertos con el saldo en tu cuenta.`;
  }

  return {
    items: enrichedItems,
    hasAnySalaryMismatch,
    hasAnyDeficit,
    allCovered,
    totalDueSoon: Math.round(totalDueSoon * 100) / 100,
    totalDueBeforeSalary: Math.round(totalDueBeforeSalary * 100) / 100,
    currentAvailableToday: Math.round(currentDebitBalanceToday * 100) / 100,
    shortfallBeforeSalary: Math.round(shortfallBeforeSalary * 100) / 100,
    primarySalaryPayDay: effectiveSalaryDay,
    primarySalaryAmount: totalSalaries,
    isSalaryCreditedToday,
    summaryMessage,
    recommendedAction
  };
}

