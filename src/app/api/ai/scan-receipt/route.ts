import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite'
];

interface ExtractedReceiptData {
  description: string;
  amount: number;
  currency: 'PEN' | 'USD';
  date: string;
  suggestedCategory?: string;
  paymentMethodHint?: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se envió ningún comprobante' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ success: false, error: 'El archivo está vacío' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Key de Gemini no configurada' }, { status: 500 });
    }

    const mimeType = file.type || 'image/jpeg';
    const base64Data = buffer.toString('base64');

    const prompt = `Actúa como un asistente financiero experto en Perú.
Analiza este comprobante de pago, boleta electrónica, voucher de POS, captura de transferencia (Yape/Plin/Banca Móvil) o factura.

Extrae la información clave del gasto en un objeto JSON con el siguiente esquema exacto:
{
  "description": "Nombre limpio y reconocible del establecimiento o servicio (ej. 'Supermercados Metro', 'Starbucks', 'Farmacia Inkafarma', 'Rappi')",
  "amount": 45.80,
  "currency": "PEN",
  "date": "YYYY-MM-DD",
  "suggestedCategory": "Alimentación / Restaurantes | Compras / Shopping | Salud / Medicina | Transporte / Taxi | Servicios / Hogar | Entretenimiento | Educación | Otros",
  "paymentMethodHint": "TC | Débito | Yape | Plin | Efectivo"
}

Reglas:
1. "description": Limpia palabras como "RUC", "TICKET", "BOLETA DE VENTA", números de operación largos. Deja solo la marca comercial.
2. "amount": Número flotante positivo del importe TOTAL pagado.
3. "currency": "PEN" si es Soles (S/ o PEN) o "USD" si es Dólares ($ o USD).
4. "date": Fecha de la transacción en formato ISO YYYY-MM-DD. Si no se ve el año, asume el año actual.
5. "suggestedCategory": La categoría más apropiada según el tipo de comercio.
6. Si alguna información no es legible, coloca una estimación razonable.`;

    let extractedData: ExtractedReceiptData | null = null;
    let modelUsed: string | undefined;

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType.includes('pdf') ? 'application/pdf' : mimeType,
                    data: base64Data
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

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed && (parsed.amount || parsed.description)) {
              extractedData = {
                description: (parsed.description || 'Gasto registrado por escáner').trim(),
                amount: Math.abs(parseFloat(String(parsed.amount).replace(/[^0-9.]/g, '')) || 0),
                currency: parsed.currency === 'USD' ? 'USD' : 'PEN',
                date: parsed.date || new Date().toISOString().split('T')[0],
                suggestedCategory: parsed.suggestedCategory || 'Otros / Por Clasificar',
                paymentMethodHint: parsed.paymentMethodHint
              };
              modelUsed = model;
              break;
            }
          }
        } else {
          console.warn(`[Gemini Scan Receipt] Modelo ${model} devolvió ${res.status}, intentando siguiente...`);
        }
      } catch (err) {
        console.warn(`[Gemini Scan Receipt] Error en modelo ${model}:`, err);
      }
    }

    if (!extractedData) {
      return NextResponse.json(
        { success: false, error: 'No se pudo extraer la información del comprobante. Intenta con una imagen más nítida o ingresa los datos manualmente.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      modelUsed,
      data: extractedData
    });
  } catch (error: any) {
    console.error('Error al escanear comprobante:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}
