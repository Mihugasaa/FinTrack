/**
 * FINTRACK - AI & MACHINE LEARNING INTELLIGENCE SERVICE
 * Provee:
 * 1. Categorización predictiva por NLP y catálogo de comercios peruanos/globales.
 * 2. Detección inteligente de anomalías (cargos duplicados, picos inusuales, suscripciones no detectadas).
 * 3. Motor predictivo de proyección de flujo de caja a 3 y 6 meses (Cashflow Forecasting).
 */

import { Category, Transaction, SalaryIncome, AIAnomaly, CashflowForecastMonth } from '@/types';

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
   * Detecta anomalías y riesgos en las transacciones registradas
   */
  public static detectAnomalies(transactions: Transaction[], categories: Category[]): AIAnomaly[] {
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

    // 3. Suscripciones Recurrentes no marcadas como fijas
    const recurringCandidates: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      if (!t.isFixedSubscription) {
        const descKey = t.description.toLowerCase().trim();
        if (!recurringCandidates[descKey]) recurringCandidates[descKey] = [];
        recurringCandidates[descKey].push(t);
      }
    });

    Object.entries(recurringCandidates).forEach(([desc, txs]) => {
      if (txs.length >= 2) {
        const sample = txs[0];
        anomalies.push({
          id: `anom-sub-${sample.id}`,
          type: 'unregistered_subscription',
          severity: 'low',
          title: `Gasto Recurrente No Marcado como Fijo`,
          description: `"${sample.description}" se repite varias veces (S/ ${sample.amountPen.toFixed(2)}). Marcarlo como "Fijo" te ayudará a proyectar tu liquidez automáticamente.`,
          transactionId: sample.id,
          amount: sample.amountPen,
          date: sample.date,
          suggestedAction: 'Edita este gasto y activa "Gasto fijo recurrente" para proyectarlo en los siguientes meses.'
        });
      }
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
    initialBalanceOverrides: Record<string, number> = {}
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

      // 2. Gastos fijos directos en Débito o Efectivo
      const debitFixed = fixedExpensesList
        .filter(t => !creditCardIds.includes(t.paymentMethodId))
        .reduce((acc, curr) => acc + curr.amountPen, 0);

      const fixedExpenses = debitFixed + projectedCardOutflows;
      const projectedVariableExpenses = historicalMonthlyVariableAvg > 0 ? historicalMonthlyVariableAvg : 800.00;
      const totalProjectedOutflow = fixedExpenses + projectedVariableExpenses;

      // Dinero disponible antes de gastos del mes = saldo anterior + ingresos
      const totalAvailable = projectedInitial + expectedIncome;
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
        isDeficitRisk
      });

      // El saldo final proyectado se convierte en el saldo inicial del siguiente mes
      runningBalance = projectedEndingBalance;
    }

    return forecast;
  }
}
