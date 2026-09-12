'use client';

import { useState } from 'react';
import { ReconciliationService } from '@/services/reconciliation.service';
import { AIIntelligenceService } from '@/services/aiIntelligence.service';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { calculatePaymentDueDate } from '@/lib/calculations';
import { generateUUID, deduplicateTransactions } from '@/lib/utils';
import {
  Transaction,
  PaymentMethod,
  Category,
  StatementTransaction,
  ReconciliationSummary,
  ReconciliationItem
} from '@/types';

interface UseReconciliationDeps {
  monthKey: string;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  currentMonthTransactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

/**
 * Conciliación bancaria: carga y parseo del estado de cuenta (real o demo),
 * el resumen resultante con su filtro, y la importación —individual o en bloque—
 * de los consumos que faltan en la app. Las importaciones crean transacciones
 * (nube + local), por eso el hook recibe setTransactions y el contexto del mes.
 */
export function useReconciliation({
  monthKey,
  categories,
  paymentMethods,
  currentMonthTransactions,
  setTransactions
}: UseReconciliationDeps) {
  const [isParsingStatement, setIsParsingStatement] = useState(false);
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
  const [reconciliationFilter, setReconciliationFilter] = useState<'all' | 'matched' | 'unmatched_app' | 'mismatch'>('all');
  const [statementFileName, setStatementFileName] = useState<string>('');

  // Carga y Parseo de Estado de Cuenta Real (.xlsx, .xls, .csv, .pdf)
  const handleStatementFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingStatement(true);
    setStatementFileName(file.name);
    try {
      const parsed = await ReconciliationService.parseFile(file);
      const summary = ReconciliationService.reconcile(parsed, currentMonthTransactions, categories);
      setReconciliationSummary(summary);
    } catch (err) {
      console.error('Error al procesar archivo bancario:', err);
      alert('No se pudo leer el archivo bancario. Asegúrate de que sea un archivo Excel (.xlsx, .xls) o CSV válido.');
    } finally {
      setIsParsingStatement(false);
    }
  };

  // Carga de Estado de Cuenta Demo (BCP / Interbank) para prueba inmediata
  const handleLoadDemoStatement = () => {
    setIsParsingStatement(true);
    setStatementFileName('Estado_Cuenta_BCP_Demostracion.xlsx');

    const demoStatement: StatementTransaction[] = [
      { id: 'stmt-demo-1', date: `${monthKey}-05`, description: 'SUPERMERCADOS WONG MIRAFLORES', amount: 142.50, type: 'debit' },
      { id: 'stmt-demo-2', date: `${monthKey}-08`, description: 'NETFLIX MENSUALIDAD', amount: 44.90, type: 'debit' },
      { id: 'stmt-demo-3', date: `${monthKey}-12`, description: 'UBER TRIP LIMA PE', amount: 24.50, type: 'debit' },
      { id: 'stmt-demo-4', date: `${monthKey}-14`, description: 'STARBUCKS JAVIER PRADO', amount: 19.00, type: 'debit' },
      { id: 'stmt-demo-5', date: `${monthKey}-18`, description: 'FARMACIAS INKAFARMA', amount: 38.00, type: 'debit' },
      { id: 'stmt-demo-6', date: `${monthKey}-22`, description: 'RAPPI PERU SAC', amount: 56.50, type: 'debit' }
    ];

    setTimeout(() => {
      const summary = ReconciliationService.reconcile(demoStatement, currentMonthTransactions, categories);
      setReconciliationSummary(summary);
      setIsParsingStatement(false);
    }, 400);
  };

