'use client';

import { useState, useMemo, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { AIIntelligenceService } from '@/services/aiIntelligence.service';
import { ExchangeRateService, ExchangeRateResult } from '@/services/exchangeRate.service';
import { UserProfile } from '@/services/auth.service';
import { generateUUID, deduplicateTransactions, resolvePaymentMethod } from '@/lib/utils';
import {
  calculatePaymentDueDate,
  calculatePaymentDueDateDetail,
  generateInstallmentTransactions,
  getDaysInMonth,
  getEffectiveDayOfMonth
} from '@/lib/calculations';
import { initialCategories } from '@/lib/defaults';
import { FALLBACK_USD_PEN_RATE_STR } from '@/lib/constants';
import { Transaction, PaymentMethod, Category, CurrencyCode } from '@/types';

interface AiSuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  isFixedSuggestion: boolean;
}

interface UseTransactionsDeps {
  monthKey: string;
  currentUser: UserProfile | null;
  currentYear: number;
  currentMonth: number;
  isCurrentActiveMonth: boolean;
  currentDateStr: string;
  paymentMethods: PaymentMethod[];
  categories: Category[];
  reloadNonce: number;
}

/**
 * Transacciones (gastos y reembolsos): el estado maestro deduplicado, la carga y
 * sincronización nube-local del mes activo, el formulario del modal de gasto con
 * todas sus variantes (cuotas, gasto fijo recurrente, reembolso), su tipo de
 * cambio SUNAT y los asistentes de IA (escaneo de comprobante y lenguaje natural).
 * El modal de confirmación de borrado sigue orquestado por la página, que llama a
 * deleteTransactionById; los filtros de la vista de movimientos también viven allí.
 */
