/**
 * FINTRACK - EXCEL EXPORT SERVICE
 * Genera libros de trabajo nativos en Excel (.xlsx) estructurados profesionalmente
 * con múltiples pestañas y formato de columnas.
 */

import * as XLSX from 'xlsx';
import {
  Transaction,
  Category,
  PaymentMethod,
  Receivable,
  CashflowForecastMonth
} from '@/types';
import { DebitBalanceResult } from '@/lib/calculations';

export interface ExcelExportData {
  year: number;
  month: number;
  monthName: string;
  transactions: Transaction[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  receivables: Receivable[];
  debitStats: DebitBalanceResult;
  initialDebitBalance?: number;
  diagnostic: {
    totalAvailable: number;
    realCashOutflow: number;
    liquidityMargin: number;
    isPositive: boolean;
    savingsRatePercentage: number;
    totalExpensesConsumed: number;
  };
  forecast?: CashflowForecastMonth[];
}

export class ExcelExportService {
  /**
   * Genera y descarga el archivo .xlsx profesional en el navegador del usuario
   */
  public static exportComprehensiveWorkbook(data: ExcelExportData): void {
    const wb = XLSX.utils.book_new();

    // 1. Hoja 1: Resumen Ejecutivo
    const summaryRows = [
      ['FINTRACK - SISTEMA INTELIGENTE DE CONTROL FINANCIERO Y GASTOS'],
      [`Reporte Consolidado: ${data.monthName} ${data.year}`],
      ['Fecha de Generación:', new Date().toLocaleString()],
      [],
      ['INDICADOR FINANCIERO', 'VALOR (S/)', 'ESTADO / NOTAS'],
      ['Saldo Inicial en Cuenta (Débito)', data.initialDebitBalance ?? 0, 'Dinero con el que arrancó el mes'],
      ['Saldo Actual en Cuenta Hoy (Débito)', data.debitStats.currentDebitBalanceToday, 'Dinero disponible al corte de hoy'],
      ['Sueldos Recibidos a la Fecha', data.debitStats.salariesReceivedToday, data.debitStats.isSalaryCreditedToday ? 'Abonado' : 'Pendiente de cobro'],
      ['Otros Ingresos Recibidos', data.debitStats.otherIncomesReceivedToday, 'Ingresos extraordinarios cobrados'],
      ['Cobros a Deudores Recibidos', data.debitStats.collectedFromDebtors, 'Cuentas por cobrar canceladas'],
      ['Gastos Débito Pagados a la Fecha', data.debitStats.debitExpensesPaidToday, 'Salidas de cuenta corriente a la fecha'],
      ['Salida Real de Caja del Mes', data.diagnostic.realCashOutflow, 'Gastos en Débito + Vencimientos de Tarjeta este mes'],
      ['Saldo Proyectado al Cierre de Mes', data.debitStats.projectedDebitBalanceMonthEnd, 'Fórmula P9 del modelo financiero'],
      ['Margen de Liquidez Neto', data.diagnostic.liquidityMargin, data.diagnostic.isPositive ? 'Superávit / Saldo Positivo' : 'Déficit / Ajustar Salidas'],
      ['Tasa de Ahorro del Mes', `${data.diagnostic.savingsRatePercentage.toFixed(1)}%`, 'Porcentaje sobre ingresos totales'],
      ['Consumo Total del Mes (Fecha Compra)', data.diagnostic.totalExpensesConsumed, 'Gastos ejecutados con fecha de este mes']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ejecutivo');

    // 2. Hoja 2: Gastos y Movimientos
    const catMap = new Map(data.categories.map(c => [c.id, c.name]));
    const pmMap = new Map(data.paymentMethods.map(p => [p.id, p.name]));

    const txRows = [
      ['Fecha', 'Concepto / Descripción', 'Categoría', 'Medio de Pago', 'Moneda', 'Monto Original', 'Tipo de Cambio', 'Monto (S/)', 'Fecha Límite Pago', 'Tipo']
    ];

    data.transactions.forEach(t => {
      txRows.push([
        t.date,
        t.description,
        catMap.get(t.categoryId) || 'Otro',
        pmMap.get(t.paymentMethodId) || 'Otro',
        t.currency,
        String(t.originalAmount),
        String(t.exchangeRate),
        String(t.amountPen),
        t.paymentDueDate,
        t.isFixedSubscription ? 'Fijo / Suscripción' : 'Variable'
      ]);
    });

    const wsTransactions = XLSX.utils.aoa_to_sheet(txRows);
    wsTransactions['!cols'] = [
      { wch: 12 }, { wch: 34 }, { wch: 22 }, { wch: 20 }, { wch: 8 },
      { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Movimientos');

    // 3. Hoja 3: Tarjetas de Crédito y Medios de Pago
    const cardRows = [
      ['Medio de Pago', 'Tipo', 'Día de Corte', 'Día de Pago', 'Límite de Crédito (S/)', 'Estado']
    ];

    data.paymentMethods.forEach(pm => {
      cardRows.push([
        pm.name,
        pm.type === 'credit' ? 'Tarjeta de Crédito' : pm.type === 'debit' ? 'Cuenta Débito' : 'Efectivo',
        String(pm.billingCloseDay || 'N/A'),
        String(pm.paymentDueDay || 'N/A'),
        String(pm.creditLimit || 'N/A'),
        pm.isActive ? 'Activo' : 'Inactivo'
      ]);
    });

    const wsCards = XLSX.utils.aoa_to_sheet(cardRows);
    wsCards['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsCards, 'Tarjetas y Cuentas');

    // 4. Hoja 4: Cuentas por Cobrar a Terceros
    const recRows = [
      ['Deudor', 'Concepto', 'Monto Prestado (S/)', 'Cobrado / Amortizado (S/)', 'Saldo Pendiente (S/)', 'Estado', 'Fecha']
    ];

    data.receivables.forEach(r => {
      recRows.push([
        r.debtorName,
        r.description,
        String(r.originalAmount),
        String(r.paidAmount),
        String(r.remainingAmount),
        r.status === 'paid' ? 'Cobrado Total' : r.status === 'partial' ? 'Cobro Parcial' : 'Pendiente',
        r.dueDate || r.createdAt
      ]);
    });

    const wsRec = XLSX.utils.aoa_to_sheet(recRows);
    wsRec['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsRec, 'Cuentas por Cobrar');

    // 5. Hoja 5: Proyección a Futuro (3-6 Meses)
    if (data.forecast && data.forecast.length > 0) {
      const forecastRows = [
        ['Mes Proyectado', 'Saldo Inicial (S/)', 'Ingresos Esperados (S/)', 'Fijos en Débito (S/)', 'Vencimiento Tarjetas (S/)', 'Variables Estimados (S/)', 'Salidas Totales (S/)', 'Saldo Final (S/)', 'Riesgo Déficit']
      ];

      data.forecast.forEach(f => {
        forecastRows.push([
          f.monthLabel,
          String(f.projectedInitialBalance),
          String(f.expectedIncome),
          String(f.fixedExpenses),
          String(f.projectedCardOutflows),
          String(f.projectedVariableExpenses),
          String(f.totalProjectedOutflow),
          String(f.projectedEndingBalance),
          f.isDeficitRisk ? 'ALERTA: DÉFICIT' : 'OK / HOLGADO'
        ]);
      });

      const wsForecast = XLSX.utils.aoa_to_sheet(forecastRows);
      wsForecast['!cols'] = [
        { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, wsForecast, 'Proyección 3-6 Meses');
    }

    // Disparar descarga en navegador
    const fileName = `FinTrack_${data.year}_${data.month.toString().padStart(2, '0')}_${data.monthName}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
