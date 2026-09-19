/**
 * FINTRACK - AI & MACHINE LEARNING INTELLIGENCE SERVICE
 * Provee:
 * 1. Categorización predictiva por NLP y catálogo de comercios peruanos/globales.
 * 2. Detección inteligente de anomalías (cargos duplicados, picos inusuales, suscripciones no detectadas).
 * 3. Motor predictivo de proyección de flujo de caja a 3 y 6 meses (Cashflow Forecasting).
 */

import { Category, Transaction, SalaryIncome, AIAnomaly, CashflowForecastMonth, Payable, Receivable } from '@/types';
import { FALLBACK_USD_PEN_RATE } from '@/lib/constants';

// Catálogo semántico de comercios y patrones
const MERCHANT_PATTERNS: { keywords: string[]; categoryKeyword: string; isFixedDefault?: boolean }[] = [
  // Suscripciones y Streaming
  {
    keywords: ['netflix', 'spotify', 'disney', 'prime video', 'amazon prime', 'hbo', 'max', 'youtube', 'apple.com', 'crunchyroll', 'paramount', 'star+', 'patreon', 'chatgpt', 'openai', 'claude', 'midjourney', 'github'],
    categoryKeyword: 'Suscripciones y Streaming',
    isFixedDefault: true
  },
  // Seguros y Servicios Fijos
  {
    keywords: ['sedapal', 'enel', 'luz del sur', 'claro', 'movistar', 'entel', 'bitel', 'rimac', 'pacifico', 'mapfre', 'la positiva', 'oncosalud', 'interseguro', 'alquiler', 'mantenimiento', 'arbitrios'],
    categoryKeyword: 'Seguros y Servicios Fijos',
    isFixedDefault: true
  },
  // Transporte
  {
    keywords: ['uber', 'cabify', 'didi', 'indrive', 'taxi', 'linea 1', 'metropolitano', 'corredor', 'peaje', 'rutas de lima', 'lima express', 'primax', 'repsol', 'petroperu', 'shell', 'gasolinera', 'grifo'],
    categoryKeyword: 'Transporte'
  },
  // Comida y Restaurantes
  {
    keywords: ['rappi', 'pedidosya', 'starbucks', 'bembos', 'kfc', 'mcdonald', 'burger king', 'pardos', 'rokys', 'norkys', 'chilis', 'pizza hut', 'papa john', 'sushi', 'chifa', 'restaurante', 'cafe', 'panaderia', 'pasteleria', 'san antonio', 'tip top', 'marabunta', 'la leña', 'la lucha', 'sangucheria'],
    categoryKeyword: 'Comida y Restaurantes'
  },
  // Compras y Supermercado
  {
    keywords: ['plazavea', 'plaza vea', 'wong', 'metro', 'tottus', 'vivanda', 'tambo', 'oxxo', 'makro', 'mass', 'falabella', 'saga', 'ripley', 'zara', 'h&m', 'mango', 'mercadolibre', 'mercado libre', 'amazon', 'aliexpress', 'linio', 'dollarcity'],
    categoryKeyword: 'Compras y Shopping'
  },
  // Salud
  {
    keywords: ['inkafarma', 'mifarma', 'farmacia', 'botica', 'clinica', 'san pablo', 'ricardo palma', 'anglo americana', 'laboratorio', 'roe', 'dentista', 'odontologia', 'oftalmologia', 'optica', 'gmo'],
    categoryKeyword: 'Salud'
  },
  // Entretenimiento y Ocio
  {
    keywords: ['cineplanet', 'cinemark', 'cinepolis', 'teleticket', 'joinnus', 'concierto', 'discoteca', 'bar', 'club', 'gym', 'smart fit', 'golds gym', 'sportlife', 'steam', 'playstation', 'nintendo', 'xbox'],
    categoryKeyword: 'Entretenimiento y Ocio'
  },
  // Tecnología
  {
    keywords: ['coolbox', 'memory kings', 'sercoplus', 'impacto', 'sony', 'samsung', 'xiaomi', 'istore', 'mac center', 'computo', 'laptop'],
    categoryKeyword: 'Tecnología'
  },
  // Hogar y Electrodomésticos
  {
    keywords: ['sodimac', 'promart', 'maestro', 'ikea', 'casaideas', 'ferreteria', 'electrolux', 'lg'],
    categoryKeyword: 'Hogar y Electrodomésticos'
  },
  // Viajes
  {
    keywords: ['latam', 'sky airline', 'jetsmart', 'iberia', 'avianca', 'booking', 'airbnb', 'despegar', 'hotel', 'hostel', 'vuelo', 'aeropuerto'],
    categoryKeyword: 'Viajes'
  }
];

