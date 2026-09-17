'use client';

import { useState, useMemo, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { ExchangeRateService, ExchangeRateResult } from '@/services/exchangeRate.service';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR } from '@/lib/constants';
import { generateUUID } from '@/lib/utils';
import { getEffectiveDayOfMonth } from '@/lib/calculations';
import { Receivable, CurrencyCode, DebtConfirmData } from '@/types';

interface UseReceivablesDeps {
  currentYear: number;
  currentMonth: number;
  setDebtConfirmData?: (data: DebtConfirmData | null) => void;
}

/**
 * Cuentas por cobrar (dinero que presté): los préstamos agrupados por deudor,
 * el formulario de nuevo préstamo con su tipo de cambio SUNAT, y el cobro
 * —individual o en cascada sobre todos los préstamos de un deudor—. La carga
 * inicial desde Supabase vive en el efecto de montaje de la página, que reusa
 * setReceivables; el borrado se expone como deleteReceivable para el confirmador
 * de eliminación compartido.
 */
export function useReceivables({ currentYear, currentMonth, setDebtConfirmData }: UseReceivablesDeps) {
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
  const [isFetchingLoanTc, setIsFetchingLoanTc] = useState(false);
  const [loanTcInfo, setLoanTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedLoanTc, setHasUserManuallyEditedLoanTc] = useState(false);

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

  const handleCascadeCollect = (debtorName: string, amountToCollect: number) => {
    let remainingToApply = amountToCollect;
    const targetGroup = debtorGroups.find(g => g.debtorName.toLowerCase() === debtorName.toLowerCase());
    if (!targetGroup) return;

    // Préstamos con saldo pendiente (ordenados del más antiguo al más reciente)
    const itemsToPay = targetGroup.items.filter(i => i.remainingAmount > 0);
    const updates = new Map<string, { newPaid: number; isDone: boolean }>();

    for (const item of itemsToPay) {
      if (remainingToApply <= 0) break;
      const pay = Math.min(item.remainingAmount, remainingToApply);
      const newPaid = item.paidAmount + pay;
      const newRem = Math.max(0, item.originalAmount - newPaid);
      const isDone = newRem <= 0;

      updates.set(item.id, { newPaid, isDone });
      // Guardar en Supabase
      SupabaseDataService.recordReceivablePayment(item.id, newPaid, isDone);
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
            status: upd.isDone ? 'paid' : 'partial'
          };
        }
        return r;
      })
    );
  };

  const handleCollectReceivable = (id: string, amountToCollect: number) => {
    setReceivables(prev =>
      prev.map(r => {
        if (r.id === id) {
          const newPaid = r.paidAmount + amountToCollect;
          const newRemaining = Math.max(0, r.originalAmount - newPaid);
          const isDone = newRemaining === 0;
          // PUT a Supabase en la nube
          SupabaseDataService.recordReceivablePayment(id, newPaid, isDone);
          return {
            ...r,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: isDone ? 'paid' : 'partial'
          };
        }
        return r;
      })
    );
  };

  const executeSaveCollect = (num: number) => {
    if (collectingDebtorGroup) {
      handleCascadeCollect(collectingDebtorGroup.debtorName, num);
      setIsCollectModalOpen(false);
      setCollectingDebtorGroup(null);
      setCollectAmountInput('');
      setCollectPaymentNotes('');
      return;
    }

    if (collectingRec) {
      handleCollectReceivable(collectingRec.id, num);
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
      createdAt: loanDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
    };

    setReceivables(prev => [newRec, ...prev]);
    // POST a Supabase en la nube
    SupabaseDataService.createReceivable(newRec);
    setIsReceivableModalOpen(false);
    setDebtorName('');
    setLoanDesc('');
    setLoanAmount('');
    setLoanCurrency('PEN');
    setLoanExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setLoanTcInfo(null);
    setHasUserManuallyEditedLoanTc(false);
  };

  // Elimina una cuenta por cobrar (usado por el confirmador de borrado compartido)
  const deleteReceivable = (id: string) => {
    setReceivables(prev => prev.filter(r => r.id !== id));
    SupabaseDataService.deleteReceivable(id);
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
    deleteReceivable
  };
}