export function useTransactions({
  monthKey,
  currentUser,
  currentYear,
  currentMonth,
  isCurrentActiveMonth,
  currentDateStr,
  paymentMethods,
  categories,
  reloadNonce
}: UseTransactionsDeps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Formulario del modal de gasto
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('PEN');
  const [exchangeRate, setExchangeRate] = useState(FALLBACK_USD_PEN_RATE_STR);
  const [isFetchingTc, setIsFetchingTc] = useState(false);
  const [tcInfo, setTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedTc, setHasUserManuallyEditedTc] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanReceiptError, setScanReceiptError] = useState<string | null>(null);
  const [isParsingNaturalExpense, setIsParsingNaturalExpense] = useState(false);
  const [naturalExpenseError, setNaturalExpenseError] = useState<string | null>(null);
  const [modalNaturalText, setModalNaturalText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategories[2].id);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [overrideDueDate, setOverrideDueDate] = useState('');
  const [txDate, setTxDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  // Estados de Cuotas y Reembolso en Nuevo Gasto
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState('3');
  const [hasInterest, setHasInterest] = useState(false);
  const [monthlyInstallmentAmount, setMonthlyInstallmentAmount] = useState('');

  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  // Carga y sincronización nube-local de las transacciones del mes activo
  // (deduplicación atómica, preservación de medio de pago y reembolsos)
  useEffect(() => {
    if (!currentUser) return;
    SupabaseDataService.getTransactions(monthKey).then(cloudTxs => {
      if (cloudTxs && cloudTxs.length > 0) {
        setTransactions(prev => {
          const enrichedCloud = cloudTxs.map(ct => {
            const localMatch = prev.find(lt => lt.id === ct.id || (
              lt.date === ct.date &&
              (lt.description || '').trim().toLowerCase() === (ct.description || '').trim().toLowerCase() &&
              Math.abs((lt.amountPen || 0) - (ct.amountPen || 0)) < 0.01
            ));

            let pmId = ct.paymentMethodId;
            if (!pmId && localMatch?.paymentMethodId) {
              pmId = localMatch.paymentMethodId;
            }
            if (!pmId && ct.notes) {
              const m = ct.notes.match(/\[pmId:([^\]]+)\]/);
              if (m && m[1]) pmId = m[1];
            }

            // Preservación blindada de Reembolsos / Abonos a favor (nube, notas y local)
            let isRefund = ct.isRefund;
            if (!isRefund) {
              if (localMatch?.isRefund) {
                isRefund = true;
              } else if (ct.notes && (ct.notes.includes('[isRefund:true]') || ct.notes.includes('[refund]'))) {
                isRefund = true;
              }
            }

            return { ...ct, paymentMethodId: pmId, isRefund: !!isRefund };
          });

          const cloudSigs = new Set(
            enrichedCloud.map(t => `${t.date}_${(t.description || '').trim().toLowerCase()}_${(t.amountPen || 0).toFixed(2)}_${t.paymentMethodId}`)
          );
          const cloudIds = new Set(enrichedCloud.map(t => t.id));
          const localOnly = prev.filter(t => !cloudIds.has(t.id) && !cloudSigs.has(`${t.date}_${(t.description || '').trim().toLowerCase()}_${(t.amountPen || 0).toFixed(2)}_${t.paymentMethodId}`));
          return deduplicateTransactions([...enrichedCloud, ...localOnly]);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, currentUser, reloadNonce]);

  // Asegurar que el medio de pago seleccionado corresponda a una tarjeta activa del usuario actual
  useEffect(() => {
    if (paymentMethods.length > 0 && (!selectedMethodId || !paymentMethods.some(p => p.id === selectedMethodId))) {
      setSelectedMethodId(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedMethodId]);

  const currentMonthTransactions = useMemo(() => {
    // Orden: fecha desc y, dentro del mismo día, el MÁS RECIENTE primero según el
    // timestamp de creación embebido en notes (`[created:ISO]`). Así un gasto recién
    // agregado aparece arriba de su día. Las filas legacy sin timestamp caen al
    // desempate estable por descripción/id, sin alterar su orden relativo.
    const createdAt = (t: Transaction) => (t.notes || '').match(/\[created:([^\]]+)\]/)?.[1] || '';
    return transactions
      .filter(t => t.date.startsWith(monthKey))
      .sort((a, b) =>
        b.date.localeCompare(a.date) ||
        createdAt(b).localeCompare(createdAt(a)) ||
        (a.description || '').localeCompare(b.description || '') ||
        (a.id || '').localeCompare(b.id || '')
      );
  }, [transactions, monthKey]);

  const modalDueDateDetail = useMemo(() => {
    const method = paymentMethods.find(p => p.id === selectedMethodId);
    return calculatePaymentDueDateDetail(txDate, method);
  }, [txDate, selectedMethodId, paymentMethods]);

  const modalCalculatedDueDate = modalDueDateDetail.dueDate;

  // Consulta de Tipo de Cambio Oficial SUNAT / BCRP para la fecha de pago
  const fetchSunatRate = async (dateForTc?: string, forceOverwrite = false) => {
    const targetDate = dateForTc || txDate;
    setIsFetchingTc(true);
    try {
      const info = await ExchangeRateService.getRateForDate(targetDate);
      setTcInfo(info);
      if (forceOverwrite || !hasUserManuallyEditedTc || !exchangeRate || exchangeRate === FALLBACK_USD_PEN_RATE_STR || exchangeRate === '1') {
        setExchangeRate(info.rate.toFixed(4));
        if (forceOverwrite) setHasUserManuallyEditedTc(false);
      }
    } catch (err) {
      console.warn('Error al obtener tipo de cambio SUNAT:', err);
    } finally {
      setIsFetchingTc(false);
    }
  };

  // Auto-consulta en tiempo real del tipo de cambio oficial cuando se selecciona USD o cambia la fecha
  useEffect(() => {
    if (isExpenseModalOpen && currency === 'USD') {
      fetchSunatRate(txDate, !hasUserManuallyEditedTc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpenseModalOpen, currency, txDate]);

  const handleOpenCreateTransaction = () => {
    setEditingTransactionId(null);
    setDesc('');
    setAmount('');
    setCurrency('PEN');
    setExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setTcInfo(null);
    setHasUserManuallyEditedTc(false);
    setSelectedCategoryId(categories[0]?.id || 'cat-1');
    setSelectedMethodId(paymentMethods[0]?.id || '');
    if (isCurrentActiveMonth) {
      const d = new Date();
      setTxDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    } else {
      setTxDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`);
    }
    setIsRecurring(false);
    setOverrideDueDate('');
    setIsRefundMode(false);
    setIsInstallment(false);
    setInstallmentsCount('3');
    setHasInterest(false);
    setMonthlyInstallmentAmount('');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditTransaction = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setDesc(tx.description);
    setAmount(tx.originalAmount.toString());
    setCurrency(tx.currency);
    setExchangeRate(tx.exchangeRate?.toString() || FALLBACK_USD_PEN_RATE_STR);
    setTcInfo(null);
    setHasUserManuallyEditedTc(true); // Tratar como valor customizado para no sobreescribir involuntariamente
    setSelectedCategoryId(tx.categoryId);
    const resolvedPm = resolvePaymentMethod(tx, paymentMethods);
    setSelectedMethodId(resolvedPm?.id || tx.paymentMethodId || paymentMethods[0]?.id || '');
    setTxDate(tx.date);
    setIsRecurring(!!tx.isFixedSubscription);
    setOverrideDueDate(tx.paymentDueDate || '');
    setIsRefundMode(!!tx.isRefund);
    setIsInstallment(!!tx.isInstallment);
    setInstallmentsCount(tx.totalInstallments ? tx.totalInstallments.toString() : '3');
    setHasInterest(!!tx.hasInterest);
    setMonthlyInstallmentAmount('');
    setIsExpenseModalOpen(true);
  };

  const handleScanReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);
    setScanReceiptError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: file.type || 'image/jpeg'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'No se pudo escanear el comprobante');
      }

      const data = await res.json();
      if (data.success && data.data) {
        const item = data.data;
        if (item.merchant) {
          setDesc(item.merchant);
        }
        if (typeof item.amount === 'number' && item.amount > 0) {
          setAmount(item.amount.toString());
        }
        if (item.currency === 'USD' || item.currency === 'PEN') {
          setCurrency(item.currency);
          if (item.currency === 'USD') {
            fetchSunatRate(item.date || txDate, true);
          }
        }
        if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
          setTxDate(item.date);
          if (item.currency === 'USD' || currency === 'USD') {
            fetchSunatRate(item.date, true);
          }
        }
        if (item.suggestedCategory) {
          const matched = categories.find(c =>
            c.name.toLowerCase().includes(item.suggestedCategory.toLowerCase()) ||
            item.suggestedCategory.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matched) {
            setSelectedCategoryId(matched.id);
            setAiSuggestion({
              categoryId: matched.id,
              categoryName: matched.name,
              confidence: 0.95,
              isFixedSuggestion: false
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('Error al escanear comprobante:', err);
      setScanReceiptError(err.message || 'Error al procesar el comprobante con Gemini IA');
    } finally {
      setIsScanningReceipt(false);
      e.target.value = '';
    }
  };

  const handleParseNaturalExpense = async (naturalText: string) => {
    if (!naturalText || !naturalText.trim()) return;
    setIsParsingNaturalExpense(true);
    setNaturalExpenseError(null);
    setIsExpenseModalOpen(true);

    // 1) Parser LOCAL instantáneo: cubre el caso común sin round-trip a la IA.
    const local = AIIntelligenceService.parseExpenseLocally(naturalText, currentDateStr, categories, paymentMethods);
    if (local && local.amount > 0 && local.confidence >= 0.6) {
      setEditingTransactionId(null);
      setDesc(local.description);
      setAmount(local.amount.toString());
      setCurrency(local.currency);
      if (local.currency === 'USD') fetchSunatRate(local.date, true);
      setTxDate(local.date);
      setIsRecurring(local.isFixed);
      setIsRefundMode(false);
      setIsInstallment(false);
      if (local.categoryId) setSelectedCategoryId(local.categoryId);
      if (local.paymentMethodId) setSelectedMethodId(local.paymentMethodId);
      setIsParsingNaturalExpense(false);
      setIsExpenseModalOpen(true);
      return;
    }

    // 2) Respaldo con IA solo si el parser local no logró un monto confiable.
    try {
      const res = await fetch('/api/ai/parse-natural-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: naturalText.trim(),
          currentDate: currentDateStr,
          availableCategories: categories.map(c => c.name),
          availablePaymentMethods: paymentMethods.map(pm => ({ id: pm.id, name: pm.name, type: pm.type }))
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo interpretar el gasto con IA');
      }

      const data = json.data;
      setEditingTransactionId(null);
      if (data.description) setDesc(data.description);
      if (data.amount !== undefined) setAmount(data.amount.toString());
      if (data.currency === 'USD' || data.currency === 'PEN') {
        setCurrency(data.currency);
        if (data.currency === 'USD') {
          fetchSunatRate(data.date || currentDateStr, true);
        }
      }
      if (data.date) setTxDate(data.date);
      setIsRecurring(Boolean(data.isFixed));
      setIsRefundMode(false);
      setIsInstallment(false);

      if (data.category) {
        const matchedCat = categories.find(c =>
          c.name.toLowerCase().includes(data.category.toLowerCase()) ||
          data.category.toLowerCase().includes(c.name.toLowerCase())
        );
        if (matchedCat) setSelectedCategoryId(matchedCat.id);
      }

      if (data.paymentMethodId) {
        const matchedMethod = paymentMethods.find(pm => pm.id === data.paymentMethodId);
        if (matchedMethod) setSelectedMethodId(matchedMethod.id);
      } else if (data.paymentMethodHint) {
        const matchedMethod = paymentMethods.find(pm =>
          pm.name.toLowerCase().includes(data.paymentMethodHint.toLowerCase()) ||
          data.paymentMethodHint.toLowerCase().includes(pm.name.toLowerCase())
        );
        if (matchedMethod) setSelectedMethodId(matchedMethod.id);
      }

      setIsExpenseModalOpen(true);
    } catch (err: any) {
      console.warn('Error al interpretar gasto con lenguaje natural:', err);
      setNaturalExpenseError(err.message || 'Error al procesar con IA');
    } finally {
      setIsParsingNaturalExpense(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !amount || isSubmittingExpense) return;

    setIsSubmittingExpense(true);

    try {
      const numAmount = parseFloat(amount);
      const numTc = currency === 'USD' ? parseFloat(exchangeRate || '1') : 1;
      const amountPen = currency === 'USD' ? numAmount * numTc : numAmount;

      const method = paymentMethods.find(p => p.id === selectedMethodId);
      const dueDate = overrideDueDate || calculatePaymentDueDate(txDate, method);

      if (editingTransactionId) {
        const currentTx = transactions.find(t => t.id === editingTransactionId);
        let finalNotes = currentTx?.notes || '';
        if (isRefundMode && !finalNotes.includes('[isRefund:true]')) {
          finalNotes = finalNotes ? `${finalNotes} [isRefund:true]` : '[isRefund:true]';
        } else if (!isRefundMode && finalNotes.includes('[isRefund:true]')) {
          finalNotes = finalNotes.replace(/\[isRefund:true\]/g, '').replace(/\[refund\]/g, '').trim();
        }

        const updatedTx: Transaction = {
          id: editingTransactionId,
          date: txDate,
          description: desc,
          categoryId: selectedCategoryId,
          paymentMethodId: selectedMethodId,
          currency,
          originalAmount: numAmount,
          exchangeRate: numTc,
          amountPen,
          paymentDueDate: dueDate,
          isFixedSubscription: isRecurring,
          isRefund: isRefundMode,
          notes: finalNotes || undefined
        };
        setTransactions(prev =>
          deduplicateTransactions(prev.map(t => (t.id === editingTransactionId ? updatedTx : t)))
        );
        // PUT a Supabase en la nube
        SupabaseDataService.updateTransaction(updatedTx);

        setIsExpenseModalOpen(false);
        setEditingTransactionId(null);
        setDesc('');
        setAmount('');
        setIsRecurring(false);
        setIsRefundMode(false);
        setIsInstallment(false);
        setOverrideDueDate('');
        return;
      }

      // Si es compra en cuotas con tarjeta de crédito
      if (isInstallment && method?.type === 'credit' && !isRefundMode) {
        const count = parseInt(installmentsCount, 10) || 3;
        const monthlyOverride = hasInterest && monthlyInstallmentAmount ? parseFloat(monthlyInstallmentAmount) : undefined;
        const generated = generateInstallmentTransactions(
          {
            description: desc,
            categoryId: selectedCategoryId,
            paymentMethodId: selectedMethodId,
            currency,
            date: txDate
          },
          count,
          numAmount,
          numTc,
          method,
          monthlyOverride
        );

        generated.forEach(inst => SupabaseDataService.createTransaction(inst));
        setTransactions(prev => deduplicateTransactions([...generated, ...prev]));
        setIsExpenseModalOpen(false);
        setDesc('');
        setAmount('');
        setIsRecurring(false);
        setIsInstallment(false);
        setIsRefundMode(false);
        setOverrideDueDate('');
        return;
      }

      // Timestamp de creación embebido para ordenar por recencia dentro del mismo día.
      const createdTag = `[created:${new Date().toISOString()}]`;
      const finalNotes = `${isRefundMode ? '[isRefund:true] ' : ''}${createdTag}`;
      const newTx: Transaction = {
        id: generateUUID(),
        date: txDate,
        description: desc,
        categoryId: selectedCategoryId,
        paymentMethodId: selectedMethodId,
        currency,
        originalAmount: numAmount,
        exchangeRate: numTc,
        amountPen,
        paymentDueDate: dueDate,
        isFixedSubscription: isRecurring,
        isRefund: isRefundMode,
        notes: finalNotes
      };

      const newTxs: Transaction[] = [newTx];

      // Si el usuario marcó 'Gasto fijo recurrente', replicar automáticamente en los siguientes 11 meses (ciclo anual completo)
      if (isRecurring) {
        const [y, m, d] = txDate.split('-').map(Number);
        // El día ancla es el día numérico exacto de registro (ej. 28 siempre se mantiene en 28).
        // Solo si el usuario registró en días 29, 30 o 31, actúa el ajuste en meses más cortos (ej. 31 -> 30 o 28).
        const targetDay = d;

        let curY = y;
        let curM = m;
        for (let i = 1; i <= 11; i++) {
          curM += 1;
          if (curM > 12) {
            curM = 1;
            curY += 1;
          }
          const nextDay = getEffectiveDayOfMonth(curY, curM, targetDay);
          const nextDateStr = `${curY}-${curM.toString().padStart(2, '0')}-${nextDay.toString().padStart(2, '0')}`;
          const nextDueDate = calculatePaymentDueDate(nextDateStr, method);
          const recTx: Transaction = {
            ...newTx,
            id: generateUUID(),
            date: nextDateStr,
            paymentDueDate: nextDueDate,
            isFixedSubscription: true
          };
          newTxs.push(recTx);
          // Replicar en Supabase para cada mes futuro
          SupabaseDataService.createTransaction(recTx);
        }
      }

      // POST de la transacción inicial a Supabase en la nube
      SupabaseDataService.createTransaction(newTx);

      // Actualizar estado local deduplicando atómicamente por ID y firma de negocio
      setTransactions(prev => deduplicateTransactions([...newTxs, ...prev]));

      setIsExpenseModalOpen(false);
      setDesc('');
      setAmount('');
      setIsRecurring(false);
      setOverrideDueDate('');
    } catch (err) {
      console.error('Error al registrar gasto:', err);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Elimina una transacción (local + nube). Lo usan el confirmador de borrado
  // compartido de la página y el borrado directo de movimientos sin ficha.
  const deleteTransactionById = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    SupabaseDataService.deleteTransaction(id);
  };

  // Elimina una transacción recurrente y todas sus repeticiones futuras a partir de su fecha (local + nube).
  const deleteTransactionAndFuture = (id: string): string[] => {
    const baseTx = transactions.find(t => t.id === id);
    if (!baseTx || !baseTx.isFixedSubscription) {
      deleteTransactionById(id);
      return [id];
    }

    const normDesc = baseTx.description.trim().toLowerCase();
    // Encontrar todas las transacciones vinculadas a esta suscripción desde esta fecha en adelante
    const matches = transactions.filter(t =>
      t.id === baseTx.id ||
      (
        t.isFixedSubscription &&
        t.description.trim().toLowerCase() === normDesc &&
        (t.categoryId === baseTx.categoryId || t.paymentMethodId === baseTx.paymentMethodId) &&
        t.date >= baseTx.date
      )
    );

    const idsToDelete = matches.map(t => t.id);
    const idSet = new Set(idsToDelete);

    setTransactions(prev => prev.filter(t => !idSet.has(t.id)));
    SupabaseDataService.deleteTransactions(idsToDelete);
    return idsToDelete;
  };

  return {
    transactions,
    setTransactions,
    editingTransactionId,
    setEditingTransactionId,
    isExpenseModalOpen,
    setIsExpenseModalOpen,
    desc,
    setDesc,
    amount,
    setAmount,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    isFetchingTc,
    tcInfo,
    hasUserManuallyEditedTc,
    setHasUserManuallyEditedTc,
    isSubmittingExpense,
    isScanningReceipt,
    scanReceiptError,
    isParsingNaturalExpense,
    naturalExpenseError,
    modalNaturalText,
    setModalNaturalText,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedMethodId,
    setSelectedMethodId,
    isRecurring,
    setIsRecurring,
    overrideDueDate,
    setOverrideDueDate,
    txDate,
    setTxDate,
    isRefundMode,
    setIsRefundMode,
    isInstallment,
    setIsInstallment,
    installmentsCount,
    setInstallmentsCount,
    hasInterest,
    setHasInterest,
    monthlyInstallmentAmount,
    setMonthlyInstallmentAmount,
    aiSuggestion,
    setAiSuggestion,
    currentMonthTransactions,
    modalDueDateDetail,
    modalCalculatedDueDate,
    fetchSunatRate,
    handleOpenCreateTransaction,
    handleOpenEditTransaction,
    handleScanReceiptFile,
    handleParseNaturalExpense,
    handleCreateTransaction,
    deleteTransactionById,
    deleteTransactionAndFuture
  };
}
