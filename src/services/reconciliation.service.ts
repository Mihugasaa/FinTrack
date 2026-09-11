/**
 * FINTRACK - RECONCILIATION SERVICE
 * Motor de conciliación inteligente de estados de cuenta bancarios y tarjetas de crédito
 * 1. Soporta carga de archivos Excel (.xlsx, .xls) y CSV.
 * 2. Autodetecta columnas de fecha, concepto y montos de cargos/abonos.
 * 3. Ejecuta comparación con tolerancia de desfase bancario (±3 días) y similitud semántica.
 * 4. Clasifica en: Conciliados, Faltantes en la App (con sugerencia de categoría IA) y Discrepancias.
 */

import * as XLSX from 'xlsx';
import {
  StatementTransaction,
  Transaction,
  Category,
  ReconciliationSummary,
  ReconciliationItem
} from '@/types';
import { AIIntelligenceService } from './aiIntelligence.service';

export class ReconciliationService {
  /**
   * Parsea un archivo de estado de cuenta (PDF bancario, Excel o CSV) a transacciones estandarizadas
   */
  public static async parseFile(file: File): Promise<StatementTransaction[]> {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      return await this.parsePdfFile(file);
    }

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
  public static parseCSVContent(csvText: string): StatementTransaction[] {
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
   * Realiza la conciliación cruzada entre el estado de cuenta y las transacciones de la app
   */
  public static reconcile(
    statementTxs: StatementTransaction[],
    appTxs: Transaction[],
    categories: Category[]
  ): ReconciliationSummary {
    const items: ReconciliationItem[] = [];
    const matchedAppIds = new Set<string>();
    const matchedStmtIds = new Set<string>();

    let totalStatementAmount = 0;
    let totalAppAmount = 0;
    let matchedCount = 0;
    let unmatchedInAppCount = 0;
    let mismatchCount = 0;

    // Solo comparamos débitos/cargos (consumos de dinero)
    const debitStatementTxs = statementTxs.filter(t => t.type === 'debit');

    debitStatementTxs.forEach(st => {
      totalStatementAmount += st.amount;
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

        // Diferencia de monto
        const amtDiff = Math.abs(stmt.amount - app.amountPen);

        // Similitud de texto inteligente (Substrings + Token Overlap sin stopwords bancarias)
        const sNorm = stmt.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const aNorm = app.description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        
        // 1. Coincidencia directa o inclusión de subcadena
        const textDirect = sNorm === aNorm || sNorm.includes(aNorm) || aNorm.includes(sNorm);

        // 2. Coincidencia por tokens (ej. "UBER TRIP LIMA PE" vs "Taxi a casa por Uber")
        const bankStopwords = new Set(['de', 'la', 'el', 'en', 'y', 'del', 'los', 'las', 'por', 'con', 'para', 'sac', 'sa', 's.a.', 's.a.c.', 'pe', 'peru', 'lima', 'oper', 'pos', 'compra', 'pago', 'tarjeta', 'visa', 'mastercard']);
        const sTokens = sNorm.split(/[\s\-_\/,\.]+/).filter(w => w.length > 2 && !bankStopwords.has(w));
        const aTokens = aNorm.split(/[\s\-_\/,\.]+/).filter(w => w.length > 2 && !bankStopwords.has(w));
        const hasCommonToken = sTokens.some(st => aTokens.some(at => at.includes(st) || st.includes(at)));

        const textMatch = textDirect || hasCommonToken;

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

        let matchNote = 'Conciliado con tolerancia de fecha bancaria.';
        if (highestScore === 100) {
          matchNote = 'Coincidencia exacta de fecha, comercio e importe.';
        } else if (highestScore >= 80 && Math.abs(stmt.amount - bestAppMatch.amountPen) <= 0.05) {
          matchNote = `Emparejado por monto exacto (${stmt.amount.toFixed(2)}) y fecha cercana (${bestAppMatch.description}).`;
        }

        items.push({
          id: `rec-match-${stmt.id}`,
          status: 'matched',
          statementTx: stmt,
          appTx: bestAppMatch,
          confidence: highestScore / 100,
          difference: Math.abs(stmt.amount - bestAppMatch.amountPen),
          notes: matchNote
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

        items.push({
          id: `rec-mismatch-${stmt.id}`,
          status: 'amount_mismatch',
          statementTx: stmt,
          appTx: discrepancyMatch,
          confidence: 0.75,
          difference: Math.abs(stmt.amount - discrepancyMatch.amountPen),
          notes: `Diferencia de S/ ${Math.abs(stmt.amount - discrepancyMatch.amountPen).toFixed(2)} entre el banco (S/ ${stmt.amount.toFixed(2)}) y la app (S/ ${discrepancyMatch.amountPen.toFixed(2)}).`
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