export class AIIntelligenceService {
  /**
   * Predice la categoría más probable para un comercio o descripción mediante NLP y heurística
   */
  public static predictCategory(
    description: string,
    categories: Category[]
  ): { categoryId: string; categoryName: string; confidence: number; isFixedSuggestion: boolean } | null {
    if (!description || description.trim().length === 0) return null;

    const cleanDesc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const pattern of MERCHANT_PATTERNS) {
      for (const kw of pattern.keywords) {
        if (cleanDesc.includes(kw)) {
          const matchedCategory = categories.find(c =>
            c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
            pattern.categoryKeyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          );

          if (matchedCategory) {
            // Calcular confianza según longitud y coincidencia exacta
            const isExact = cleanDesc === kw || cleanDesc.startsWith(kw + ' ') || cleanDesc.endsWith(' ' + kw);
            const confidence = isExact ? 0.96 : 0.85;

            return {
              categoryId: matchedCategory.id,
              categoryName: matchedCategory.name,
              confidence,
              isFixedSuggestion: !!pattern.isFixedDefault
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Parser LOCAL de gasto en lenguaje natural (sin IA): resuelve el caso común de
   * forma instantánea. Extrae monto, moneda, fecha relativa, categoría —reusando
   * `predictCategory`— y medio de pago. Devuelve `confidence`; el llamador decide
   * si con eso basta o cae al parser con IA como respaldo.
   */
  public static parseExpenseLocally(
    text: string,
    currentDate: string,
    categories: Category[],
    paymentMethods: { id: string; name: string; type: string }[]
  ): {
    description: string;
    amount: number;
    currency: 'PEN' | 'USD';
    date: string;
    categoryId: string | null;
    categoryName: string | null;
    paymentMethodId: string | null;
    isFixed: boolean;
    confidence: number;
  } | null {
    if (!text || !text.trim()) return null;
    const raw = text.trim();
    const lower = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    // Moneda: $, dólar o usd → USD; por defecto PEN.
    const currency: 'PEN' | 'USD' = /\$|dolar|usd/.test(lower) ? 'USD' : 'PEN';

    // Monto: preferimos un número adyacente a símbolo/moneda; si no, el primer número.
    let amount = 0;
    const adj = lower.match(/(?:s\/\.?\s*|\$\s*)(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:soles|sol|dolares|dolar|usd)/);
    if (adj) {
      amount = parseFloat((adj[1] || adj[2] || '0').replace(',', '.'));
    } else {
      const first = lower.match(/\d+(?:[.,]\d+)?/);
      if (first) amount = parseFloat(first[0].replace(',', '.'));
    }

    // Fecha relativa respecto a currentDate.
    let date = currentDate;
    const base = new Date(`${currentDate}T12:00:00`);
    const toStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    if (/\banteayer\b/.test(lower)) { const d = new Date(base); d.setDate(d.getDate() - 2); date = toStr(d); }
    else if (/\bayer\b/.test(lower)) { const d = new Date(base); d.setDate(d.getDate() - 1); date = toStr(d); }
    else if (/\bhoy\b/.test(lower)) { date = currentDate; }
    else {
      const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const idx = days.findIndex(d => new RegExp(`\\b${d}\\b`).test(lower));
      if (idx >= 0) {
        const d = new Date(base);
        let diff = (d.getDay() - idx + 7) % 7;
        if (diff === 0) diff = 7; // el día de semana más reciente ya pasado
        d.setDate(d.getDate() - diff);
        date = toStr(d);
      }
    }

    // Categoría reusando el catálogo de comercios.
    const pred = this.predictCategory(raw, categories);

    // Medio de pago por coincidencia de nombre o pista de banco/tipo.
    let paymentMethodId: string | null = null;
    for (const pm of paymentMethods) {
      const pmName = pm.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (pmName && lower.includes(pmName)) { paymentMethodId = pm.id; break; }
    }
    if (!paymentMethodId) {
      const hints = ['bcp', 'bbva', 'interbank', 'scotiabank', 'yape', 'plin', 'efectivo', 'debito', 'credito'];
      const hint = hints.find(h => lower.includes(h));
      if (hint) {
        const match = paymentMethods.find(pm =>
          pm.name.toLowerCase().includes(hint) ||
          (hint === 'credito' && pm.type === 'credit') ||
          (hint === 'debito' && pm.type === 'debit') ||
          (hint === 'efectivo' && pm.type === 'cash')
        );
        if (match) paymentMethodId = match.id;
      }
    }

    // Descripción: quitamos tokens de monto/moneda/fecha y verbos de relleno.
    let desc = raw
      .replace(/s\/\.?\s*\d+(?:[.,]\d+)?/gi, '')
      .replace(/\$\s*\d+(?:[.,]\d+)?/gi, '')
      .replace(/\d+(?:[.,]\d+)?\s*(?:soles|sol|dolares|dolar|usd)/gi, '')
      .replace(/\b(hoy|ayer|anteayer|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, '')
      .replace(/\b(gast[eé]|pagu[eé]|compr[eé]|gasto de|pago de|en)\b/gi, ' ')
      .replace(/\d+(?:[.,]\d+)?/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!desc) desc = pred?.categoryName || raw;

    const confidence = amount > 0 ? (pred ? 0.85 : 0.6) : 0.2;

    return {
      description: desc.charAt(0).toUpperCase() + desc.slice(1),
      amount,
      currency,
      date,
      categoryId: pred?.categoryId || null,
      categoryName: pred?.categoryName || null,
      paymentMethodId,
      isFixed: pred?.isFixedSuggestion || false,
      confidence
    };
  }

  /**
   * Detecta anomalías y riesgos en las transacciones registradas.
   * `transactions` es el conjunto del mes visible (para cargos duplicados y picos,
   * que son mensuales). `historyTransactions` es el historial completo, usado solo
   * para detectar suscripciones recurrentes reales (requiere ver varios meses).
   */
  public static detectAnomalies(
    transactions: Transaction[],
    categories: Category[],
    historyTransactions: Transaction[] = transactions
  ): AIAnomaly[] {
    const anomalies: AIAnomaly[] = [];
    if (!transactions || transactions.length === 0) return anomalies;

    // 1. Detección de Posibles Cobros Duplicados (Mismo monto, mismo comercio en <= 48 horas)
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        const timeDiffHours = Math.abs(new Date(next.date).getTime() - new Date(current.date).getTime()) / (1000 * 60 * 60);

        if (timeDiffHours > 48) break; // Fuera del rango de alerta

        const sameAmount = Math.abs(current.amountPen - next.amountPen) < 0.01;
        const normCurrent = current.description.toLowerCase().trim();
        const normNext = next.description.toLowerCase().trim();
        const similarDesc = normCurrent === normNext || normCurrent.includes(normNext) || normNext.includes(normCurrent);

        if (sameAmount && similarDesc && current.id !== next.id) {
          anomalies.push({
            id: `anom-dup-${current.id}-${next.id}`,
            type: 'duplicate_charge',
            severity: 'high',
            title: 'Posible Cobro Duplicado Detectado',
            description: `Se detectaron 2 cargos de S/ ${current.amountPen.toFixed(2)} en "${current.description}" con menos de 48h de diferencia (${current.date} y ${next.date}).`,
            transactionId: next.id,
            amount: next.amountPen,
            date: next.date,
            suggestedAction: 'Verifica tu estado de cuenta bancario para descartar un doble cobro del POS.'
          });
        }
      }
    }

    // 2. Detección de Picos Inusuales de Gasto (> 2.5x el promedio de la categoría)
    const categoryTotals: Record<string, number[]> = {};
    transactions.forEach(t => {
      if (!categoryTotals[t.categoryId]) categoryTotals[t.categoryId] = [];
      categoryTotals[t.categoryId].push(t.amountPen);
    });

    Object.entries(categoryTotals).forEach(([catId, amounts]) => {
      if (amounts.length >= 3) {
        const avg = amounts.reduce((acc, curr) => acc + curr, 0) / amounts.length;
        const catName = categories.find(c => c.id === catId)?.name || 'Categoría';

        amounts.forEach(amt => {
          if (amt > avg * 2.8 && amt > 150) {
            const highTx = transactions.find(t => t.categoryId === catId && t.amountPen === amt);
            if (highTx) {
              anomalies.push({
                id: `anom-spike-${highTx.id}`,
                type: 'unusual_spike',
                severity: 'medium',
                title: `Gasto Inusualmente Alto en ${catName}`,
                description: `El consumo de S/ ${amt.toFixed(2)} en "${highTx.description}" supera por ${(amt / avg).toFixed(1)}x la media de ${catName} (S/ ${avg.toFixed(2)}).`,
                transactionId: highTx.id,
                amount: amt,
                date: highTx.date,
                suggestedAction: 'Considera si es un gasto extraordinario único o si requiere presupuesto adicional.'
              });
            }
          }
        });
      }
    });

    // 3. Suscripciones recurrentes no marcadas como fijas.
    // Regla endurecida: ya NO alerta por cualquier descripción repetida (eso hacía
    // saltar gastos como varios cafés el mismo mes). Exige señales de suscripción
    // real: mismo comercio, MONTO SIMILAR y SEPARACIÓN MENSUAL en meses distintos.
    // Se evalúa sobre el historial completo (varios meses), no solo el mes visible.
    const recurringCandidates: Record<string, Transaction[]> = {};
    historyTransactions.forEach(t => {
      if (!t.isFixedSubscription && !t.isRefund) {
        const descKey = t.description.toLowerCase().trim();
        if (!descKey) return;
        if (!recurringCandidates[descKey]) recurringCandidates[descKey] = [];
        recurringCandidates[descKey].push(t);
      }
    });

    // Referencia de "reciente": la fecha más nueva del historial. Solo alertamos por
    // suscripciones aún activas (última ocurrencia dentro de ~62 días de esa fecha).
    const latestMs = historyTransactions.reduce(
      (max, t) => Math.max(max, new Date(t.date).getTime()),
      0
    );

    const isSimilarAmount = (a: number, b: number) => Math.abs(a - b) <= Math.max(5, Math.min(a, b) * 0.1);

    Object.values(recurringCandidates).forEach(txs => {
      if (txs.length < 2) return;
      const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Buscar un par con monto similar y separación mensual (20-45 días) en meses
      // calendario distintos: eso distingue una suscripción de repeticiones intra-mes.
      let hasMonthlyPair = false;
      for (let i = 0; i < sorted.length && !hasMonthlyPair; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const days = Math.abs(new Date(sorted[j].date).getTime() - new Date(sorted[i].date).getTime()) / 86400000;
          const differentMonth = sorted[i].date.slice(0, 7) !== sorted[j].date.slice(0, 7);
          if (differentMonth && days >= 20 && days <= 45 && isSimilarAmount(sorted[i].amountPen, sorted[j].amountPen)) {
            hasMonthlyPair = true;
            break;
          }
        }
      }
      if (!hasMonthlyPair) return;

      // Solo suscripciones vigentes: la última ocurrencia debe ser reciente.
      const latestOccurrence = sorted[sorted.length - 1];
      const daysSinceLast = (latestMs - new Date(latestOccurrence.date).getTime()) / 86400000;
      if (daysSinceLast > 62) return;

      const sample = latestOccurrence;
      anomalies.push({
        id: `anom-sub-${sample.id}`,
        type: 'unregistered_subscription',
        severity: 'low',
        title: `Gasto Recurrente No Marcado como Fijo`,
        description: `"${sample.description}" se repite cada mes con un monto similar (~S/ ${sample.amountPen.toFixed(2)}, ${sorted.length} veces). Marcarlo como "Fijo" te ayudará a proyectar tu liquidez automáticamente.`,
        transactionId: sample.id,
        amount: sample.amountPen,
        date: sample.date,
        suggestedAction: 'Edita este gasto y activa "Gasto fijo recurrente" para proyectarlo en los siguientes meses.'
      });
    });

    return anomalies;
  }

  /**
   * Genera la proyección prospectiva de liquidez para los siguientes 3 a 6 meses
   * Replica y proyecta la fórmula P9 del Excel hacia el futuro
   */
  public static generateCashflowForecast(
    currentYear: number,
    currentMonth: number,
    initialStartingBalance: number,
    salaries: SalaryIncome[],
    fixedExpensesList: Transaction[],
    historicalMonthlyVariableAvg: number,
    monthsAhead: number = 6,
    allTransactions: Transaction[] = [],
    creditCardIds: string[] = [],
    // Ingresos extra reales ya registrados por mes (YYYY-MM). Permite que la
    // proyección considere ingresos adicionales que el usuario anticipó para meses
    // futuros sin necesidad de navegar hasta ese mes.
    extraIncomesByMonth: Record<string, { amount: number }[]> = {},
    // Saldo inicial anticipado por mes (YYYY-MM). Si el usuario fijó a mano el saldo
    // de arranque de un mes futuro, se usa como ancla en lugar del arrastre calculado.
    initialBalanceOverrides: Record<string, number> = {},
    // Deudas propias y cobranzas de terceros con fecha de vencimiento: las que caen
    // en un mes futuro se proyectan como salida/entrada programada de caja.
    payables: Payable[] = [],
    receivables: Receivable[] = []
  ): CashflowForecastMonth[] {
    const forecast: CashflowForecastMonth[] = [];
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    let runningBalance = initialStartingBalance;
    const totalSalary = salaries.reduce((acc, curr) => acc + curr.amount, 0);

    for (let offset = 1; offset <= monthsAhead; offset++) {
      let targetMonth = currentMonth + offset;
      let targetYear = currentYear;

      while (targetMonth > 12) {
        targetMonth -= 12;
        targetYear += 1;
      }

      const targetYM = `${targetYear}-${targetMonth.toString().padStart(2, '0')}`;
      const monthLabel = `${monthNames[targetMonth - 1]} ${targetYear}`;
      // Si el usuario fijó un saldo inicial para este mes futuro, ese valor ancla la
      // proyección; si no, se arrastra el saldo final del mes anterior.
      const override = initialBalanceOverrides[targetYM];
      const projectedInitial = (typeof override === 'number' && override > 0) ? override : runningBalance;
      // Ingreso previsto = sueldo + ingresos extra que el usuario ya anticipó para
      // ese mes futuro (bonos, reembolsos programados, préstamos por recibir, etc.).
      const extraIncomeThisMonth = (extraIncomesByMonth[targetYM] || [])
        .reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const expectedIncome = totalSalary + extraIncomeThisMonth;

      // 1. Salidas reales por vencimientos bancarios de tarjetas de crédito en este mes exacto
      const cardPaymentsDue = allTransactions
        .filter(t => creditCardIds.includes(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(targetYM))
        .reduce((acc, curr) => acc + curr.amountPen, 0);

      // Si no hay transacciones programadas para ese mes futuro, proyectar con los fijos de tarjeta recurrentes
      const fallbackCardFixed = fixedExpensesList
        .filter(t => creditCardIds.includes(t.paymentMethodId))
        .reduce((acc, curr) => acc + curr.amountPen, 0);

      const projectedCardOutflows = cardPaymentsDue > 0 ? cardPaymentsDue : fallbackCardFixed;

      // 2. Gastos fijos directos en Débito o Efectivo (suscripciones y servicios en cuenta)
      const debitFixed = fixedExpensesList
        .filter(t => !creditCardIds.includes(t.paymentMethodId))
        .reduce((acc, curr) => acc + curr.amountPen, 0);

      // Fijos en débito se mantienen separados de las tarjetas para que la matemática sea mutuamente excluyente y transparente
      const fixedExpenses = debitFixed;
      const projectedVariableExpenses = historicalMonthlyVariableAvg > 0 ? historicalMonthlyVariableAvg : 800.00;

      // 3. Deudas propias que vencen este mes (salida programada de caja).
      const scheduledDebtDue = payables
        .filter(p => (p.dueDate || '').startsWith(targetYM) && p.status !== 'PAID')
        .reduce((acc, p) => {
          const rem = p.remainingAmount ?? (p.totalAmount ?? p.originalAmount ?? 0);
          const pen = p.currency === 'USD' ? rem * (p.exchangeRate || FALLBACK_USD_PEN_RATE) : rem;
          return acc + Math.max(0, pen);
        }, 0);

      // 4. Cobranzas esperadas de terceros que vencen este mes (entrada programada).
      const scheduledReceivableDue = receivables
        .filter(r => (r.dueDate || '').startsWith(targetYM) && r.status !== 'paid')
        .reduce((acc, r) => {
          const rem = r.remainingAmount ?? 0;
          const pen = r.currency === 'USD' ? rem * (r.exchangeRate || FALLBACK_USD_PEN_RATE) : rem;
          return acc + Math.max(0, pen);
        }, 0);

      const totalProjectedOutflow = fixedExpenses + projectedCardOutflows + projectedVariableExpenses + scheduledDebtDue;

      // Dinero disponible antes de gastos del mes = saldo anterior + ingresos + cobranzas programadas
      const totalAvailable = projectedInitial + expectedIncome + scheduledReceivableDue;
      const projectedEndingBalance = totalAvailable - totalProjectedOutflow;
      const liquidityMargin = projectedEndingBalance;
      const isDeficitRisk = liquidityMargin < 0;

      forecast.push({
        year: targetYear,
        month: targetMonth,
        monthLabel,
        projectedInitialBalance: Math.round(projectedInitial * 100) / 100,
        expectedIncome: Math.round(expectedIncome * 100) / 100,
        fixedExpenses: Math.round(fixedExpenses * 100) / 100,
        projectedVariableExpenses: Math.round(projectedVariableExpenses * 100) / 100,
        projectedCardOutflows: Math.round(projectedCardOutflows * 100) / 100,
        totalProjectedOutflow: Math.round(totalProjectedOutflow * 100) / 100,
        projectedEndingBalance: Math.round(projectedEndingBalance * 100) / 100,
        liquidityMargin: Math.round(liquidityMargin * 100) / 100,
        isDeficitRisk,
        scheduledDebtDue: Math.round(scheduledDebtDue * 100) / 100,
        scheduledReceivableDue: Math.round(scheduledReceivableDue * 100) / 100
      });

      // El saldo final proyectado se convierte en el saldo inicial del siguiente mes
      runningBalance = projectedEndingBalance;
    }

    return forecast;
  }
}
