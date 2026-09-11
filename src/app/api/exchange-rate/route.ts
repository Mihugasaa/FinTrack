import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ExchangeRateResponse {
  rate: number;
  buyRate: number;
  sellRate: number;
  date: string;
  source: string;
  isFallback: boolean;
}

// 1. CACHÉ EN MEMORIA (Dura mientras el proceso esté activo)
const memoryCache = new Map<string, ExchangeRateResponse>();

// 2. CACHÉ PERSISTENTE EN DISCO
const CACHE_FILE = path.join(process.cwd(), 'scratch', 'exchange_rates_cache.json');

function loadPersistentCache(): Record<string, ExchangeRateResponse> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Exchange Rate Cache] No se pudo leer archivo de caché persistente:', err);
  }
  return {};
}

function saveToPersistentCache(date: string, data: ExchangeRateResponse) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = loadPersistentCache();
    current[date] = data;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(current, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Exchange Rate Cache] Error al escribir en caché persistente:', err);
  }
}

// Inicializar caché en memoria con los datos persistentes
try {
  const diskData = loadPersistentCache();
  Object.entries(diskData).forEach(([d, val]) => memoryCache.set(d, val));
} catch (e) {
  // ignore
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0];

  // 1. REVISAR CACHÉ (Respuesta instantánea < 2ms, sin riesgo de 429)
  if (memoryCache.has(fecha)) {
    const cached = memoryCache.get(fecha)!;
    return NextResponse.json(cached);
  }

  const diskCache = loadPersistentCache();
  if (diskCache[fecha]) {
    memoryCache.set(fecha, diskCache[fecha]);
    return NextResponse.json(diskCache[fecha]);
  }

  // 2. TIER 1: SUNAT OFICIAL (api.apis.net.pe con timeout controlado)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const sunatRes = await fetch(`https://api.apis.net.pe/v1/tipo-cambio-sunat?fecha=${fecha}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (sunatRes.ok) {
      const data = await sunatRes.json();
      if (data && data.venta && data.compra) {
        const rateObj: ExchangeRateResponse = {
          rate: parseFloat(Number(data.venta).toFixed(4)),
          buyRate: parseFloat(Number(data.compra).toFixed(4)),
          sellRate: parseFloat(Number(data.venta).toFixed(4)),
          date: data.fecha || fecha,
          source: 'SUNAT Oficial',
          isFallback: false
        };
        memoryCache.set(fecha, rateObj);
        saveToPersistentCache(fecha, rateObj);
        return NextResponse.json(rateObj);
      }
    }
  } catch (err: any) {
    console.warn(`[Exchange Rate] Tier 1 SUNAT no disponible para fecha ${fecha} (${err.message}), consultando Tier 2 BCRP...`);
  }

  // 3. TIER 2: BCRP (Banco Central de Reserva del Perú - Servicio Oficial Ilimitado)
  try {
    const bcrpController = new AbortController();
    const bcrpTimeout = setTimeout(() => bcrpController.abort(), 3500);

    const bcrpRes = await fetch('https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04637PD/json', {
      signal: bcrpController.signal,
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    clearTimeout(bcrpTimeout);

    if (bcrpRes.ok) {
      const rawText = await bcrpRes.text();
      // BCRP a veces añade pie de página xdebug; limpiamos cualquier HTML posterior al JSON
      const cleanJson = rawText.split(/<br\s*\/?>|<font/i)[0].trim();
      const bcrpData = JSON.parse(cleanJson);
      const periods = (bcrpData.periods || []).filter((p: any) => p.values && p.values[0] && p.values[0] !== 'n.d.');

      if (periods.length > 0) {
        const latestPeriod = periods[periods.length - 1];
        const val = parseFloat(latestPeriod.values[0]);
        if (!isNaN(val) && val > 2.0 && val < 5.0) {
          const rateObj: ExchangeRateResponse = {
            rate: parseFloat(val.toFixed(4)),
            buyRate: parseFloat((val - 0.008).toFixed(4)),
            sellRate: parseFloat(val.toFixed(4)),
            date: fecha,
            source: `BCRP Oficial (${latestPeriod.name})`,
            isFallback: false
          };
          memoryCache.set(fecha, rateObj);
          saveToPersistentCache(fecha, rateObj);
          return NextResponse.json(rateObj);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Exchange Rate] Tier 2 BCRP error: ${err.message}, consultando Tier 3 Open ER-API...`);
  }

  // 4. TIER 3: OPEN ER-API (Mercado Interbancario en Tiempo Real sin límite)
  try {
    const erController = new AbortController();
    const erTimeout = setTimeout(() => erController.abort(), 3000);

    const erRes = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: erController.signal,
      cache: 'no-store'
    });
    clearTimeout(erTimeout);

    if (erRes.ok) {
      const erData = await erRes.json();
      const penRate = erData?.rates?.PEN;
      if (typeof penRate === 'number' && penRate > 2.0) {
        const rateObj: ExchangeRateResponse = {
          rate: parseFloat(penRate.toFixed(4)),
          buyRate: parseFloat((penRate - 0.008).toFixed(4)),
          sellRate: parseFloat(penRate.toFixed(4)),
          date: fecha,
          source: 'Mercado Interbancario (ER-API)',
          isFallback: false
        };
        memoryCache.set(fecha, rateObj);
        saveToPersistentCache(fecha, rateObj);
        return NextResponse.json(rateObj);
      }
    }
  } catch (err: any) {
    console.warn(`[Exchange Rate] Tier 3 ER-API error: ${err.message}`);
  }

  // 5. RESPALDO DINÁMICO CON LA ÚLTIMA TASA REGISTRADA EN CACHÉ O REFERENCIAL RECIENTE
  const allCached = Object.values(loadPersistentCache());
  const recentValid = allCached.length > 0 ? allCached[allCached.length - 1].rate : 3.365;

  const fallbackObj: ExchangeRateResponse = {
    rate: recentValid,
    buyRate: parseFloat((recentValid - 0.008).toFixed(4)),
    sellRate: recentValid,
    date: fecha,
    source: 'SUNAT Referencial',
    isFallback: true
  };

  return NextResponse.json(fallbackObj);
}
