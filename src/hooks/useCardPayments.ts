'use client';

import { useState, useMemo } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { initialPaymentMethods } from '@/lib/defaults';
import { CardPayment, PaymentMethod } from '@/types';

interface UseCardPaymentsDeps {
  paymentMethods: PaymentMethod[];
  currentYear: number;
  currentMonth: number;
}

/**
 * Abonos a tarjetas: el historial de pagos, el formulario/modal para registrar
 * o editar un abono (con su origen: cuenta débito, reembolso de comercio o abono
 * de banco) y el listado del mes activo. La carga inicial desde Supabase sigue
 * en el efecto de sincronización mensual de la página, que reusa setCardPayments.
 */
export function useCardPayments({ paymentMethods, currentYear, currentMonth }: UseCardPaymentsDeps) {
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSourceType, setPaymentSourceType] = useState<'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT'>('DEBIT_ACCOUNT');

  const [paymentCardId, setPaymentCardId] = useState(initialPaymentMethods[1].id);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [editingCardPaymentId, setEditingCardPaymentId] = useState<string | null>(null);
  const [editingCardPaymentIndex, setEditingCardPaymentIndex] = useState<number | null>(null);
  const [showAllHistoricalPayments, setShowAllHistoricalPayments] = useState(false);

  const currentMonthCardPayments = useMemo(() => {
    const targetYM = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    return cardPayments
      .filter(p => p.paymentDate.startsWith(targetYM))
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [cardPayments, currentYear, currentMonth]);

  const handleOpenCreateCardPayment = () => {
    setEditingCardPaymentId(null);
    setEditingCardPaymentIndex(null);
    const creditCards = paymentMethods.filter(p => p.type === 'credit');
    if (creditCards.length > 0) {
      setPaymentCardId(creditCards[0].id);
    }
    setPaymentAmount('');
    setPaymentSourceType('DEBIT_ACCOUNT');
    const now = new Date();
    const day = (currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1))
      ? now.getDate().toString().padStart(2, '0')
      : '20';
    setPaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day}`);
    setIsPaymentModalOpen(true);
  };

  const handleOpenEditCardPayment = (pay: CardPayment, idx: number) => {
    setEditingCardPaymentId(pay.id || `cp-${idx}`);
    setEditingCardPaymentIndex(idx);
    setPaymentCardId(pay.paymentMethodId);
    setPaymentAmount(pay.amountPaid.toString());
    setPaymentDate(pay.paymentDate);
    setPaymentSourceType(pay.sourceType || 'DEBIT_ACCOUNT');
    setIsPaymentModalOpen(true);
  };

  const handleMakeCardPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !paymentCardId) return;

    const num = parseFloat(paymentAmount);
    if (isNaN(num) || num <= 0) return;

    const targetDate = paymentDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-20`;

    if (editingCardPaymentIndex !== null || editingCardPaymentId !== null) {
      // Modificar pago existente
      setCardPayments(prev => prev.map((p, idx) => {
        const matches = (editingCardPaymentId && p.id === editingCardPaymentId) ||
          (editingCardPaymentIndex !== null && idx === editingCardPaymentIndex);
        if (matches) {
          return {
            ...p,
            paymentMethodId: paymentCardId,
            amountPaid: num,
            paymentDate: targetDate,
            sourceType: paymentSourceType
          };
        }
        return p;
      }));
      setIsPaymentModalOpen(false);
      setEditingCardPaymentId(null);
      setEditingCardPaymentIndex(null);
      setPaymentAmount('');
      return;
    }

    const newPay: CardPayment = {
      id: `cp-${Date.now()}`,
      paymentMethodId: paymentCardId,
      amountPaid: num,
      paymentDate: targetDate,
      sourceType: paymentSourceType
    };

    setCardPayments(prev => [newPay, ...prev]);
    // POST a Supabase en la nube
    SupabaseDataService.createCardPayment(newPay);
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
  };

  // Cierra el modal de abono y limpia el estado de edición del formulario
  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setEditingCardPaymentId(null);
    setEditingCardPaymentIndex(null);
    setPaymentAmount('');
  };

  const handleDeleteCardPayment = (targetId?: string, targetIndex?: number) => {
    setCardPayments(prev => prev.filter((p, idx) => {
      if (targetId && p.id && p.id === targetId) return false;
      if (targetId && !p.id && `cp-${idx}` === targetId) return false;
      if (!targetId && targetIndex !== undefined && idx === targetIndex) return false;
      return true;
    }));
    if (targetId && !targetId.startsWith('cp-saved-') && !targetId.startsWith('cp-legacy-') && !targetId.startsWith('cp-tx-')) {
      SupabaseDataService.deleteCardPayment(targetId);
    }
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
    paymentDate,
    setPaymentDate,
    editingCardPaymentId,
    editingCardPaymentIndex,
    showAllHistoricalPayments,
    setShowAllHistoricalPayments,
    handleOpenCreateCardPayment,
    handleOpenEditCardPayment,
    handleMakeCardPayment,
    handleClosePaymentModal,
    handleDeleteCardPayment
  };
}
