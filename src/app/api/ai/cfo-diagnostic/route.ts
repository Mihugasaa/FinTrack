import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODELS, geminiEndpoint } from '@/lib/aiConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  // Diagnóstico determinista calculado en el cliente. La IA lo EXPLICA y prioriza,
  // no lo recalcula.
  healthScore?: number;
  healthLevel?: string;
  components?: { label: string; points: number; max: number; detail: string }[];
  trend?: { avgPriorSavings: number; currentSavings: number; improving: boolean };
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
      pendingPayablesTotal = 0,
      healthScore,
      healthLevel,
      components = [],
      trend
    } = body;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Key de Gemini no configurada' }, { status: 500 });
    }

    const categoriesStr = topCategories.length > 0
      ? topCategories.map(c => `${c.category}: S/ ${c.amount.toFixed(2)} • ${c.percentage.toFixed(1)}%`).join('\n')
      : 'Sin distribución de categorías disponible';

    const componentsStr = components.length > 0
      ? components.map(c => `${c.label}: ${c.points}/${c.max} pts • ${c.detail}`).join('\n')
      : 'Sin desglose de componentes disponible';

    const trendStr = trend
      ? `Ahorro del mes S/ ${trend.currentSavings.toFixed(2)} vs promedio previo S/ ${trend.avgPriorSavings.toFixed(2)} • ${trend.improving ? 'mejorando' : 'empeorando'}`
      : 'Sin tendencia disponible';

    const prompt = `Actúa como un Director Financiero Personal (CFO Copilot) de élite para una persona en Perú.
El puntaje de salud financiera YA fue calculado de forma determinista por el sistema. Tu trabajo NO es recalcularlo ni cuestionarlo, sino EXPLICARLO en lenguaje claro y priorizar la acción de mayor impacto. Sé nítido, sin tecnicismos innecesarios ni relleno.

DIAGNÓSTICO YA CALCULADO (${monthName} ${year}):
- Salud Financiera: ${healthScore ?? 'N/D'}/100 • Nivel: ${healthLevel ?? 'N/D'}
- Desglose del puntaje:
${componentsStr}
- Tendencia: ${trendStr}

DATOS FINANCIEROS DEL PERIODO:
- Ingresos Totales: S/ ${totalIncome.toFixed(2)} • Sueldo Base S/ ${baseSalary.toFixed(2)} + Extra S/ ${extraIncomesTotal.toFixed(2)}
- Gastos Consumidos del Mes: S/ ${totalConsumedExpenses.toFixed(2)}
- Salida Real de Caja este Mes: S/ ${realCashOutflow.toFixed(2)}
- Margen de Liquidez: S/ ${liquidityMargin.toFixed(2)} • Estado: ${liquidityStatus}
- Tasa de Ahorro: ${savingsRatePercentage.toFixed(1)}%
- Cuentas por Cobrar Pendientes: S/ ${pendingReceivablesTotal.toFixed(2)}
- Deudas Pendientes con Terceros: S/ ${pendingPayablesTotal.toFixed(2)}

CATEGORÍAS DE MAYOR CONSUMO:
${categoriesStr}

Genera un informe ejecutivo en un JSON EXACTO con estos campos:
{
  "liquidityInsight": "Explica en lenguaje simple qué significa el margen y el nivel de salud para su capacidad de cubrir el mes.",
  "spendingLeakInsight": "Señala la mayor fuga o rubro de riesgo según las categorías y el desglose del puntaje.",
  "actionableRecommendation": "La ÚNICA acción de mayor impacto que debe ejecutar esta semana, coherente con el componente más débil del puntaje."
}

REGLAS DE ORO:
1. Coherencia: tus textos deben alinearse con el puntaje ${healthScore ?? ''} y su nivel ${healthLevel ?? ''}. No contradigas el número ya calculado.
2. CONCISIÓN EJECUTIVA: cada insight máximo 2 oraciones contundentes. Cero redundancias.
3. NÚMEROS LIMPIOS: redondea todo porcentaje a un decimal y todo monto a dos decimales. Nunca escribas cifras con muchos decimales.
4. REGLA ESTRICTA DE DISEÑO FINTRACK: PROHIBIDO USAR PARÉNTESIS '(' O ')'. Si necesitas acotar, usa viñetas '•' o comas. Absolutamente ningún paréntesis.`;

    // El puntaje es determinista y llega ya calculado desde el cliente. La IA solo
    // aporta la narrativa; nunca sobreescribe el número. Si por retrocompatibilidad
    // no llegara, caemos a una estimación simple.
    const fallbackScore = liquidityMargin >= 0
      ? Math.min(95, Math.round(50 + savingsRatePercentage))
      : Math.max(25, Math.round(50 + (liquidityMargin / (totalIncome || 1)) * 50));
    const resolvedScore = typeof healthScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(healthScore)))
      : Math.max(10, Math.min(100, fallbackScore));
    const resolvedLevel = (healthLevel && String(healthLevel).replace(/[()]/g, '').trim())
      || (resolvedScore >= 80 ? 'Excelente' : resolvedScore >= 60 ? 'Saludable' : resolvedScore >= 40 ? 'Alerta' : 'Crítico');

    let diagnosticResult = null;
    let modelUsed: string | undefined;

    for (const model of GEMINI_MODELS) {
      try {
        const url = geminiEndpoint(model, apiKey);
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
            if (data && data.liquidityInsight) {
              diagnosticResult = {
                healthScore: resolvedScore,
                healthLevel: resolvedLevel,
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
      // Fallback algorítmico de la NARRATIVA si la API externa no respondiese.
      // El puntaje sigue siendo el determinista (resolvedScore/resolvedLevel).
      const isPositive = liquidityMargin >= 0;
      diagnosticResult = {
        healthScore: resolvedScore,
        healthLevel: resolvedLevel,
        liquidityInsight: isPositive
          ? `Tu margen operativo de S/ ${liquidityMargin.toFixed(2)} respalda con solidez tus pagos del mes con una tasa de ahorro de ${savingsRatePercentage.toFixed(1)}%.`
          : `Presentas un desfase de liquidez de S/ ${Math.abs(liquidityMargin).toFixed(2)} frente a tus salidas de caja programadas.`,
        spendingLeakInsight: topCategories.length > 0
          ? `${topCategories[0].category} concentra el ${Number(topCategories[0].percentage || 0).toFixed(1)}% de tus gastos consumidos, totalizando S/ ${topCategories[0].amount.toFixed(2)}.`
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
