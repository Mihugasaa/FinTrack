/**
 * FINTRACK - RECONCILIATION SERVICE
 * Motor de conciliación inteligente de estados de cuenta bancarios y tarjetas de crédito
 * 1. Soporta carga de archivos Excel (.xlsx, .xls) y CSV.
 * 2. Autodetecta columnas de fecha, concepto y montos de cargos/abonos.
 * 3. Ejecuta comparación con tolerancia de desfase bancario (±3 días) y similitud semántica.
 * 4. Clasifica en: Conciliados, Faltantes en la App (con sugerencia de categoría IA) y Discrepancias.
 */

import {
  StatementTransaction,
  Transaction,
  Category,
  ReconciliationSummary,
  ReconciliationItem
} from '@/types';
import { AIIntelligenceService } from './aiIntelligence.service';
import { FALLBACK_USD_PEN_RATE } from '@/lib/constants';

export class ReconciliationService {
  /**
   * Parsea un archivo de estado de cuenta (PDF bancario, Excel o CSV) a transacciones estandarizadas
   */
  public static async parseFile(file: File): Promise<StatementTransaction[]> {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      return await this.parsePdfFile(file);
    }

    // Carga diferida de SheetJS: solo se descarga cuando el usuario procesa un
    // Excel/CSV, no en el bundle inicial del dashboard.
    const XLSX = await import('xlsx');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convertir a matriz 2D de celdas
          const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (!rawRows || rawRows.length === 0) {
            resolve([]);
            return;
          }

