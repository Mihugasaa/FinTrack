import { NextRequest, NextResponse } from 'next/server';
import { StatementTransaction } from '@/types';
import { GEMINI_MODELS, geminiEndpoint } from '@/lib/aiConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RawAITransaction {
  date?: string;
  description?: string;
  amount?: number | string;
  currency?: string;
  type?: 'debit' | 'credit';
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Reconciliation PDF Parser with Gemini AI + Local Fallback',
    models: GEMINI_MODELS
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se envió ningún archivo' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El archivo PDF está vacío' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    let parsedTransactions: StatementTransaction[] = [];
    let methodUsed: 'gemini' | 'local_fallback' = 'local_fallback';
    let modelNameUsed: string | undefined;

    // 1. INTENTO CON GEMINI AI MULTIMODAL (Google AI Studio)
    if (apiKey) {
      const base64Pdf = buffer.toString('base64');
      const prompt = `Actúa como un experto analista contable y financiero peruano.
Analiza con máxima precisión este estado de cuenta bancario o de tarjeta de crédito (BCP, BBVA, Interbank, Scotiabank u otro banco en Perú).

Extrae TODOS los movimientos o transacciones financieras en un arreglo JSON con el siguiente esquema exacto:
[
  {
    "date": "YYYY-MM-DD",
    "description": "Nombre limpio del establecimiento, comercio o concepto (ej. Supermercados Metro, Starbucks, Uber, etc.)",
    "amount": 125.50,
    "currency": "PEN",
    "type": "debit"
  }
]

Reglas estrictas:
1. "date": usa la FECHA DE CONSUMO del movimiento (no la fecha de proceso si aparecen ambas), normalizada obligatoriamente a formato ISO "YYYY-MM-DD" (ejemplo: si dice 15/04/2024 -> "2024-04-15"). Si el año no aparece en la fila, dedúcelo del ciclo de facturación o del periodo del estado de cuenta. Interpreta los meses abreviados en español EXACTAMENTE así: Ene=01, Feb=02, Mar=03, Abr=04, May=05, Jun=06, Jul=07, Ago=08, Set/Sep=09, Oct=10, Nov=11, Dic=12. Cuidado: "Set" es SETIEMBRE (09), no confundas "Ago" (agosto, 08) con julio.
2. "description": limpia códigos de terminales, números de operación repetitivos o sufijos de país (como "OP. 000342", "LIMA PE", "POS 4321"). Deja el nombre identificable del comercio o servicio.
3. "amount": número positivo flotante/decimal de 2 cifras, en la moneda de ESE movimiento. Omite símbolos de moneda (S/, $, USD). NUNCA conviertas entre monedas: usa el número tal cual aparece en su columna.
4. "currency": moneda del movimiento. Los estados de cuenta de tarjeta suelen tener DOS columnas de importe: "Soles" (S/) y "Dólares" (US$/$). Devuelve "USD" si el importe está en la columna de dólares, o "PEN" si está en la de soles. Si solo hay una moneda en todo el documento, usa esa.
5. "type":
   - "debit" para consumos, compras en comercios, retiros de efectivo, cargos por membresía, comisiones o seguros.
   - "credit" para pagos de tarjeta, abonos, transferencias recibidas o sueldos.
6. NO incluyas filas de totales, líneas de saldos iniciales o finales (SALDO ANTERIOR), ni resúmenes publicitarios. Únicamente movimientos individuales.`;

      for (const model of GEMINI_MODELS) {
        try {
          const url = geminiEndpoint(model, apiKey);
          const payload = {
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: 'application/pdf',
                      data: base64Pdf
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          };

          const aiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const rawJsonText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

            if (rawJsonText) {
              const rawList: RawAITransaction[] = JSON.parse(rawJsonText);
              if (Array.isArray(rawList) && rawList.length > 0) {
                parsedTransactions = rawList
                  .filter(t => t.date && t.amount !== undefined)
                  .map((t, index) => {
                    const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount).replace(/[^0-9.]/g, '')) || 0;
                    return {
                      id: `stmt-pdf-ai-${index + 1}-${Date.now()}`,
                      date: t.date || new Date().toISOString().split('T')[0],
                      description: (t.description || 'Consumo bancario').trim(),
                      amount: Math.abs(Math.round(amt * 100) / 100),
                      currency: String(t.currency).toUpperCase() === 'USD' ? 'USD' : 'PEN',
                      type: t.type === 'credit' ? 'credit' : 'debit',
                      originalRowIndex: index + 1
                    };
                  });

                if (parsedTransactions.length > 0) {
                  methodUsed = 'gemini';
                  modelNameUsed = model;
                  break; // Éxito con este modelo
                }
              }
            }
          } else {
            console.warn(`[Gemini Parse PDF] Model ${model} returned ${aiRes.status}, intentando siguiente modelo...`);
          }
        } catch (modelErr) {
          console.warn(`[Gemini Parse PDF] Fallo al llamar a ${model}:`, modelErr);
        }
      }
    }

    // 2. FALLBACK HÍBRIDO LOCAL: Si Gemini no estuvo disponible o no devolvió datos
    if (parsedTransactions.length === 0) {
      try {
        console.log('[Gemini Parse PDF] Usando fallback híbrido local con PDFParse...');
        // Carga diferida: pdfjs solo se toca si Gemini no resolvió, y así su
        // salud en serverless nunca afecta al camino principal ni al GET.
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        const fullText = textResult?.text || '';
        const lines = fullText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

        const fallbackList: StatementTransaction[] = [];
        let lineIdx = 0;

        for (const line of lines) {
          lineIdx++;
          // Buscar patrones de fecha DD/MM/YYYY o DD-MM-YYYY
          const dateMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (!dateMatch) continue;

          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2].padStart(2, '0');
          const year = dateMatch[3];
          const isoDate = `${year}-${month}-${day}`;

          // Buscar importes numéricos con decimales (ej. 120.50 o 1,250.00)
          const amountMatches = [...line.matchAll(/(?:S\/\s*|\$\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/g)];
          if (amountMatches.length === 0) continue;

          // Tomar el último monto de la línea como el importe de la operación
          const lastAmtMatch = amountMatches[amountMatches.length - 1];
          const rawNum = lastAmtMatch[1].replace(/,/g, '');
          const amount = parseFloat(rawNum);
          if (isNaN(amount) || amount <= 0) continue;

          // Extraer descripción quitando fecha y monto
          let desc = line
            .replace(dateMatch[0], '')
            .replace(lastAmtMatch[0], '')
            .replace(/(?:S\/|US\$|\$|PEN|USD)/gi, '')
            .trim();

          if (!desc || desc.length < 2) {
            desc = 'Consumo en estado de cuenta';
          }

          const isCredit = /abono|deposito|transferencia recibida|sueldo|pago de tarjeta|haber/i.test(line);
          const isUsd = /US\$|USD|d[oó]lar/i.test(line);

          fallbackList.push({
            id: `stmt-pdf-local-${lineIdx}-${Date.now()}`,
            date: isoDate,
            description: desc,
            amount: Math.round(amount * 100) / 100,
            currency: isUsd ? 'USD' : 'PEN',
            type: isCredit ? 'credit' : 'debit',
            originalRowIndex: lineIdx
          });
        }

        if (fallbackList.length > 0) {
          parsedTransactions = fallbackList;
          methodUsed = 'local_fallback';
        }
      } catch (localErr) {
        console.error('[Gemini Parse PDF] Error en fallback local:', localErr);
      }
    }

    if (parsedTransactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se encontraron movimientos válidos en el PDF. Verifica que sea un estado de cuenta bancario con texto legible.'
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      source: methodUsed,
      modelUsed: modelNameUsed,
      count: parsedTransactions.length,
      transactions: parsedTransactions
    });
  } catch (error: any) {
    console.error('Error al procesar PDF de estado de cuenta:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno al procesar el archivo PDF' },
      { status: 500 }
    );
  }
}