  // Importar gasto faltante con 1 Clic desde el Estado de Cuenta
  const handleImportStatementItem = (item: ReconciliationItem) => {
    if (!item.statementTx) return;
    const st = item.statementTx;

    const predicted = AIIntelligenceService.predictCategory(st.description, categories);
    const catId = predicted?.categoryId || categories[11]?.id || categories[0]?.id;
    const debitMethod = paymentMethods.find(p => p.type === 'debit') || paymentMethods[0];
    const dueDate = calculatePaymentDueDate(st.date, debitMethod);

    const newTx: Transaction = {
      id: generateUUID(),
      date: st.date,
      description: st.description,
      categoryId: catId,
      paymentMethodId: debitMethod.id,
      currency: 'PEN',
      originalAmount: st.amount,
      exchangeRate: 1,
      amountPen: st.amount,
      paymentDueDate: dueDate,
      isFixedSubscription: predicted?.isFixedSuggestion || false,
      notes: 'Conciliado e importado automáticamente desde Estado de Cuenta bancario'
    };

    setTransactions(prev => deduplicateTransactions([newTx, ...prev]));
    SupabaseDataService.createTransaction(newTx);

    // Actualizar resumen de conciliación
    if (reconciliationSummary) {
      setReconciliationSummary(prev => {
        if (!prev) return null;
        const updatedItems = prev.items.map(it => {
          if (it.id === item.id) {
            return {
              ...it,
              status: 'matched' as const,
              appTx: newTx,
              confidence: 1.0,
              notes: 'Importado y conciliado exitosamente en FinTrack.'
            };
          }
          return it;
        });

        const newMatched = updatedItems.filter(i => i.status === 'matched').length;
        const newUnmatched = updatedItems.filter(i => i.status === 'unmatched_in_app').length;
        const total = prev.items.filter(i => i.statementTx).length || 1;

        return {
          ...prev,
          matchedCount: newMatched,
          unmatchedInAppCount: newUnmatched,
          matchPercentage: Math.round((newMatched / total) * 100),
          items: updatedItems
        };
      });
    }
  };

  // Importar todos los consumos faltantes en bloque con 1 Clic
  const handleImportAllUnmatched = () => {
    if (!reconciliationSummary) return;
    const unmatchedItems = reconciliationSummary.items.filter(
      it => it.status === 'unmatched_in_app' && it.statementTx
    );
    if (unmatchedItems.length === 0) return;

    const newTxs: Transaction[] = [];
    const debitMethod = paymentMethods.find(p => p.type === 'debit') || paymentMethods[0];

    unmatchedItems.forEach(item => {
      const st = item.statementTx!;
      const predicted = AIIntelligenceService.predictCategory(st.description, categories);
      const catId = predicted?.categoryId || categories[11]?.id || categories[0]?.id;
      const dueDate = calculatePaymentDueDate(st.date, debitMethod);

      const newTx: Transaction = {
        id: generateUUID(),
        date: st.date,
        description: st.description,
        categoryId: catId,
        paymentMethodId: debitMethod.id,
        currency: 'PEN',
        originalAmount: st.amount,
        exchangeRate: 1,
        amountPen: st.amount,
        paymentDueDate: dueDate,
        isFixedSubscription: predicted?.isFixedSuggestion || false,
        notes: 'Conciliado e importado automáticamente desde Estado de Cuenta bancario'
      };
      newTxs.push(newTx);
      SupabaseDataService.createTransaction(newTx);
    });

    setTransactions(prev => deduplicateTransactions([...newTxs, ...prev]));

    setReconciliationSummary(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.map(it => {
        const created = newTxs.find(tx => tx.description === it.statementTx?.description && tx.amountPen === it.statementTx?.amount);
        if (it.status === 'unmatched_in_app' && created) {
          return {
            ...it,
            status: 'matched' as const,
            appTx: created,
            confidence: 1.0,
            notes: 'Importado y conciliado exitosamente en FinTrack.'
          };
        }
        return it;
      });

      const newMatched = updatedItems.filter(i => i.status === 'matched').length;
      const newUnmatched = updatedItems.filter(i => i.status === 'unmatched_in_app').length;
      const total = prev.items.filter(i => i.statementTx).length || 1;

      return {
        ...prev,
        matchedCount: newMatched,
        unmatchedInAppCount: newUnmatched,
        matchPercentage: Math.round((newMatched / total) * 100),
        items: updatedItems
      };
    });
  };

  return {
    isParsingStatement,
    reconciliationSummary,
    setReconciliationSummary,
    reconciliationFilter,
    setReconciliationFilter,
    statementFileName,
    setStatementFileName,
    handleStatementFileUpload,
    handleLoadDemoStatement,
    handleImportStatementItem,
    handleImportAllUnmatched
  };
}