          const parsed = this.extractTransactionsFromRows(rawRows);
          resolve(parsed);
        } catch (err) {
          console.error('Error al procesar archivo de estado de cuenta:', err);
          reject(err);
        }
      };

      reader.onerror = err => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parsea un archivo de estado de cuenta bancario en PDF usando el endpoint con Gemini AI y fallback local
   */
  public static async parsePdfFile(file: File): Promise<StatementTransaction[]> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/reconciliation/parse-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let errMsg = 'Error al procesar el estado de cuenta en PDF';
      try {
        const errorJson = await response.json();
        if (errorJson?.error) errMsg = errorJson.error;
      } catch (e) {
        // fallback
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.transactions)) {
      throw new Error(data.error || 'No se pudieron extraer movimientos válidos del archivo PDF');
    }

    return data.transactions;
  }

  /**
   * Parsea contenido de texto CSV directamente
   */
  public static async parseCSVContent(csvText: string): Promise<StatementTransaction[]> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(csvText, { type: 'string' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    return this.extractTransactionsFromRows(rawRows);
  }

  /**
   * Detecta cabeceras y extrae transacciones de filas genéricas
   */
  private static extractTransactionsFromRows(rows: any[][]): StatementTransaction[] {
    if (rows.length < 2) return [];

    // 1. Localizar la fila de cabecera más probable
    let headerRowIndex = 0;
    let colDate = -1;
    let colDesc = -1;
    let colAmount = -1;
    let colCargo = -1;
    let colAbono = -1;

    const dateKeywords = ['fecha', 'date', 'f. operacion', 'f. valor', 'dia', 'operacion'];
    const descKeywords = ['descripcion', 'concepto', 'detalle', 'establecimiento', 'comercio', 'description', 'movimiento', 'glosa'];
    const amountKeywords = ['monto', 'importe', 'monto pen', 'amount', 'soles', 'total'];
    const cargoKeywords = ['cargo', 'cargos', 'debe', 'egreso', 'salida', 'consumo'];
    const abonoKeywords = ['abono', 'abonos', 'haber', 'ingreso', 'deposito'];

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r].map(cell => String(cell || '').toLowerCase().trim());

      const dIdx = row.findIndex(c => dateKeywords.some(k => c === k || c.includes(k)));
      const descIdx = row.findIndex(c => descKeywords.some(k => c === k || c.includes(k)));
      const amtIdx = row.findIndex(c => amountKeywords.some(k => c === k || c.includes(k)));
      const cargoIdx = row.findIndex(c => cargoKeywords.some(k => c === k || c.includes(k)));
      const abonoIdx = row.findIndex(c => abonoKeywords.some(k => c === k || c.includes(k)));

      if (dIdx !== -1 && (descIdx !== -1 || amtIdx !== -1 || cargoIdx !== -1)) {
        headerRowIndex = r;
        colDate = dIdx;
        colDesc = descIdx;
        colAmount = amtIdx;
        colCargo = cargoIdx;
        colAbono = abonoIdx;
        break;
      }
    }

    // Fallbacks si no se detectaron cabeceras explícitas
    if (colDate === -1) colDate = 0;
    if (colDesc === -1) colDesc = 1;
    if (colAmount === -1 && colCargo === -1) colAmount = 2;

    const transactions: StatementTransaction[] = [];

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rawDate = row[colDate];
      const rawDesc = colDesc !== -1 ? String(row[colDesc] || '').trim() : '';

      if (!rawDate && !rawDesc) continue;

      const cleanDate = this.normalizeDate(rawDate);
      if (!cleanDate) continue;

      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';

      if (colCargo !== -1 && row[colCargo] !== undefined && row[colCargo] !== '') {
        const cVal = this.parseNumericAmount(row[colCargo]);
        if (cVal > 0) {
          amount = cVal;
          type = 'debit';
        }
      }

      if (colAbono !== -1 && row[colAbono] !== undefined && row[colAbono] !== '' && amount === 0) {
        const aVal = this.parseNumericAmount(row[colAbono]);
        if (aVal > 0) {
          amount = aVal;
          type = 'credit';
        }
      }

      if (amount === 0 && colAmount !== -1 && row[colAmount] !== undefined) {
        const amtVal = this.parseNumericAmount(row[colAmount]);
        amount = Math.abs(amtVal);
        type = amtVal < 0 ? 'debit' : 'credit';
      }

      if (amount <= 0 && !rawDesc) continue;

      transactions.push({
        id: `stmt-${r}-${Date.now()}`,
        date: cleanDate,
        description: rawDesc || 'Consumo no especificado',
        amount: Math.round(amount * 100) / 100,
        type,
        originalRowIndex: r + 1
      });
    }

    return transactions;
  }

  /**
   * Convierte formatos comunes de fechas bancarias a YYYY-MM-DD
   */
  private static normalizeDate(raw: any): string | null {
    if (!raw) return null;

    if (raw instanceof Date && !isNaN(raw.getTime())) {
      const y = raw.getFullYear();
      const m = (raw.getMonth() + 1).toString().padStart(2, '0');
      const d = raw.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    const str = String(raw).trim();

    // Formato DD/MM/YYYY o DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
      const d = dmy[1].padStart(2, '0');
      const m = dmy[2].padStart(2, '0');
      const y = dmy[3];
      return `${y}-${m}-${d}`;
    }

    // Formato YYYY-MM-DD
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      const y = ymd[1];
      const m = ymd[2].padStart(2, '0');
      const d = ymd[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return null;
  }

  /**
   * Limpia símbolos de moneda, comas y espacios para extraer el número
   */
  private static parseNumericAmount(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val)
      .replace(/[S\$\/\s,]/g, '')
      .replace(/'/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Diferencia de monto consciente de moneda. Si el extracto y el gasto están
   * en la misma moneda, compara en esa moneda sin tipo de cambio (US$ del banco
   * vs US$ original de la app). Si difieren, normaliza el extracto a soles con
   * el tipo de cambio de respaldo.
   */
  private static amountDiffPen(stmt: StatementTransaction, app: Transaction): number {
    const stmtCur = stmt.currency || 'PEN';
    const appCur = app.currency || 'PEN';
    if (stmtCur === appCur) {
      return Math.abs(stmt.amount - app.originalAmount);
    }
    const stmtPen = stmtCur === 'USD' ? stmt.amount * FALLBACK_USD_PEN_RATE : stmt.amount;
    return Math.abs(stmtPen - app.amountPen);
  }

  /** Formatea el importe del extracto con su símbolo de moneda (S/ o US$). */
  private static formatStmtAmount(stmt: StatementTransaction): string {
    const val = stmt.amount.toFixed(2);
    return (stmt.currency || 'PEN') === 'USD' ? `US$ ${val}` : `S/ ${val}`;
  }

  private static readonly BANK_STOPWORDS = new Set([
    'de', 'la', 'el', 'en', 'y', 'del', 'los', 'las', 'por', 'con', 'para',
    'sac', 'sa', 's.a.', 's.a.c.', 'pe', 'peru', 'lima', 'oper', 'pos',
    'compra', 'pago', 'tarjeta', 'visa', 'mastercard'
  ]);

  /**
   * Reconoce si el concepto del extracto y el de la app apuntan al mismo comercio,
   * por inclusión de subcadena o por tokens compartidos (sin stopwords bancarias).
   * Ej. "DLC*UBER RIDES LIMA PE" vs "Taxi a casa por Uber".
   */
  private static merchantMatches(stmtDesc: string, appDesc: string): boolean {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const sNorm = norm(stmtDesc);
    const aNorm = norm(appDesc);
    if (!sNorm || !aNorm) return false;

    const textDirect = sNorm === aNorm || sNorm.includes(aNorm) || aNorm.includes(sNorm);
    if (textDirect) return true;

    const tokenize = (s: string) =>
      s.split(/[\s\-_\/,\.*]+/).filter(w => w.length > 2 && !this.BANK_STOPWORDS.has(w));
    const sTokens = tokenize(sNorm);
    const aTokens = tokenize(aNorm);
    return sTokens.some(st => aTokens.some(at => at.includes(st) || st.includes(at)));
  }

  /**
   * Realiza la conciliación cruzada entre el estado de cuenta y las transacciones de la app
   */
  public static reconcile(
    statementTxs: StatementTransaction[],
    appTxsAll: Transaction[],
    categories: Category[]
  ): ReconciliationSummary {
    const items: ReconciliationItem[] = [];
    const matchedAppIds = new Set<string>();
    const matchedStmtIds = new Set<string>();

    let totalAppAmount = 0;
    let matchedCount = 0;
    let unmatchedInAppCount = 0;
    let mismatchCount = 0;

    // Solo comparamos débitos/cargos (consumos de dinero)
    const debitStatementTxs = statementTxs.filter(t => t.type === 'debit');

    // Ventana de conciliación = periodo real del estado de cuenta (ciclo de
    // facturación), no el mes calendario de la app. Un extracto que va del
    // 11/08 al 10/09 se coteja contra los gastos de la app de ese rango aunque
    // abarque dos meses, para que los consumos del mes anterior no aparezcan
    // como faltantes solo por estar en otro bucket mensual.
    const stmtTimes = statementTxs
      .map(t => new Date(t.date).getTime())
      .filter(n => !isNaN(n));
    const PAD_MS = 4 * 24 * 60 * 60 * 1000;
    const windowStart = stmtTimes.length ? Math.min(...stmtTimes) - PAD_MS : -Infinity;
    const windowEnd = stmtTimes.length ? Math.max(...stmtTimes) + PAD_MS : Infinity;
    const appTxs = appTxsAll.filter(a => {
      const t = new Date(a.date).getTime();
      return isNaN(t) ? false : t >= windowStart && t <= windowEnd;
    });

    appTxs.forEach(at => {
      totalAppAmount += at.amountPen;
    });

    // 1. Paso 1: Búsqueda de coincidencias exactas o de alta similitud
    for (const stmt of debitStatementTxs) {
      let bestAppMatch: Transaction | null = null;
      let highestScore = 0;

      for (const app of appTxs) {
        if (matchedAppIds.has(app.id)) continue;

        // Diferencia de días (tolerancia ±3 días bancarios)
        const stmtDate = new Date(stmt.date).getTime();
        const appDate = new Date(app.date).getTime();
        const dayDiff = Math.abs(stmtDate - appDate) / (1000 * 60 * 60 * 24);

        if (dayDiff > 4) continue;

        // Diferencia de monto (consciente de moneda: US$ del banco vs S/ de la app)
        const amtDiff = this.amountDiffPen(stmt, app);

        // Similitud de comercio (inclusi\u00f3n de subcadena o tokens compartidos)
        const textMatch = this.merchantMatches(stmt.description, app.description);
        
        let score = 0;
        // Prioridad 1: Monto (es la huella digital más precisa en finanzas)
        if (amtDiff <= 0.05) score += 60;
        else if (amtDiff <= 2.0) score += 30;

        // Prioridad 2: Proximidad de fecha (desfase bancario 1-3 días hábiles)
        if (dayDiff <= 1) score += 20;
        else if (dayDiff <= 3) score += 10;

        // Prioridad 3: Reconocimiento del comercio o palabra clave
        if (textMatch) score += 20;

        // Si el monto es idéntico y la fecha coincide en ventana bancaria (score >= 70), se empareja
        if (score > highestScore && score >= 70) {
          highestScore = score;
          bestAppMatch = app;
        }
      }

      if (bestAppMatch) {
        matchedAppIds.add(bestAppMatch.id);
        matchedStmtIds.add(stmt.id);
        matchedCount++;

        const matchDiff = this.amountDiffPen(stmt, bestAppMatch);
        let matchNote = 'Conciliado con tolerancia de fecha bancaria.';
        if (highestScore === 100) {
          matchNote = 'Coincidencia exacta de fecha, comercio e importe.';
        } else if (highestScore >= 80 && matchDiff <= 0.05) {
          matchNote = `Emparejado por monto exacto (${this.formatStmtAmount(stmt)}) y fecha cercana (${bestAppMatch.description}).`;
        }

        items.push({
          id: `rec-match-${stmt.id}`,
          status: 'matched',
          statementTx: stmt,
          appTx: bestAppMatch,
          confidence: highestScore / 100,
          difference: matchDiff,
          notes: matchNote
        });
      }
    }

    // 1.5. Rescate por importe EXACTO + comercio con desfase de fecha mayor a la
    // ventana bancaria. Cubre cuando el banco muestra la fecha de proceso y la app
    // la de consumo, o cuando la IA leyó mal el mes. Solo dentro del periodo del
    // extracto y exigiendo importe idéntico, para no generar falsos positivos.
    for (const stmt of debitStatementTxs) {
      if (matchedStmtIds.has(stmt.id)) continue;

      let rescueMatch: Transaction | null = null;
      for (const app of appTxs) {
        if (matchedAppIds.has(app.id)) continue;
        if (this.amountDiffPen(stmt, app) > 0.05) continue;
        if (!this.merchantMatches(stmt.description, app.description)) continue;
        rescueMatch = app;
        break;
      }

      if (rescueMatch) {
        matchedAppIds.add(rescueMatch.id);
        matchedStmtIds.add(stmt.id);
        matchedCount++;

        const dayGap = Math.round(
          Math.abs(new Date(stmt.date).getTime() - new Date(rescueMatch.date).getTime()) / (1000 * 60 * 60 * 24)
        );
        items.push({
          id: `rec-match-${stmt.id}`,
          status: 'matched',
          statementTx: stmt,
          appTx: rescueMatch,
          confidence: 0.8,
          difference: this.amountDiffPen(stmt, rescueMatch),
          notes: `Emparejado por importe exacto (${this.formatStmtAmount(stmt)}) y comercio; la fecha difiere ${dayGap} días (probable fecha de proceso vs consumo).`
        });
      }
    }

    // 2. Paso 2: Búsqueda de discrepancias de monto (mismo comercio y fecha, pero monto distinto)
    for (const stmt of debitStatementTxs) {
      if (matchedStmtIds.has(stmt.id)) continue;

      let discrepancyMatch: Transaction | null = null;

      for (const app of appTxs) {
        if (matchedAppIds.has(app.id)) continue;

        const dayDiff = Math.abs(new Date(stmt.date).getTime() - new Date(app.date).getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff <= 3) {
          const sNorm = stmt.description.toLowerCase();
          const aNorm = app.description.toLowerCase();
          if (sNorm.includes(aNorm) || aNorm.includes(sNorm)) {
            discrepancyMatch = app;
            break;
          }
        }
      }

      if (discrepancyMatch) {
        matchedAppIds.add(discrepancyMatch.id);
        matchedStmtIds.add(stmt.id);
        mismatchCount++;

        const diff = this.amountDiffPen(stmt, discrepancyMatch);
        items.push({
          id: `rec-mismatch-${stmt.id}`,
          status: 'amount_mismatch',
          statementTx: stmt,
          appTx: discrepancyMatch,
          confidence: 0.75,
          difference: diff,
          notes: `Diferencia entre el banco (${this.formatStmtAmount(stmt)}) y la app (S/ ${discrepancyMatch.amountPen.toFixed(2)}).`
        });
      }
    }

    // 3. Paso 3: Consumos en el Estado de Cuenta no registrados en la App (Para agregar a 1 clic con IA)
    for (const stmt of debitStatementTxs) {
      if (!matchedStmtIds.has(stmt.id)) {
        unmatchedInAppCount++;

        const aiPrediction = AIIntelligenceService.predictCategory(stmt.description, categories);

        items.push({
          id: `rec-unmatched-app-${stmt.id}`,
          status: 'unmatched_in_app',
          statementTx: stmt,
          confidence: aiPrediction?.confidence || 0.5,
          suggestedCategory: aiPrediction?.categoryName || 'Otros / Por Clasificar',
          notes: 'Figura en el estado de cuenta pero no está registrado en FinTrack. Puedes agregarlo con 1 clic.'
        });
      }
    }

    // 4. Paso 4: Gastos registrados en la App que no figuran en el Estado de Cuenta
    let unmatchedInBankCount = 0;
    for (const app of appTxs) {
      if (!matchedAppIds.has(app.id)) {
        unmatchedInBankCount++;
        items.push({
          id: `rec-unmatched-bank-${app.id}`,
          status: 'unmatched_in_bank',
          appTx: app,
          confidence: 0.9,
          notes: 'Registrado en FinTrack pero no figura en el estado de cuenta (posible cargo diferido para el siguiente mes o cancelado).'
        });
      }
    }

    // Total del extracto en soles: los cargos en dólares se convierten a PEN.
    // Si el cargo casó con un gasto de la app, se usa el tipo de cambio real de
    // ese gasto (así el par no genera una diferencia falsa); si no, el de respaldo.
    let totalStatementAmount = 0;
    for (const it of items) {
      const st = it.statementTx;
      if (!st || st.type !== 'debit') continue;
      if ((st.currency || 'PEN') === 'USD') {
        const rate = it.appTx && it.appTx.exchangeRate > 0 ? it.appTx.exchangeRate : FALLBACK_USD_PEN_RATE;
        totalStatementAmount += st.amount * rate;
      } else {
        totalStatementAmount += st.amount;
      }
    }

    const totalToAudit = debitStatementTxs.length || 1;
    const matchPercentage = Math.round((matchedCount / totalToAudit) * 100);
    const netDifference = Math.round((totalStatementAmount - totalAppAmount) * 100) / 100;

    return {
      totalStatementAmount: Math.round(totalStatementAmount * 100) / 100,
      totalAppAmount: Math.round(totalAppAmount * 100) / 100,
      matchedCount,
      unmatchedInAppCount,
      unmatchedInBankCount,
      mismatchCount,
      matchPercentage,
      netDifference,
      items
    };
  }
}
