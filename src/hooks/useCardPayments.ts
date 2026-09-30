'use client';

import { useState, useMemo, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { ExchangeRateService, ExchangeRateResult } from '@/services/exchangeRate.service';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR } from '@/lib/constants';
import { initialPaymentMethods } from '@/lib/defaults';
import { calculateItf } from '@/lib/calculations';
import { CardPayment, PaymentMethod, CurrencyCode } from '@/types';
import { generateUUID } from '@/lib/utils';

interface UseCardPaymentsDeps {
  paymentMethods: PaymentMethod[];
  currentYear: number;
  currentMonth: number;
}

/**
 * Abonos a tarjetas: el historial de pagos, el formulario/modal para registrar
 * o editar un abono (con su origen: cuenta débito, reembolso de comercio o abono
 * de banco, y moneda PEN/USD con tipo de cambio editable).
 */
export function useCardPayments({ paymentMethods, currentYear, currentMonth }: UseCardPaymentsDeps) {
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSourceType, setPaymentSourceType] = useState<'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT' | 'USD_SAVINGS_ACCOUNT'>('DEBIT_ACCOUNT');

  const [paymentCardId, setPaymentCardId] = useState(initialPaymentMethods[1].id);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>('PEN');
  const [paymentExchangeRate, setPaymentExchangeRate] = useState(FALLBACK_USD_PEN_RATE_STR);
  const [paymentTcInfo, setPaymentTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedPaymentTc, setHasUserManuallyEditedPaymentTc] = useState(false);
  const [isFetchingPaymentTc, setIsFetchingPaymentTc] = useState(false);

  // ITF bancario (0.005% con regla de redondeo oficial SBS/SUNAT a múltiplos de 5 céntimos)
  const [applyItf, setApplyItf] = useState(true);
  const [itfAmountInput, setItfAmountInput] = useState('');

  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [paymentTargetMonth, setPaymentTargetMonth] = useState<string>('');
  const [editingCardPaymentId, setEditingCardPaymentId] = useState<string | null>(null);
  const [editingCardPaymentIndex, setEditingCardPaymentIndex] = useState<number | null>(null);
  const [showAllHistoricalPayments, setShowAllHistoricalPayments] = useState(false);

  const currentMonthCardPayments = useMemo(() => {
    const targetYM = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    return cardPayments
      .filter(p => p.paymentDate.startsWith(targetYM))
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [cardPayments, currentYear, currentMonth]);

  // Consulta de Tipo de Cambio SUNAT para abonos en USD
  const fetchPaymentSunatRate = async (dateForTc?: string, forceOverwrite = false) => {
    const targetDate = dateForTc || paymentDate;
    setIsFetchingPaymentTc(true);
    try {
      const info = await ExchangeRateService.getRateForDate(targetDate);
      setPaymentTcInfo(info);
      if (forceOverwrite || !hasUserManuallyEditedPaymentTc || !paymentExchangeRate || paymentExchangeRate === FALLBACK_USD_PEN_RATE_STR || paymentExchangeRate === '1') {
        setPaymentExchangeRate(info.rate.toFixed(4));
        if (forceOverwrite) setHasUserManuallyEditedPaymentTc(false);
      }
    } catch (err) {
      console.warn('Error al obtener tipo de cambio SUNAT para abono a tarjeta:', err);
    } finally {
      setIsFetchingPaymentTc(false);
    }
  };

  useEffect(() => {
    if (isPaymentModalOpen && paymentCurrency === 'USD') {
      fetchPaymentSunatRate(paymentDate, !hasUserManuallyEditedPaymentTc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaymentModalOpen, paymentCurrency, paymentDate]);

  const handleOpenCreateCardPayment = (preselectedCardId?: string | React.MouseEvent, preselectedTargetMonth?: string) => {
    setEditingCardPaymentId(null);
    setEditingCardPaymentIndex(null);
    const creditCards = paymentMethods.filter(p => p.type === 'credit');
    if (typeof preselectedCardId === 'string' && preselectedCardId) {
      setPaymentCardId(preselectedCardId);
    } else if (creditCards.length > 0) {
      setPaymentCardId(creditCards[0].id);
    }
    setPaymentAmount('');
    setPaymentCurrency('PEN');
    setPaymentExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setPaymentTcInfo(null);
    setHasUserManuallyEditedPaymentTc(false);
    setPaymentSourceType('DEBIT_ACCOUNT');
    setPaymentTargetMonth(typeof preselectedTargetMonth === 'string' ? preselectedTargetMonth : '');
    setApplyItf(true);
    setItfAmountInput('');
    const now = new Date();
    const day = (currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1))
      ? now.getDate().toString().padStart(2, '0')
      : '20';
    setPaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day}`);
    setIsPaymentModalOpen(true);
  };

  const handleOpenEditCardPayment = (pay: CardPayment, _idx?: number) => {
    setEditingCardPaymentId(pay.id || null);
    setEditingCardPaymentIndex(null);
    setPaymentCardId(pay.paymentMethodId);
    const isUsd = pay.currency === 'USD';
    setPaymentCurrency(isUsd ? 'USD' : 'PEN');
    setPaymentAmount((isUsd && pay.originalAmount !== undefined ? pay.originalAmount : pay.amountPaid).toString());
    setPaymentExchangeRate(pay.exchangeRate ? pay.exchangeRate.toString() : FALLBACK_USD_PEN_RATE_STR);
    setHasUserManuallyEditedPaymentTc(true);
    setPaymentDate(pay.paymentDate);
    setPaymentTargetMonth(pay.targetMonth || '');
    setPaymentSourceType(pay.sourceType || 'DEBIT_ACCOUNT');
    if (pay.itfAmount !== undefined) {
      setApplyItf(pay.itfAmount > 0);
      setItfAmountInput(pay.itfAmount > 0 ? pay.itfAmount.toFixed(2) : '');
    } else {
      setApplyItf(true);
      setItfAmountInput('');
    }
    setIsPaymentModalOpen(true);
  };

  const handleMakeCardPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !paymentCardId) return;

    const num = parseFloat(paymentAmount);
    if (isNaN(num) || num <= 0) return;

    const targetDate = paymentDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-20`;
    const isUsd = paymentCurrency === 'USD';
    const rate = isUsd ? (parseFloat(paymentExchangeRate) || FALLBACK_USD_PEN_RATE) : 1;
    const amountPen = isUsd ? Math.round(num * rate * 100) / 100 : num;

    let effectiveItf = 0;
    if (paymentSourceType === 'DEBIT_ACCOUNT' && applyItf) {
      if (itfAmountInput.trim() !== '') {
        const parsedItf = parseFloat(itfAmountInput);
        effectiveItf = isNaN(parsedItf) ? 0 : Math.max(0, parsedItf);
      } else {
        effectiveItf = calculateItf(amountPen);
      }
    }

    if (editingCardPaymentId !== null) {
      // Modificar pago existente de forma precisa por ID único
      const existing = cardPayments.find(p => p.id === editingCardPaymentId);

      // Limpiar y actualizar tags de notas para que reflejen fielmente la edición
      let cleanNotes = (existing?.notes || '')
        .replace(/\[itf:[^\]]*\]/g, '')
        .replace(/\[target:[^\]]*\]/g, '')
        .trim();
      if (paymentTargetMonth) {
        cleanNotes = `${cleanNotes ? `${cleanNotes} ` : ''}[target:${paymentTargetMonth}]`;
      }
      if (effectiveItf > 0) {
        cleanNotes = `${cleanNotes ? `${cleanNotes} ` : ''}[itf:${effectiveItf.toFixed(2)}]`;
      }
      const updatedNotes = cleanNotes.trim() || undefined;

      const updatedPaymentObj: CardPayment = {
        ...(existing || {}),
        id: editingCardPaymentId,
        paymentMethodId: paymentCardId,
        amountPaid: amountPen,
        currency: paymentCurrency,
        originalAmount: num,
        exchangeRate: rate,
        amountPen,
        itfAmount: effectiveItf > 0 ? effectiveItf : 0,
        paymentDate: targetDate,
        sourceType: paymentSourceType,
        targetMonth: paymentTargetMonth || undefined,
        notes: updatedNotes
      };

      setCardPayments(prev => prev.map(p => (p.id === editingCardPaymentId ? updatedPaymentObj : p)));

      console.log('[useCardPayments] Calling SupabaseDataService.updateCardPayment with:', updatedPaymentObj);
      SupabaseDataService.updateCardPayment(updatedPaymentObj).then(res => {
        console.log('[useCardPayments] updateCardPayment finished with result:', res);
      });

      setIsPaymentModalOpen(false);
      setEditingCardPaymentId(null);
      setEditingCardPaymentIndex(null);
      setPaymentAmount('');
      setPaymentTargetMonth('');
      setApplyItf(true);
      setItfAmountInput('');
      return;
    }

    // Creación de nuevo abono con UUID nativo
    let newNotes = '';
    if (paymentTargetMonth) {
      newNotes = `[target:${paymentTargetMonth}]`;
    }
    if (effectiveItf > 0) {
      newNotes = `${newNotes ? `${newNotes} ` : ''}[itf:${effectiveItf.toFixed(2)}]`;
    }
    const finalNewNotes = newNotes.trim() || undefined;

    const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : generateUUID();
    const newPay: CardPayment = {
      id: generatedId,
      paymentMethodId: paymentCardId,
      amountPaid: amountPen,
      currency: paymentCurrency,
      originalAmount: num,
      exchangeRate: rate,
      amountPen,
      itfAmount: effectiveItf > 0 ? effectiveItf : 0,
      paymentDate: targetDate,
      sourceType: paymentSourceType,
      targetMonth: paymentTargetMonth || undefined,
      notes: finalNewNotes
    };

    setCardPayments(prev => [newPay, ...prev]);
    // POST a Supabase en la nube con su UUID persistente
    SupabaseDataService.createCardPayment(newPay);
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentTargetMonth('');
    setApplyItf(true);
    setItfAmountInput('');
  };

  // Cierra el modal de abono y limpia el estado de edición del formulario
  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setEditingCardPaymentId(null);
    setEditingCardPaymentIndex(null);
    setPaymentAmount('');
    setPaymentTargetMonth('');
    setApplyItf(true);
    setItfAmountInput('');
  };

  const handleDeleteCardPayment = (targetId?: string, _targetIndex?: number) => {
    if (!targetId) return;
    setCardPayments(prev => prev.filter(p => p.id !== targetId));
    SupabaseDataService.deleteCardPayment(targetId);
  };

  return {
    cardPayments,
    setCardPayments,
    currentMonthCardPayments,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    paymentSourceType,
    setPaymentSourceType,
    paymentCardId,
    setPaymentCardId,
    paymentAmount,
    setPaymentAmount,
    paymentCurrency,
    setPaymentCurrency,
    paymentExchangeRate,
    setPaymentExchangeRate,
    paymentTcInfo,
    hasUserManuallyEditedPaymentTc,
    setHasUserManuallyEditedPaymentTc,
    isFetchingPaymentTc,
    fetchPaymentSunatRate,
    paymentDate,
    setPaymentDate,
    paymentTargetMonth,
    setPaymentTargetMonth,
    editingCardPaymentId,
    editingCardPaymentIndex,
    showAllHistoricalPayments,
    setShowAllHistoricalPayments,
    handleOpenCreateCardPayment,
    handleOpenEditCardPayment,
    handleMakeCardPayment,
    handleClosePaymentModal,
    handleDeleteCardPayment,
    applyItf,
    setApplyItf,
    itfAmountInput,
    setItfAmountInput
  };
}
