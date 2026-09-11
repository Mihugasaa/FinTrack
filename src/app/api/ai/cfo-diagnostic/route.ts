import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash'
];

interface CFODiagnosticRequest {
  monthName: string;
  year: number;
  totalIncome: number;
  baseSalary: number;
  extraIncomesTotal: number;
  totalConsumedExpenses: number;
  realCashOutflow: number;
  liquidityMargin: number;
  liquidityStatus: string;
  savingsRatePercentage: number;
  topCategories?: { category: string; amount: number; percentage: number }[];
  pendingReceivablesTotal?: number;
  pendingPayablesTotal?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: CFODiagnosticRequest = await req.json();
    const {
      monthName = 'Mes Actual',
      year = new Date().getFullYear(),
      totalIncome = 0,
      baseSalary = 0,
      extraIncomesTotal = 0,
      totalConsumedExpenses = 0,
      realCashOutflow = 0,
      liquidityMargin = 0,
      liquidityStatus = 'ALCANZA',
      savingsRatePercentage = 0,
      topCategories = [],
      pendingReceivablesTotal = 0,
      pendingPayablesTotal = 0
    } = body;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Key de Gemini no configurada' }, { status: 500 });
    }

    const categoriesStr = topCategories.length > 0
      ? topCategories.map(c => `${c.category}: S/ ${c.amount.toFixed(2)} • ${c.percentage}%`).join('\n')
      : 'Sin distribución de categorías disponible';

    const prompt = `Actúa como un Director Financiero Personal (CFO Copilot) de élite para una persona en Perú.
Tu objetivo es analizar los números financieros consolidados del mes y proveer un diagnóstico ejecutivo, nítido, sin tecnicismos innecesarios ni texto de relleno, enfocado en solvencia, fugas y maximización de patrimonio.

DATOS FINANCIEROS DEL PERIODO (${monthName} ${year}):
- Ingresos Totales: S/ ${totalIncome.toFixed(2)} (Sueldo Base: S/ ${baseSalary.toFixed(2)} + Ingresos Extra: S/ ${extraIncomesTotal.toFixed(2)})
- Gastos Consumidos del Mes: S/ ${totalConsumedExpenses.toFixed(2)}
- Salida Real de Caja / Vencimientos a Pagar este Mes: S/ ${realCashOutflow.toFixed(2)}
- Margen de Liquidez: S/ ${liquidityMargin.toFixed(2)} • Estado: ${liquidityStatus}
- Tasa de Ahorro: ${savingsRatePercentage.toFixed(1)}%
- Cuentas por Cobrar Pendientes (Dinero que te deben): S/ ${pendingReceivablesTotal.toFixed(2)}
- Deudas Pendientes con Terceros (Dinero que debes): S/ ${pendingPayablesTotal.toFixed(2)}

CATEGORÍAS DE MAYOR CONSUMO:
${categoriesStr}

Genera un informe ejecutivo estructurado en un JSON EXACTO con estos campos:
{
  "healthScore": 85,
  "healthLevel": "Excelente | Saludable | Alerta | Crítico",
  "liquidityInsight": "Evaluación breve y directa de la salud del flujo de caja y capacidad de cobertura.",
  "spendingLeakInsight": "Detección precisa de la mayor fuga o rubro de riesgo según las categorías.",
  "actionableRecommendation": "Acción inmediata de alto impacto que el usuario debe ejecutar esta semana."
}

REGLAS DE ORO:
1. "healthScore": Calificación entera de 1 a 100 basada en margen positivo, tasa de ahorro (>20% excelente) y nivel de endeudamiento.
2. "healthLevel": Una sola palabra entre "Excelente", "Saludable", "Alerta", "Crítico".
3. CONCISIÓN EJECUTIVA: Cada insight debe tener máximo 2 oraciones contundentes. Cero redundancias.
4. REGLA ESTRICTA DE DISEÑO FINTRACK: PROHIBIDO USAR PARÉNTESIS '(' O ')'. Si necesitas acotar o detallar, usa viñetas '•' o comas. Absolutamente ningún paréntesis.`;

    let diagnosticResult = null;
    let modelUsed: string | undefined;

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const data = JSON.parse(rawText);
            if (data && (data.liquidityInsight || data.healthScore !== undefined)) {
              diagnosticResult = {
                healthScore: Math.min(100, Math.max(0, parseInt(data.healthScore, 10) || 75)),
                healthLevel: String(data.healthLevel || 'Saludable').replace(/[()]/g, '').trim(),
                liquidityInsight: String(data.liquidityInsight || '').replace(/[()]/g, '').trim(),
                spendingLeakInsight: String(data.spendingLeakInsight || '').replace(/[()]/g, '').trim(),
                actionableRecommendation: String(data.actionableRecommendation || '').replace(/[()]/g, '').trim()
              };
              modelUsed = model;
              break;
            }
          }
        } else {
          console.warn(`[Gemini CFO Copilot] Modelo ${model} devolvió ${res.status}`);
        }
      } catch (err) {
        console.warn(`[Gemini CFO Copilot] Error con modelo ${model}:`, err);
      }
    }

    if (!diagnosticResult) {
      // Fallback algorítmico si la API externa no respondiese
      const isPositive = liquidityMargin >= 0;
      const score = isPositive ? Math.min(95, Math.round(50 + savingsRatePercentage)) : Math.max(25, Math.round(50 + (liquidityMargin / (totalIncome || 1)) * 50));
      diagnosticResult = {
        healthScore: Math.max(10, Math.min(100, score)),
        healthLevel: score >= 80 ? 'Excelente' : score >= 60 ? 'Saludable' : score >= 40 ? 'Alerta' : 'Crítico',
        liquidityInsight: isPositive
          ? `Tu margen operativo de S/ ${liquidityMargin.toFixed(2)} respalda con solidez tus pagos del mes con una tasa de ahorro de ${savingsRatePercentage.toFixed(1)}%.`
          : `Presentas un desfase de liquidez de S/ ${Math.abs(liquidityMargin).toFixed(2)} frente a tus salidas de caja programadas.`,
        spendingLeakInsight: topCategories.length > 0
          ? `${topCategories[0].category} concentra el ${topCategories[0].percentage}% de tus gastos consumidos, totalizando S/ ${topCategories[0].amount.toFixed(2)}.`
          : `Tus consumos se encuentran distribuidos sin una categoría dominante anormal.`,
        actionableRecommendation: isPositive
          ? `Deriva al menos S/ ${(liquidityMargin * 0.4).toFixed(2)} a tu fondo de reserva o inversión de bajo riesgo antes de que venza la quincena.`
          : `Pospón compras prescindibles y reprograma compromisos para nivelar la liquidez inmediata.`
      };
    }

    return NextResponse.json({
      success: true,
      modelUsed,
      data: diagnosticResult
    });
  } catch (error: any) {
    console.error('Error al generar diagnóstico CFO con IA:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}
