import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite'
];

interface ReminderOption {
  tone: string;
  badge: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { debtorName, remainingAmount, currency, concept, loanDate } = body;

    if (!debtorName || !remainingAmount) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos obligatorios (nombre o monto)' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Key de Gemini no configurada' }, { status: 500 });
    }

    const currencySymbol = currency === 'USD' ? 'US$' : 'S/';
    const prompt = `Actúa como un experto en etiqueta social, comunicación empática y finanzas personales en Perú.
Genera 3 opciones de mensajes de WhatsApp breves, respetuosos y asertivos para recordarle cordialmente a un amigo, familiar o conocido el cobro de un dinero prestado.

Datos de la deuda:
- Nombre de la persona: ${debtorName}
- Monto pendiente: ${currencySymbol} ${remainingAmount}
- Concepto o motivo: ${concept || 'el préstamo realizado'}
- Fecha del préstamo: ${loanDate || 'días atrás'}

Genera exactamente un arreglo JSON con 3 opciones con este formato:
[
  {
    "tone": "Amable y Casual",
    "badge": "Ideal para amigos o familiares cercanos",
    "message": "Hola ${debtorName}, ¿cómo estás? Te escribía para consultar si coordinamos lo de ${currencySymbol} ${remainingAmount} de ${concept || 'la otra vez'}, me ayudaría bastante para organizar mis pagos de este mes. ¡Un abrazo!"
  },
  {
    "tone": "Claro y Concreto",
    "badge": "Tono neutral y educado",
    "message": "Hola ${debtorName}, buen día. Te dejo este mensajito para recordar el saldo pendiente de ${currencySymbol} ${remainingAmount} (${concept || 'préstamo'}). Avísame si te acomoda hacer una transferencia o Yape. ¡Gracias!"
  },
  {
    "tone": "Puntual con Plazo",
    "badge": "Para cerrar cuentas de forma directa",
    "message": "Hola ${debtorName}, ¿qué tal? Quería coordinar la devolución de los ${currencySymbol} ${remainingAmount} pendientes. ¿Crees que puedas programarlo para esta semana? Quedo atento a tus comentarios."
  }
]

Reglas:
- Devuelve únicamente el JSON válido, sin bloques de markdown ni texto extra.
- Mensajes naturales, educados, sin sonar agresivo ni amenazante.`;

    let options: ReminderOption[] | null = null;
    let modelUsed: string | undefined;

    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4
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
            if (Array.isArray(parsed) && parsed.length > 0) {
              options = parsed;
              modelUsed = model;
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`[Gemini Reminder] Error con modelo ${model}:`, err);
      }
    }

    // Fallback de plantillas si la IA estuviese inaccesible
    if (!options || options.length === 0) {
      options = [
        {
          tone: 'Amable y Casual',
          badge: 'Ideal para amigos o familiares cercanos',
          message: `Hola ${debtorName}, ¿cómo estás? Te escribía para consultar si coordinamos lo de ${currencySymbol} ${remainingAmount} de ${concept || 'la otra vez'}, me ayudaría bastante para organizar mis pagos de este mes. ¡Un abrazo!`
        },
        {
          tone: 'Claro y Concreto',
          badge: 'Tono neutral y educado',
          message: `Hola ${debtorName}, buen día. Te dejo este mensajito para recordar el saldo pendiente de ${currencySymbol} ${remainingAmount} (${concept || 'préstamo'}). Avísame si te acomoda hacer una transferencia o Yape. ¡Gracias!`
        },
        {
          tone: 'Puntual con Plazo',
          badge: 'Para cerrar cuentas de forma directa',
          message: `Hola ${debtorName}, ¿qué tal? Quería coordinar la devolución de los ${currencySymbol} ${remainingAmount} pendientes. ¿Crees que puedas programarlo para esta semana? Quedo atento a tus comentarios.`
        }
      ];
    }

    return NextResponse.json({
      success: true,
      modelUsed,
      options
    });
  } catch (error: any) {
    console.error('Error al generar recordatorio:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}
