'use client';

import { useState, useMemo, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { ExchangeRateService, ExchangeRateResult } from '@/services/exchangeRate.service';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR } from '@/lib/constants';
import { Payable, PayablePayment, CreditorGroup, OtherIncome, CurrencyCode } from '@/types';

interface UsePayablesDeps {
  currentYear: number;
  currentMonth: number;
  // Acredita a débito el ingreso generado cuando una deuda se marca "abonada a
  // cuenta débito"; lo provee el dominio de ingresos (useIncomes.creditLoanIncome).
  onCreditToDebit: (income: OtherIncome, date: string) => void;
}

/**
 * Mis deudas (dinero que me prestaron): los compromisos agrupados por acreedor,
 * el formulario de nueva deuda con su tipo de cambio SUNAT (y la opción de
 * acreditarla a cuenta débito como ingreso), y el pago —individual o en cascada
 * sobre todas las deudas de un acreedor—. La carga inicial desde Supabase vive en
 * el efecto de montaje de la página, que reusa setPayables.
 */
export function usePayables({ currentYear, currentMonth, onCreditToDebit }: UsePayablesDeps) {
  const [payables, setPayables] = useState<Payable[]>([]);

  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
  const [isPayablePaymentModalOpen, setIsPayablePaymentModalOpen] = useState(false);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [payableCreditorName, setPayableCreditorName] = useState('');
  const [payableDesc, setPayableDesc] = useState('');
  const [payableAmount, setPayableAmount] = useState('');
  const [payableDueDate, setPayableDueDate] = useState('');
  const [payableIsCreditedToDebit, setPayableIsCreditedToDebit] = useState(false);
  const [payablePaymentAmount, setPayablePaymentAmount] = useState('');
  const [payablePaymentDate, setPayablePaymentDate] = useState('');
  const [payablePaymentNotes, setPayablePaymentNotes] = useState('');
  const [payableCurrency, setPayableCurrency] = useState<CurrencyCode>('PEN');
  const [payableExchangeRate, setPayableExchangeRate] = useState(FALLBACK_USD_PEN_RATE_STR);
  const [payableIssueDate, setPayableIssueDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [isFetchingPayableTc, setIsFetchingPayableTc] = useState(false);
  const [payableTcInfo, setPayableTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedPayableTc, setHasUserManuallyEditedPayableTc] = useState(false);

  const [expandedCreditors, setExpandedCreditors] = useState<Set<string>>(new Set());
  const [payablesFilter, setPayablesFilter] = useState<'pending' | 'all' | 'paid'>('pending');
  const [payingCreditorGroup, setPayingCreditorGroup] = useState<CreditorGroup | null>(null);

  const creditorGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      creditorName: string;
      totalOriginal: number;
      totalPaid: number;
      totalRemaining: number;
      totalOriginalUsd: number;
      totalPaidUsd: number;
      totalRemainingUsd: number;
      hasUsd: boolean;
      isPureUsd: boolean;
      items: Payable[];
      isFullyPaid: boolean;
      paidPercentage: number;
    }>();

    payables.forEach(p => {
      const trimmed = p.creditorName?.trim() || 'Desconocido';
      const key = trimmed.toLowerCase();
      const existing = map.get(key) || {
        key,
        creditorName: trimmed,
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

      const isUsd = p.currency === 'USD';
      const orig = (isUsd && p.originalAmount) ? p.originalAmount : (p.originalAmount ?? p.totalAmount ?? 0);
      const paid = p.paidAmount ?? 0;
      const rem = (isUsd && p.remainingAmount > orig) ? Math.max(0, orig - paid) : (p.remainingAmount ?? orig);
      const exRate = p.exchangeRate || FALLBACK_USD_PEN_RATE;
      const origPen = isUsd ? (p.amountPen || orig * exRate) : orig;
      const paidPen = isUsd ? (paid * exRate) : paid;
      const remPen = isUsd ? (rem * exRate) : rem;

      existing.totalOriginal += origPen;
      existing.totalPaid += paidPen;
      existing.totalRemaining += remPen;

      if (isUsd) {
        existing.hasUsd = true;
        existing.totalOriginalUsd += orig;
        existing.totalPaidUsd += paid;
        existing.totalRemainingUsd += rem;
      } else {
        existing.isPureUsd = false;
      }

      existing.items.push(p);
      map.set(key, existing);
    });

    return Array.from(map.values()).map(g => {
      g.items.sort((a, b) => new Date(a.createdAt || a.issueDate || '').getTime() - new Date(b.createdAt || b.issueDate || '').getTime());
      g.isFullyPaid = g.totalRemaining <= 0;
      g.paidPercentage = g.totalOriginal > 0 ? Math.min(100, Math.round((g.totalPaid / g.totalOriginal) * 100)) : 0;
      return g;
    })
    // Orden determinista de las fichas: la deuda con actividad más reciente primero
    // (coincide con el prepend al crear) y desempate por nombre. Evita que al
    // refrescar cambie el orden respecto a lo recién agregado.
    .sort((a, b) => {
      const aLatest = a.items[a.items.length - 1];
      const bLatest = b.items[b.items.length - 1];
      const aDate = (aLatest?.createdAt || aLatest?.issueDate || '').slice(0, 10);
      const bDate = (bLatest?.createdAt || bLatest?.issueDate || '').slice(0, 10);
      return bDate.localeCompare(aDate) || a.creditorName.localeCompare(b.creditorName);
    });
  }, [payables]);

  // Grupos de Acreedores Filtrados por Estado (Pendientes / Todos / Saldados)
  const filteredCreditorGroups = useMemo(() => {
    return creditorGroups.filter(g => {
      if (payablesFilter === 'pending') return !g.isFullyPaid;
      if (payablesFilter === 'paid') return g.isFullyPaid;
      return true;
    });
  }, [creditorGroups, payablesFilter]);

  const totalPayablesRemaining = useMemo(() => {
    return payables.reduce((acc, curr) => {
      const isUsd = curr.currency === 'USD';
      const orig = (isUsd && curr.originalAmount) ? curr.originalAmount : (curr.originalAmount ?? curr.totalAmount ?? 0);
      const paid = curr.paidAmount ?? 0;
      const rem = (isUsd && curr.remainingAmount > orig) ? Math.max(0, orig - paid) : (curr.remainingAmount ?? orig);
      const exRate = curr.exchangeRate || FALLBACK_USD_PEN_RATE;
      const pen = isUsd ? (curr.amountPen ? (rem / (orig || 1)) * curr.amountPen : rem * exRate) : rem;
      return acc + pen;
    }, 0);
  }, [payables]);

  const totalPayablesRemainingUsd = useMemo(() => {
    return payables.filter(p => p.currency === 'USD').reduce((acc, curr) => {
      const orig = curr.originalAmount ?? curr.totalAmount ?? 0;
      const paid = curr.paidAmount ?? 0;
      const rem = curr.remainingAmount > orig ? Math.max(0, orig - paid) : (curr.remainingAmount ?? orig);
      return acc + rem;
    }, 0);
  }, [payables]);

  // Consulta de Tipo de Cambio SUNAT para Deudas (Dinero que me prestaron)
  const fetchPayableSunatRate = async (dateForTc?: string, forceOverwrite = false) => {
    const targetDate = dateForTc || payableIssueDate;
    setIsFetchingPayableTc(true);
    try {
      const info = await ExchangeRateService.getRateForDate(targetDate);
      setPayableTcInfo(info);
      if (forceOverwrite || !hasUserManuallyEditedPayableTc || !payableExchangeRate || payableExchangeRate === FALLBACK_USD_PEN_RATE_STR || payableExchangeRate === '1') {
        setPayableExchangeRate(info.rate.toFixed(4));
        if (forceOverwrite) setHasUserManuallyEditedPayableTc(false);
      }
    } catch (err) {
      console.warn('Error al obtener tipo de cambio SUNAT para deuda:', err);
    } finally {
      setIsFetchingPayableTc(false);
    }
  };

  useEffect(() => {
    if (isPayableModalOpen && payableCurrency === 'USD') {
      fetchPayableSunatRate(payableIssueDate, !hasUserManuallyEditedPayableTc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPayableModalOpen, payableCurrency, payableIssueDate]);

  const handleOpenCreatePayable = () => {
    setPayableCreditorName('');
    setPayableDesc('');
    setPayableAmount('');
    setPayableDueDate('');
    setPayableCurrency('PEN');
    setPayableExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setPayableTcInfo(null);
    setHasUserManuallyEditedPayableTc(false);
    const d = new Date();
    setPayableIssueDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    setPayableIsCreditedToDebit(false);
    setIsPayableModalOpen(true);
  };

  const handleCreatePayable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payableCreditorName || !payableAmount) return;
    const num = parseFloat(payableAmount);
    if (isNaN(num) || num <= 0) return;
    const tc = payableCurrency === 'USD' ? (parseFloat(payableExchangeRate) || FALLBACK_USD_PEN_RATE) : 1;
    const totalInPen = payableCurrency === 'USD' ? num * tc : num;

    const newPayable: Payable = {
      id: `pay-${Date.now()}`,
      creditorName: payableCreditorName.trim(),
      description: payableDesc.trim() || 'Préstamo personal',
      totalAmount: num,
      originalAmount: num,
      remainingAmount: num,
      paidAmount: 0,
      currency: payableCurrency,
      exchangeRate: payableCurrency === 'USD' ? tc : undefined,
      amountPen: totalInPen,
      issueDate: payableIssueDate,
      createdAt: payableIssueDate,
      dueDate: payableDueDate || undefined,
      isCreditedToDebit: payableIsCreditedToDebit,
      status: 'PENDING',
      payments: []
    };

    setPayables(prev => [newPayable, ...prev]);
    SupabaseDataService.createPayable(newPayable);

    // Si el usuario indicó abonar a cuenta débito:
    if (payableIsCreditedToDebit) {
      const loanIncomeId = `inc-loan-${Date.now()}`;
      const loanIncomeDesc = `Préstamo recibido: ${payableCreditorName.trim()} ${payableCurrency === 'USD' ? `• $ ${num.toFixed(2)} USD` : ''}`;
      const newIncome: OtherIncome = {
        id: loanIncomeId,
        description: loanIncomeDesc,
        amount: totalInPen,
        receivedDate: payableIssueDate
      };
      onCreditToDebit(newIncome, payableIssueDate);
    }

    setIsPayableModalOpen(false);
    setPayableCreditorName('');
    setPayableDesc('');
    setPayableAmount('');
    setPayableDueDate('');
    setPayableCurrency('PEN');
    setPayableExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setPayableTcInfo(null);
    setHasUserManuallyEditedPayableTc(false);
    setPayableIsCreditedToDebit(false);
  };

  const handleOpenAddLoanForCreditor = (name: string) => {
    setPayableCreditorName(name);
    setPayableDesc('');
    setPayableAmount('');
    setPayableDueDate('');
    setPayableCurrency('PEN');
    setPayableExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setPayableTcInfo(null);
    setHasUserManuallyEditedPayableTc(false);
    const d = new Date();
    setPayableIssueDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    setPayableIsCreditedToDebit(false);
    setIsPayableModalOpen(true);
  };

  const toggleCreditorExpanded = (key: string) => {
    setExpandedCreditors(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleOpenGroupPayModal = (group: CreditorGroup) => {
    setPayingCreditorGroup(group);
    setPayingPayable(null);
    setPayablePaymentAmount('');
    setPayablePaymentNotes('');
    const now = new Date();
    setPayablePaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`);
    setIsPayablePaymentModalOpen(true);
  };

  const handleCascadePay = (creditorName: string, amountToPay: number, payDate?: string, payNotes?: string) => {
    let remainingToApply = amountToPay;
    const targetGroup = creditorGroups.find(g => g.creditorName.toLowerCase() === creditorName.toLowerCase());
    if (!targetGroup) return;

    const itemsToPay = targetGroup.items.filter(i => (i.remainingAmount ?? (i.totalAmount ?? i.originalAmount)) > 0);
    const dateStr = payDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;
    const updates = new Map<string, { newPaid: number; newRem: number; isDone: boolean; paymentRecord: PayablePayment }>();

    for (const item of itemsToPay) {
      if (remainingToApply <= 0) break;
      const itemTotal = item.totalAmount ?? item.originalAmount ?? 0;
      const curRem = item.remainingAmount ?? itemTotal;
      const pay = Math.min(curRem, remainingToApply);
      const newPaid = (item.paidAmount ?? 0) + pay;
      const newRem = Math.max(0, itemTotal - newPaid);
      const isDone = newRem <= 0;

      const pRecord: PayablePayment = {
        id: `ppay-${Date.now()}-${item.id}`,
        payableId: item.id,
        amountPaid: pay,
        amount: pay,
        paymentDate: dateStr,
        paymentMethodId: 'pm-1',
        notes: payNotes || 'Abono en cascada a acreedor'
      };

      updates.set(item.id, { newPaid, newRem, isDone, paymentRecord: pRecord });
      remainingToApply -= pay;
    }

    setPayables(prev =>
      prev.map(p => {
        if (updates.has(p.id)) {
          const upd = updates.get(p.id)!;
          return {
            ...p,
            paidAmount: upd.newPaid,
            remainingAmount: upd.newRem,
            status: upd.isDone ? 'PAID' : 'PARTIALLY_PAID',
            payments: [...(p.payments || []), upd.paymentRecord]
          };
        }
        return p;
      })
    );

    updates.forEach((upd, payableId) => {
      SupabaseDataService.recordPayablePayment(payableId, upd.paymentRecord, upd.newPaid, upd.isDone);
    });
  };

  const handleOpenPayPayable = (payable: Payable) => {
    setPayingCreditorGroup(null);
    setPayingPayable(payable);
    setPayablePaymentAmount('');
    setPayablePaymentNotes('');
    const now = new Date();
    setPayablePaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`);
    setIsPayablePaymentModalOpen(true);
  };

  const handlePayPayable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payablePaymentAmount) return;
    const num = parseFloat(payablePaymentAmount);
    if (isNaN(num) || num <= 0) return;

    if (payingCreditorGroup) {
      handleCascadePay(payingCreditorGroup.creditorName, num, payablePaymentDate, payablePaymentNotes);
      setIsPayablePaymentModalOpen(false);
      setPayingCreditorGroup(null);
      setPayablePaymentAmount('');
      setPayablePaymentNotes('');
      return;
    }

    if (payingPayable) {
      const payRecord: PayablePayment = {
        id: `ppay-${Date.now()}`,
        payableId: payingPayable.id,
        amountPaid: num,
        amount: num,
        paymentDate: payablePaymentDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`,
        paymentMethodId: 'pm-1',
        notes: payablePaymentNotes || undefined
      };

      const payTotal = payingPayable.totalAmount ?? payingPayable.originalAmount ?? 0;
      const payNewPaid = payingPayable.paidAmount + num;
      const payIsDone = Math.max(0, payTotal - payNewPaid) === 0;

      setPayables(prev => prev.map(p => {
        if (p.id === payingPayable.id) {
          return {
            ...p,
            paidAmount: payNewPaid,
            remainingAmount: Math.max(0, payTotal - payNewPaid),
            status: payIsDone ? 'PAID' : 'PARTIALLY_PAID',
            payments: [...(p.payments || []), payRecord]
          };
        }
        return p;
      }));

      SupabaseDataService.recordPayablePayment(payingPayable.id, payRecord, payNewPaid, payIsDone);

      setIsPayablePaymentModalOpen(false);
      setPayingPayable(null);
      setPayablePaymentAmount('');
      setPayablePaymentNotes('');
    }
  };

  const handleDeletePayable = (payableId: string) => {
    setPayables(prev => prev.filter(p => p.id !== payableId));
    SupabaseDataService.deletePayable(payableId);
  };

  return {
    payables,
    setPayables,
    isPayableModalOpen,
    setIsPayableModalOpen,
    isPayablePaymentModalOpen,
    setIsPayablePaymentModalOpen,
    payingPayable,
    payableCreditorName,
    setPayableCreditorName,
    payableDesc,
    setPayableDesc,
    payableAmount,
    setPayableAmount,
    payableDueDate,
    setPayableDueDate,
    payableIsCreditedToDebit,
    setPayableIsCreditedToDebit,
    payablePaymentAmount,
    setPayablePaymentAmount,
    payablePaymentDate,
    setPayablePaymentDate,
    payablePaymentNotes,
    setPayablePaymentNotes,
    payableCurrency,
    setPayableCurrency,
    payableExchangeRate,
    setPayableExchangeRate,
    payableIssueDate,
    setPayableIssueDate,
    isFetchingPayableTc,
    payableTcInfo,
    setHasUserManuallyEditedPayableTc,
    fetchPayableSunatRate,
    expandedCreditors,
    payablesFilter,
    setPayablesFilter,
    payingCreditorGroup,
    creditorGroups,
    filteredCreditorGroups,
    totalPayablesRemaining,
    totalPayablesRemainingUsd,
    handleOpenCreatePayable,
    handleCreatePayable,
    handleOpenAddLoanForCreditor,
    toggleCreditorExpanded,
    handleOpenGroupPayModal,
    handleCascadePay,
    handleOpenPayPayable,
    handlePayPayable,
    handleDeletePayable
  };
}
