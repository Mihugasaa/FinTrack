/**
 * FINTRACK - EXCHANGE RATE SERVICE (TIPO DE CAMBIO OFICIAL PERÚ)
 * Consulta en tiempo real del tipo de cambio oficial SUNAT / SBS
 * a través de proxy seguro interno (sin problemas de CORS en navegador).
 */

export interface ExchangeRateResult {
  rate: number;         // Tipo de cambio venta referencial para compras
  buyRate: number;      // Tipo de cambio compra
  sellRate: number;     // Tipo de cambio venta
  date: string;         // Fecha de la cotización oficial
  source: string;       // 'SUNAT Oficial' | 'SUNAT (Última cotización hábil)' | 'Referencial SBS'
  isFallback?: boolean;
}

// Caché en memoria para evitar peticiones repetidas por la misma fecha
const rateCache = new Map<string, ExchangeRateResult>();

export class ExchangeRateService {
  private static readonly DIRECT_API_URL = 'https://api.apis.net.pe/v1/tipo-cambio-sunat';
  private static readonly DEFAULT_RATE = 3.37;

  /**
   * Obtiene el tipo de cambio oficial de la SUNAT/SBS para una fecha específica (YYYY-MM-DD)
   */
  public static async getRateForDate(dateStr?: string): Promise<ExchangeRateResult> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    // Verificar si ya está en caché
    if (rateCache.has(targetDate)) {
      return rateCache.get(targetDate)!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      // En el navegador, usar la API route interna del proyecto (/api/exchange-rate) para eludir bloqueos de CORS
      const endpoint = typeof window !== 'undefined'
        ? `/api/exchange-rate?fecha=${targetDate}`
        : `${this.DIRECT_API_URL}?fecha=${targetDate}`;

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && (data.venta || data.rate)) {
          const result: ExchangeRateResult = {
            rate: parseFloat(data.rate || data.venta),
            buyRate: parseFloat(data.buyRate || data.compra || data.rate),
            sellRate: parseFloat(data.sellRate || data.venta || data.rate),
            date: data.date || data.fecha || targetDate,
            source: data.source || 'SUNAT Oficial',
            isFallback: !!data.isFallback
          };
          rateCache.set(targetDate, result);
          return result;
        }
      }
    } catch (err) {
      console.warn('Fallo al obtener tipo de cambio desde el endpoint principal:', err);
    }

    // 3. Fallback de respaldo en caso de desconexión total
    const fallback: ExchangeRateResult = {
      rate: this.DEFAULT_RATE,
      buyRate: this.DEFAULT_RATE - 0.015,
      sellRate: this.DEFAULT_RATE,
      date: targetDate,
      source: 'SBS Referencial',
      isFallback: true
    };
    return fallback;
  }
}
