'use client';

import { useState, useMemo, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { ExchangeRateService, ExchangeRateResult } from '@/services/exchangeRate.service';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR } from '@/lib/constants';
import { generateUUID } from '@/lib/utils';
import { getEffectiveDayOfMonth } from '@/lib/calculations';
import { Receivable, ReceivablePayment, CurrencyCode, DebtConfirmData, Transaction, PaymentMethod, Category } from '@/types';

interface UseReceivablesDeps {
  currentYear: number;
  currentMonth: number;
  setDebtConfirmData?: (data: DebtConfirmData | null) => void;
  onDisburseLoan?: (tx: Transaction) => void;
  paymentMethods?: PaymentMethod[];
  categories?: Category[];
}

/**
 * Cuentas por cobrar (dinero que presté): los préstamos agrupados por deudor,
 * el formulario de nuevo préstamo con su tipo de cambio SUNAT, y el cobro
 * —individual o en cascada sobre todos los préstamos de un deudor—. La carga
 * inicial desde Supabase vive en el efecto de montaje de la página, que reusa
 * setReceivables; el borrado se expone como deleteReceivable para el confirmador
 * de eliminación compartido.
 */
export function useReceivables({ currentYear, currentMonth, setDebtConfirmData, onDisburseLoan, paymentMethods, categories }: UseReceivablesDeps) {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false);
  // Id del préstamo en edición (null = alta nueva). Alterna el modal entre crear/editar.
  const [editingReceivableId, setEditingReceivableId] = useState<string | null>(null);

  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectingRec, setCollectingRec] = useState<Receivable | null>(null);
  const [collectingDebtorGroup, setCollectingDebtorGroup] = useState<{
    debtorName: string;
    totalRemaining: number;
    items: Receivable[];
  } | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState('');
  const [collectPaymentDate, setCollectPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [collectPaymentNotes, setCollectPaymentNotes] = useState('');
  const [expandedDebtors, setExpandedDebtors] = useState<Set<string>>(new Set());
  const [receivablesFilter, setReceivablesFilter] = useState<'pending' | 'all' | 'paid'>('pending');

  // Estado para Edición de Fecha/Detalles de un Cobro ya registrado
  const [isEditCollectModalOpen, setIsEditCollectModalOpen] = useState(false);
  const [editingCollectRecId, setEditingCollectRecId] = useState<string | null>(null);
  const [editingCollectPaymentId, setEditingCollectPaymentId] = useState<string | null>(null);
  const [editCollectPaymentDate, setEditCollectPaymentDate] = useState('');
  const [editCollectPaymentNotes, setEditCollectPaymentNotes] = useState('');
  const [editCollectAmount, setEditCollectAmount] = useState(0);
  const [editCollectDebtorName, setEditCollectDebtorName] = useState('');

  // Form Préstamo (Dinero que presté)
  const [debtorName, setDebtorName] = useState('');
  const [loanDesc, setLoanDesc] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanCurrency, setLoanCurrency] = useState<CurrencyCode>('PEN');
  const [loanExchangeRate, setLoanExchangeRate] = useState(FALLBACK_USD_PEN_RATE_STR);
  const [loanDate, setLoanDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const defaultDebitMethodId = useMemo(() => {
    const deb = (paymentMethods || []).find(p => p.type === 'debit');
    const cash = (paymentMethods || []).find(p => p.type === 'cash');
    return deb?.id || cash?.id || paymentMethods?.[0]?.id || 'pm-1';
  }, [paymentMethods]);

  const [loanIsDebitedFromAccount, setLoanIsDebitedFromAccount] = useState(true);
  const [loanPaymentMethodId, setLoanPaymentMethodId] = useState('');
  const [isFetchingLoanTc, setIsFetchingLoanTc] = useState(false);
  const [loanTcInfo, setLoanTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedLoanTc, setHasUserManuallyEditedLoanTc] = useState(false);

  useEffect(() => {
    if (defaultDebitMethodId && (!loanPaymentMethodId || loanPaymentMethodId === 'pm-1')) {
      setLoanPaymentMethodId(defaultDebitMethodId);
    }
  }, [defaultDebitMethodId, loanPaymentMethodId]);

  const debtorGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      debtorName: string;
      totalOriginal: number;
      totalPaid: number;
      totalRemaining: number;
      totalOriginalUsd: number;
      totalPaidUsd: number;
      totalRemainingUsd: number;
      hasUsd: boolean;
      isPureUsd: boolean;
      items: Receivable[];
      isFullyPaid: boolean;
      paidPercentage: number;
    }>();

    receivables.forEach(r => {
      const trimmed = r.debtorName?.trim() || 'Desconocido';
      const key = trimmed.toLowerCase();
      const existing = map.get(key) || {
        key,
        debtorName: trimmed,
        totalOriginal: 0,
        totalPaid: 0,
        totalRemaining: 0,
        totalOriginalUsd: 0,
        totalPaidUsd: 0,
        totalRemainingUsd: 0,
        hasUsd: false,
        isPureUsd: true,
        items: [],
        isFullyPaid: false,
        paidPercentage: 0
      };

      const isUsd = r.currency === 'USD';
      const exRate = r.exchangeRate || FALLBACK_USD_PEN_RATE;
      const origPen = isUsd ? (r.amountPen || r.originalAmount * exRate) : r.originalAmount;
      const paidPen = isUsd ? (r.paidAmount * exRate) : r.paidAmount;
      const remPen = isUsd ? (r.remainingAmount * exRate) : r.remainingAmount;

      existing.totalOriginal += origPen;
      existing.totalPaid += paidPen;
      existing.totalRemaining += remPen;

      if (isUsd) {
        existing.hasUsd = true;
        existing.totalOriginalUsd += r.originalAmount;
        existing.totalPaidUsd += r.paidAmount;
        existing.totalRemainingUsd += r.remainingAmount;
      } else {
        existing.isPureUsd = false;
      }

      existing.items.push(r);
      map.set(key, existing);
    });

    return Array.from(map.values()).map(g => {
      g.items.sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
      g.isFullyPaid = g.totalRemaining <= 0;
      g.paidPercentage = g.totalOriginal > 0 ? Math.min(100, Math.round((g.totalPaid / g.totalOriginal) * 100)) : 0;
      return g;
    })
    // Orden determinista de las fichas: el préstamo con actividad más reciente
    // primero (coincide con el prepend al crear) y desempate por nombre. Evita que
    // al refrescar cambie el orden respecto a lo recién agregado.
    .sort((a, b) => {
      const aLatest = a.items[a.items.length - 1];
      const bLatest = b.items[b.items.length - 1];
      const aDate = (aLatest?.createdAt || aLatest?.loanDate || '').slice(0, 10);
      const bDate = (bLatest?.createdAt || bLatest?.loanDate || '').slice(0, 10);
      return bDate.localeCompare(aDate) || a.debtorName.localeCompare(b.debtorName);
    });
  }, [receivables]);

  // Grupos de Deudores Filtrados por Estado (Pendientes / Todos / Saldados)
  const filteredDebtorGroups = useMemo(() => {
    return debtorGroups.filter(g => {
      if (receivablesFilter === 'pending') return !g.isFullyPaid;
      if (receivablesFilter === 'paid') return g.isFullyPaid;
      return true;
    });
  }, [debtorGroups, receivablesFilter]);

  const totalReceivablesRemaining = useMemo(() => {
    return receivables.reduce((acc, curr) => {
      const isUsd = curr.currency === 'USD';
      const exRate = curr.exchangeRate || FALLBACK_USD_PEN_RATE;
      const pen = isUsd ? (curr.amountPen ? (curr.remainingAmount / (curr.originalAmount || 1)) * curr.amountPen : curr.remainingAmount * exRate) : curr.remainingAmount;
      return acc + pen;
    }, 0);
  }, [receivables]);

  const totalReceivablesRemainingUsd = useMemo(() => {
    return receivables.filter(r => r.currency === 'USD').reduce((acc, curr) => acc + curr.remainingAmount, 0);
  }, [receivables]);

  // Consulta de Tipo de Cambio SUNAT para Préstamos (Dinero que presté)
  const fetchLoanSunatRate = async (dateForTc?: string, forceOverwrite = false) => {
    const targetDate = dateForTc || loanDate;
    setIsFetchingLoanTc(true);
    try {
      const info = await ExchangeRateService.getRateForDate(targetDate);
      setLoanTcInfo(info);
      if (forceOverwrite || !hasUserManuallyEditedLoanTc || !loanExchangeRate || loanExchangeRate === FALLBACK_USD_PEN_RATE_STR || loanExchangeRate === '1') {
        setLoanExchangeRate(info.rate.toFixed(4));
        if (forceOverwrite) setHasUserManuallyEditedLoanTc(false);
      }
    } catch (err) {
      console.warn('Error al obtener tipo de cambio SUNAT para préstamo:', err);
    } finally {
      setIsFetchingLoanTc(false);
    }
  };

  useEffect(() => {
    if (isReceivableModalOpen && loanCurrency === 'USD') {
      fetchLoanSunatRate(loanDate, !hasUserManuallyEditedLoanTc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReceivableModalOpen, loanCurrency, loanDate]);

  const handleOpenCollectModal = (rec: Receivable) => {
    setCollectingDebtorGroup(null);
    setCollectingRec(rec);
    setCollectAmountInput('');
    setCollectPaymentNotes('');
    const now = new Date();
    const isCurrentActiveMonth = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);
    const targetDay = isCurrentActiveMonth ? now.getDate() : 1;
    const safeDay = getEffectiveDayOfMonth(currentYear, currentMonth, targetDay).toString().padStart(2, '0');
    setCollectPaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${safeDay}`);
    setIsCollectModalOpen(true);
  };

  const handleOpenGroupCollectModal = (group: { debtorName: string; totalRemaining: number; items: Receivable[] }) => {
    setCollectingDebtorGroup(group);
    setCollectingRec(null);
    setCollectAmountInput('');
    setCollectPaymentNotes('');
    const now = new Date();
    const isCurrentActiveMonth = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);
    const targetDay = isCurrentActiveMonth ? now.getDate() : 1;
    const safeDay = getEffectiveDayOfMonth(currentYear, currentMonth, targetDay).toString().padStart(2, '0');
    setCollectPaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${safeDay}`);
    setIsCollectModalOpen(true);
  };

  const handleCascadeCollect = (debtorName: string, amountToCollect: number, collectDate?: string, collectNotes?: string) => {
    let remainingToApply = amountToCollect;
    const targetGroup = debtorGroups.find(g => g.debtorName.toLowerCase() === debtorName.toLowerCase());
    if (!targetGroup) return;

    // Préstamos con saldo pendiente (ordenados del más antiguo al más reciente)
    const itemsToPay = targetGroup.items.filter(i => i.remainingAmount > 0);
    const dateStr = collectDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;
    const updates = new Map<string, { newPaid: number; isDone: boolean; paymentRecord: ReceivablePayment }>();

    for (const item of itemsToPay) {
      if (remainingToApply <= 0) break;
      const pay = Math.min(item.remainingAmount, remainingToApply);
      const newPaid = item.paidAmount + pay;
      const newRem = Math.max(0, item.originalAmount - newPaid);
      const isDone = newRem <= 0;

      const nowIso = new Date().toISOString();
      const pRecord: ReceivablePayment = {
        id: `rpay-${Date.now()}-${item.id}`,
        receivableId: item.id,
        amountPaid: pay,
        amount: pay,
        paymentDate: dateStr,
        paymentMethodId: 'pm-1',
        notes: collectNotes || 'Abono en cascada a préstamo',
        createdAt: nowIso
      };

      updates.set(item.id, { newPaid, isDone, paymentRecord: pRecord });
      remainingToApply -= pay;
    }

    // Actualizar estado local
    setReceivables(prev =>
      prev.map(r => {
        if (updates.has(r.id)) {
          const upd = updates.get(r.id)!;
          return {
            ...r,
            paidAmount: upd.newPaid,
            remainingAmount: Math.max(0, r.originalAmount - upd.newPaid),
            status: upd.isDone ? 'paid' : 'partial',
            payments: [...(r.payments || []), upd.paymentRecord]
          };
        }
        return r;
      })
    );

    // Guardar en Supabase
    updates.forEach((upd, itemId) => {
      SupabaseDataService.recordReceivablePayment(itemId, upd.newPaid, upd.isDone, upd.paymentRecord);
    });
  };

  const handleCollectReceivable = (id: string, amountToCollect: number, collectDate?: string, collectNotes?: string) => {
    const targetRec = receivables.find(r => r.id === id);
    if (!targetRec) return;

    const dateStr = collectDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;
    const newPaid = targetRec.paidAmount + amountToCollect;
    const newRemaining = Math.max(0, targetRec.originalAmount - newPaid);
    const isDone = newRemaining === 0;

    const nowIso = new Date().toISOString();
    const pRecord: ReceivablePayment = {
      id: `rpay-${Date.now()}-${id}`,
      receivableId: id,
      amountPaid: amountToCollect,
      amount: amountToCollect,
      paymentDate: dateStr,
      paymentMethodId: 'pm-1',
      notes: collectNotes || undefined,
      createdAt: nowIso
    };

    setReceivables(prev =>
      prev.map(r => {
        if (r.id === id) {
          return {
            ...r,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: isDone ? 'paid' : 'partial',
            payments: [...(r.payments || []), pRecord]
          };
        }
        return r;
      })
    );

    // PUT a Supabase en la nube
    SupabaseDataService.recordReceivablePayment(id, newPaid, isDone, pRecord);
  };

  const executeSaveCollect = (num: number) => {
    if (collectingDebtorGroup) {
      handleCascadeCollect(collectingDebtorGroup.debtorName, num, collectPaymentDate, collectPaymentNotes.trim() || undefined);
      setIsCollectModalOpen(false);
      setCollectingDebtorGroup(null);
      setCollectAmountInput('');
      setCollectPaymentNotes('');
      return;
    }

    if (collectingRec) {
      handleCollectReceivable(collectingRec.id, num, collectPaymentDate, collectPaymentNotes.trim() || undefined);
      setIsCollectModalOpen(false);
      setCollectingRec(null);
      setCollectAmountInput('');
      setCollectPaymentNotes('');
    }
  };

  const handleSaveCollect = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(collectAmountInput);
    if (isNaN(num) || num <= 0) return;

    if (setDebtConfirmData) {
      const rawRem = collectingDebtorGroup ? collectingDebtorGroup.totalRemaining : (collectingRec?.remainingAmount || 0);
      const party = collectingDebtorGroup ? collectingDebtorGroup.debtorName : (collectingRec?.debtorName || 'Deudor');
      const desc = collectingDebtorGroup
        ? `Abono consolidado para ${collectingDebtorGroup.items.length} ${collectingDebtorGroup.items.length === 1 ? 'préstamo' : 'préstamos acumulados'}`
        : (collectingRec?.description || 'Cobranza de préstamo');
      const todayStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;

      setDebtConfirmData({
        type: 'receivable',
        title: collectingDebtorGroup ? 'Registrar Abono a Deudor' : 'Registrar Abono a Préstamo',
        partyName: party,
        description: desc,
        amount: num,
        currency: 'PEN',
        amountPen: num,
        date: collectPaymentDate || todayStr,
        notes: collectPaymentNotes.trim() || undefined,
        currentRemaining: rawRem,
        newRemaining: Math.max(0, rawRem - num),
        onConfirm: () => {
          executeSaveCollect(num);
          setDebtConfirmData(null);
        }
      });
      return;
    }

    executeSaveCollect(num);
  };

  const handleOpenAddLoanForDebtor = (name: string) => {
    setEditingReceivableId(null);
    setDebtorName(name);
    setLoanDesc('');
    setLoanAmount('');
    setLoanCurrency('PEN');
    setLoanExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setLoanTcInfo(null);
    setHasUserManuallyEditedLoanTc(false);
    const d = new Date();
    setLoanDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    setLoanIsDebitedFromAccount(true);
    setLoanPaymentMethodId(defaultDebitMethodId);
    setIsReceivableModalOpen(true);
  };

  // Abre el modal en modo edición, sembrando los campos con el préstamo elegido.
  const handleOpenEditReceivable = (rec: Receivable) => {
    setEditingReceivableId(rec.id);
    setDebtorName(rec.debtorName);
    setLoanDesc(rec.description && rec.description !== 'Préstamo' ? rec.description : '');
    setLoanAmount(rec.originalAmount.toString());
    setLoanCurrency(rec.currency || 'PEN');
    setLoanExchangeRate(rec.exchangeRate ? rec.exchangeRate.toString() : FALLBACK_USD_PEN_RATE_STR);
    setLoanTcInfo(null);
    setHasUserManuallyEditedLoanTc(true);
    setLoanDate(rec.loanDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`);
    setIsReceivableModalOpen(true);
  };

  const toggleDebtorExpanded = (key: string) => {
    setExpandedDebtors(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreateReceivable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorName || !loanAmount) return;

    const orig = parseFloat(loanAmount);
    if (isNaN(orig) || orig <= 0) return;
    const tc = loanCurrency === 'USD' ? (parseFloat(loanExchangeRate) || FALLBACK_USD_PEN_RATE) : 1;
    const amountPen = loanCurrency === 'USD' ? orig * tc : orig;

    // Modo edición: actualiza el préstamo conservando los abonos ya cobrados.
    if (editingReceivableId) {
      const existing = receivables.find(r => r.id === editingReceivableId);
      if (existing) {
        const paid = existing.paidAmount || 0;
        const rem = Math.max(0, orig - paid);
        const updated: Receivable = {
          ...existing,
          debtorName: debtorName.trim(),
          description: loanDesc.trim() || 'Préstamo',
          originalAmount: orig,
          remainingAmount: rem,
          currency: loanCurrency,
          exchangeRate: loanCurrency === 'USD' ? tc : undefined,
          amountPen,
          loanDate,
          status: rem <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending')
        };
        setReceivables(prev => prev.map(r => (r.id === editingReceivableId ? updated : r)));
        SupabaseDataService.updateReceivable(updated);
      }
      setIsReceivableModalOpen(false);
      setEditingReceivableId(null);
      setDebtorName('');
      setLoanDesc('');
      setLoanAmount('');
      setLoanCurrency('PEN');
      setLoanExchangeRate(FALLBACK_USD_PEN_RATE_STR);
      setLoanTcInfo(null);
      setHasUserManuallyEditedLoanTc(false);
      return;
    }

    const nowIso = new Date().toISOString();
    const newRec: Receivable = {
      id: generateUUID(),
      debtorName: debtorName.trim(),
      description: loanDesc.trim() || 'Préstamo',
      originalAmount: orig,
      paidAmount: 0,
      remainingAmount: orig,
      currency: loanCurrency,
      exchangeRate: loanCurrency === 'USD' ? tc : undefined,
      amountPen: amountPen,
      loanDate: loanDate,
      status: 'pending',
      isDebitedFromAccount: loanIsDebitedFromAccount,
      fundingPaymentMethodId: loanPaymentMethodId,
      createdAt: nowIso
    };

    setReceivables(prev => [newRec, ...prev]);
    // POST a Supabase en la nube
    SupabaseDataService.createReceivable(newRec);

    // Si el dinero prestado salió de la cuenta del usuario, se genera el movimiento de salida
    if (loanIsDebitedFromAccount && onDisburseLoan) {
      // Resolver categoría válida (priorizando 'Regalos y Terceros' u 'Otros')
      const matchedCat = (categories || []).find(c => {
        const n = c.name.toLowerCase();
        return n.includes('terceros') || n.includes('regalos') || n.includes('otros');
      }) || (categories && categories.length > 0 ? categories[0] : undefined);
      const finalCategoryId = matchedCat?.id || '345e217d-4c25-486f-aafd-7ee7c3e09590';

      // Resolver método de pago válido de débito
      const effectivePaymentMethodId = (loanPaymentMethodId && loanPaymentMethodId !== 'pm-1')
        ? loanPaymentMethodId
        : defaultDebitMethodId;

      const disburseTx: Transaction = {
        id: generateUUID(),
        date: loanDate,
        description: `Préstamo a ${debtorName.trim()}${loanDesc.trim() ? ` - ${loanDesc.trim()}` : ''}`,
        categoryId: finalCategoryId,
        paymentMethodId: effectivePaymentMethodId,
        currency: loanCurrency,
        originalAmount: orig,
        exchangeRate: loanCurrency === 'USD' ? tc : 1,
        amountPen: amountPen,
        paymentDueDate: loanDate,
        notes: `Desembolso de préstamo registrado en FinTrack (#${newRec.id}) [created:${nowIso}]`,
        createdAt: nowIso
      };
      onDisburseLoan(disburseTx);
    }

    setIsReceivableModalOpen(false);
    setDebtorName('');
    setLoanDesc('');
    setLoanAmount('');
    setLoanCurrency('PEN');
    setLoanExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setLoanTcInfo(null);
    setHasUserManuallyEditedLoanTc(false);
    setLoanIsDebitedFromAccount(true);
    setLoanPaymentMethodId(defaultDebitMethodId);
  };

  // Elimina una cuenta por cobrar (usado por el confirmador de borrado compartido)
  const deleteReceivable = (id: string) => {
    setReceivables(prev => prev.filter(r => r.id !== id));
    SupabaseDataService.deleteReceivable(id);
  };

  const handleOpenEditCollectPayment = (recId: string, payment: ReceivablePayment, debtorName?: string) => {
    setEditingCollectRecId(recId);
    setEditingCollectPaymentId(payment.id);
    setEditCollectPaymentDate(payment.paymentDate);
    setEditCollectPaymentNotes(payment.notes || '');
    setEditCollectAmount(payment.amount || payment.amountPaid);
    setEditCollectDebtorName(debtorName || 'Deudor');
    setIsEditCollectModalOpen(true);
  };

  const handleSaveEditCollectPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCollectRecId || !editingCollectPaymentId || !editCollectPaymentDate) return;

    setReceivables(prev => prev.map(r => {
      if (r.id === editingCollectRecId) {
        const updatedPayments = (r.payments && r.payments.length > 0)
          ? r.payments.map(p => (p.id === editingCollectPaymentId ? { ...p, paymentDate: editCollectPaymentDate, notes: editCollectPaymentNotes.trim() || undefined } : p))
          : [{
              id: editingCollectPaymentId,
              receivableId: r.id,
              amount: editCollectAmount,
              amountPaid: editCollectAmount,
              paymentDate: editCollectPaymentDate,
              notes: editCollectPaymentNotes.trim() || undefined
            }];

        return {
          ...r,
          payments: updatedPayments
        };
      }
      return r;
    }));

    SupabaseDataService.updateReceivablePayment(
      editingCollectRecId,
      editingCollectPaymentId,
      editCollectPaymentDate,
      editCollectPaymentNotes.trim() || undefined,
      editCollectAmount
    );

    setIsEditCollectModalOpen(false);
    setEditingCollectRecId(null);
    setEditingCollectPaymentId(null);
  };

  const handleDeleteCollectPayment = (recId: string, paymentId: string, amount: number) => {
    const targetRec = receivables.find(r => r.id === recId);
    if (!targetRec) return;

    const newPaid = Math.max(0, targetRec.paidAmount - amount);
    const newRem = Math.max(0, targetRec.originalAmount - newPaid);
    const newStatus = newRem <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');

    setReceivables(prev => prev.map(r => {
      if (r.id === recId) {
        return {
          ...r,
          paidAmount: newPaid,
          remainingAmount: newRem,
          status: newStatus,
          payments: (r.payments || []).filter(p => p.id !== paymentId)
        };
      }
      return r;
    }));

    SupabaseDataService.deleteReceivablePayment(recId, paymentId, newPaid);
  };

  return {
    receivables,
    setReceivables,
    isReceivableModalOpen,
    setIsReceivableModalOpen,
    editingReceivableId,
    setEditingReceivableId,
    handleOpenEditReceivable,
    isCollectModalOpen,
    setIsCollectModalOpen,
    collectingRec,
    collectingDebtorGroup,
    collectAmountInput,
    setCollectAmountInput,
    collectPaymentDate,
    setCollectPaymentDate,
    collectPaymentNotes,
    setCollectPaymentNotes,
    expandedDebtors,
    setExpandedDebtors,
    receivablesFilter,
    setReceivablesFilter,
    debtorName,
    setDebtorName,
    loanDesc,
    setLoanDesc,
    loanAmount,
    setLoanAmount,
    loanCurrency,
    setLoanCurrency,
    loanExchangeRate,
    setLoanExchangeRate,
    loanDate,
    setLoanDate,
    loanIsDebitedFromAccount,
    setLoanIsDebitedFromAccount,
    loanPaymentMethodId,
    setLoanPaymentMethodId,
    isFetchingLoanTc,
    loanTcInfo,
    setHasUserManuallyEditedLoanTc,
    fetchLoanSunatRate,
    debtorGroups,
    filteredDebtorGroups,
    totalReceivablesRemaining,
    totalReceivablesRemainingUsd,
    handleOpenCollectModal,
    handleOpenGroupCollectModal,
    handleCascadeCollect,
    handleCollectReceivable,
    handleSaveCollect,
    handleOpenAddLoanForDebtor,
    toggleDebtorExpanded,
    handleCreateReceivable,
    deleteReceivable,
    isEditCollectModalOpen,
    setIsEditCollectModalOpen,
    editingCollectRecId,
    editingCollectPaymentId,
    editCollectPaymentDate,
    setEditCollectPaymentDate,
    editCollectPaymentNotes,
    setEditCollectPaymentNotes,
    editCollectAmount,
    setEditCollectAmount,
    editCollectDebtorName,
    handleOpenEditCollectPayment,
    handleSaveEditCollectPayment,
    handleDeleteCollectPayment
  };
}
