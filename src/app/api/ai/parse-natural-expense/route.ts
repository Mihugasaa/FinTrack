import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash'
];

interface ParseExpenseRequest {
  text: string;
  currentDate?: string;
  availableCategories?: string[];
  availablePaymentMethods?: { id: string; name: string; type: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const body: ParseExpenseRequest = await req.json();
    const { text, currentDate, availableCategories = [], availablePaymentMethods = [] } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Texto no proporcionado' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Key de Gemini no configurada' }, { status: 500 });
    }

    const todayStr = currentDate || new Date().toISOString().split('T')[0];

    const categoryListStr = availableCategories.length > 0
      ? availableCategories.join(', ')
      : 'Alimentación, Transporte, Servicios, Compras, Entretenimiento, Salud, Educación, Vivienda, Otros';

    const paymentMethodsStr = availablePaymentMethods.length > 0
      ? availablePaymentMethods.map(m => `id: "${m.id}", nombre: "${m.name}", tipo: "${m.type}"`).join(' | ')
      : 'Efectivo, Débito, Tarjeta de Crédito';

    const prompt = `Actúa como un asistente financiero inteligente en Perú para la app FinTrack.
El usuario ingresó la siguiente frase rápida para registrar un gasto personal en lenguaje natural:
"${text.trim()}"

FECHA DE HOY DE REFERENCIA: ${todayStr}

CATEGORÍAS DISPONIBLES:
${categoryListStr}

MÉTODOS DE PAGO DISPONIBLES EN EL SISTEMA:
${paymentMethodsStr}

Tu tarea es interpretar la frase y devolver un JSON EXACTO con la siguiente estructura:
{
  "description": "Nombre limpio del gasto o comercio (ej. 'Almuerzo Chifa Titikaka', 'Gasolina Primax', 'Netflix', 'Taxi Cabify')",
  "amount": 45.50,
  "currency": "PEN",
  "date": "YYYY-MM-DD",
  "category": "Nombre exacto de la categoría más adecuada de las disponibles o la más cercana",
  "paymentMethodId": "ID del método de pago si coincide con alguno de la lista disponible, o null si no se identifica con certeza",
  "paymentMethodHint": "Indicio del método de pago (ej. 'TC BCP Visa', 'Débito BBVA', 'Efectivo')",
  "isFixed": false,
  "notes": "Notas adicionales o contexto relevante detectado (sin paréntesis)"
}

REGLAS ESTRICTAS:
1. "amount": Extrae únicamente el monto numérico positivo. Si dijo '85 soles', amount es 85. Si dijo '$30', amount es 30 y currency 'USD'.
2. "currency": "PEN" para Soles, "USD" para Dólares. Por defecto "PEN" a menos que mencione '$' o 'dólares' o 'usd'.
3. "date": Resuelve fechas relativas tomando como base ${todayStr}:
   - 'hoy' -> ${todayStr}
   - 'ayer' -> día anterior a ${todayStr}
   - 'anteayer' -> 2 días antes de ${todayStr}
   - 'el lunes/martes/etc.' -> fecha del día más reciente correspondiente
   - Si no indica fecha, usa ${todayStr}.
4. "paymentMethodId": Si menciona una tarjeta o banco (ej. 'bcp', 'bbva', 'interbank', 'scotiabank', 'crédito', 'debito') y coincide con los métodos de pago proporcionados, asigna su "id".
5. REGLA FUNDAMENTAL DE REDACCIÓN: NO USES PARÉNTESIS '(' ni ')' en ningún campo de texto ("description", "notes", etc.). Usa comas o '•' si necesitas separar.`;

    let parsedResult = null;
    let modelUsed: string | undefined;

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
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
            if (data && (data.amount !== undefined || data.description)) {
              parsedResult = {
                description: String(data.description || text.trim()).replace(/[()]/g, '').trim(),
                amount: Math.abs(parseFloat(String(data.amount).replace(/[^0-9.]/g, '')) || 0),
                currency: (data.currency === 'USD' ? 'USD' : 'PEN') as 'PEN' | 'USD',
                date: data.date || todayStr,
                category: data.category || 'Alimentación',
                paymentMethodId: data.paymentMethodId || null,
                paymentMethodHint: data.paymentMethodHint || null,
                isFixed: Boolean(data.isFixed),
                notes: data.notes ? String(data.notes).replace(/[()]/g, '').trim() : ''
              };
              modelUsed = model;
              break;
            }
          }
        } else {
          console.warn(`[Gemini Parse Natural] Modelo ${model} devolvió ${res.status}`);
        }
      } catch (err) {
        console.warn(`[Gemini Parse Natural] Error con modelo ${model}:`, err);
      }
    }

    if (!parsedResult) {
      return NextResponse.json(
        { success: false, error: 'No se pudo interpretar el texto. Por favor ingresa el monto y descripción manualmente.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      modelUsed,
      data: parsedResult
    });
  } catch (error: any) {
    console.error('Error al procesar gasto con lenguaje natural:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}
