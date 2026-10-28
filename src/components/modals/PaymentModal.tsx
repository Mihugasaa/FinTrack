'use client';

import React from 'react';
import { X, CreditCard, Banknote, TrendingUp, DollarSign, Calendar, CalendarClock, Loader2, RefreshCw } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { calculateItf } from '@/lib/calculations';

type PaymentSourceType = 'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT' | 'USD_SAVINGS_ACCOUNT';

export const PaymentModal: React.FC = () => {
  const {
    handleClosePaymentModal,
    handleMakeCardPayment,
    editingCardPaymentId,
    paymentMethods,
    paymentCardId,
    setPaymentCardId,
    paymentSourceType,
    setPaymentSourceType,
    paymentAmount,
    setPaymentAmount,
    paymentCurrency,
    setPaymentCurrency,
    paymentExchangeRate,
    setPaymentExchangeRate,
    paymentTcInfo,
    setHasUserManuallyEditedPaymentTc,
    isFetchingPaymentTc,
    fetchPaymentSunatRate,
    paymentDate,
    setPaymentDate,
    cardAmortization,
    cardPayments,
    paymentTargetMonth,
    setPaymentTargetMonth,
    prepaymentMode,
    setPrepaymentMode,
    getActiveInstallmentPlansForCard,
    transactions,
    currentYear,
    currentMonth,
    formatSoles,
    handleBackdropMouseDown,
    handleBackdropClick,
    applyItf,
    setApplyItf,
    itfAmountInput,
    setItfAmountInput
  } = useFinance();
  const onClose = handleClosePaymentModal;
  const onSubmit = handleMakeCardPayment;
  const isEditing = editingCardPaymentId !== null;
  const [isEditingItf, setIsEditingItf] = React.useState(false);
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  const activePlans = React.useMemo(() => {
    return getActiveInstallmentPlansForCard(
      paymentCardId,
      transactions,
      paymentMethods,
      undefined,
      cardPayments,
      cardAmortization
    );
  }, [paymentCardId, transactions, paymentMethods, cardPayments, cardAmortization, getActiveInstallmentPlansForCard]);

  const isPrepayment = paymentTargetMonth.startsWith('INSTALLMENT_PLAN:');
  const selectedPlan = isPrepayment ? (activePlans.find(p => `INSTALLMENT_PLAN:${p.planId}` === paymentTargetMonth) || null) : null;

  const parsedAmt = parseFloat(paymentAmount) || 0;
  const parsedRate = parseFloat(paymentExchangeRate) || 1;
  const calculatedPen = paymentCurrency === 'USD' ? Math.round(parsedAmt * parsedRate * 100) / 100 : parsedAmt;

  const autoItf = calculateItf(calculatedPen);
  const effectiveItf = (paymentSourceType === 'DEBIT_ACCOUNT' && applyItf)
    ? (itfAmountInput.trim() !== '' ? (parseFloat(itfAmountInput) || 0) : autoItf)
    : 0;
  const totalDebitFromAccount = calculatedPen + effectiveItf;

  const pendingCycles = cardAmortization?.pendingCyclesByCard?.get(paymentCardId) || [];

  // Filtrado de estados de cuenta reales: Meses vencidos impagos + ciclo actual + ciclo siguiente como máximo.
  // Los meses a futuro lejano (ej. 2027 a 2030) corresponden a cuotas no facturadas y se amortizan vía planes de cuotas.
  const maxAllowedMonthKey = React.useMemo(() => {
    let y = currentYear;
    let m = currentMonth + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    return `${y}-${m.toString().padStart(2, '0')}`;
  }, [currentYear, currentMonth]);

  const filteredPendingCycles = React.useMemo(() => {
    return pendingCycles.filter(c => c.monthKey <= maxAllowedMonthKey);
  }, [pendingCycles, maxAllowedMonthKey]);

  const matchedCycle = filteredPendingCycles.find(c => c.monthKey === paymentTargetMonth) || (paymentTargetMonth === '' ? filteredPendingCycles[0] : null);

  const cycleOptions = [
    {
      value: '',
      label: 'Automático (según vencimiento)',
      subtitle: 'Cubre el estado de cuenta más próximo a vencer',
      icon: <CalendarClock size={15} style={{ color: 'var(--accent-brand)' }} />
    },
    ...filteredPendingCycles.map(c => {
      const parts: string[] = [];
      if (c.unpaidPen > 0) parts.push(formatSoles(c.unpaidPen));
      if (c.unpaidUsd > 0) parts.push(`$${c.unpaidUsd.toFixed(2)} USD`);
      return {
        value: c.monthKey,
        label: c.label,
        subtitle: `Saldo pendiente: ${parts.join(' • ') || formatSoles(0)}`,
        icon: <Calendar size={15} style={{ color: 'var(--accent-warning)' }} />
      };
    }),
    ...(activePlans.length > 0 ? activePlans.map(plan => {
      const isUsd = plan.currency === 'USD';
      const quotaStr = isUsd ? `$${plan.monthlyAmount.toFixed(2)}` : formatSoles(plan.monthlyAmount);
      const totalStr = isUsd ? `$${plan.remainingDebt.toFixed(2)}` : formatSoles(plan.remainingDebt);
      return {
        value: `INSTALLMENT_PLAN:${plan.planId}`,
        label: plan.description,
        subtitle: `${plan.remainingInstallments} cuotas de ${quotaStr} • Saldo: ${totalStr}`,
        icon: <TrendingUp size={15} style={{ color: 'var(--accent-brand)' }} />
      };
    }) : []),
    {
      value: 'EXTRAORDINARY',
      label: 'Abono general a la tarjeta',
      subtitle: 'Reduce tu deuda total sin asignar a un mes específico',
      icon: <CreditCard size={15} style={{ color: 'var(--accent-success)' }} />
    }
  ];



  return (
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick(onClose)}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <div className="modal-box" ref={modalBoxRef} onClick={e => e.stopPropagation()}>
        <div className="modal-drag-zone" {...dragHandleProps}>
          <div className="modal-drag-handle" />
        </div>
        <div className="modal-title-row">
          <span className="text-h2 font-bold">
            {isEditing ? 'Modificar Abono a Tarjeta' : 'Registrar Abono a Tarjeta'}
          </span>
          <button className="month-nav-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Tarjeta a la que abonaste</label>
            <CustomSelect
              id="select-payment-card-target"
              value={paymentCardId}
              onChange={val => setPaymentCardId(val)}
              options={paymentMethods.filter(p => p.type === 'credit').map(p => ({
                value: p.id,
                label: p.name,
                colorDot: p.color || '#6366f1',
                icon: <CreditCard size={15} style={{ color: p.color || '#6366f1' }} />
              }))}
            />
          </div>

          {/* Mes o estado de cuenta a pagar */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
              <label className="form-label" style={{ margin: 0 }}>Mes o estado de cuenta</label>
              {selectedPlan ? (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => {
                    setPaymentAmount(selectedPlan.remainingDebt.toFixed(2));
                    if (selectedPlan.currency === 'USD') {
                      setPaymentCurrency('USD');
                    }
                  }}
                  title="Pagar la deuda total de este plan"
                >
                  Pagar deuda total ({selectedPlan.currency === 'USD' ? `$${selectedPlan.remainingDebt.toFixed(2)}` : formatSoles(selectedPlan.remainingDebt)})
                </button>
              ) : matchedCycle ? (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => {
                    const dueAmt = paymentCurrency === 'USD'
                      ? (matchedCycle.unpaidUsd > 0 ? matchedCycle.unpaidUsd : matchedCycle.unpaidPen)
                      : matchedCycle.unpaidPen;
                    setPaymentAmount(dueAmt.toFixed(2));
                  }}
                  title="Usar el saldo pendiente de este mes"
                >
                  Pagar mes completo ({paymentCurrency === 'USD' && matchedCycle.unpaidUsd > 0 ? `$${matchedCycle.unpaidUsd.toFixed(2)}` : formatSoles(matchedCycle.unpaidPen)})
                </button>
              ) : null}
            </div>
            <CustomSelect
              id="select-payment-target-cycle"
              value={paymentTargetMonth}
              onChange={val => {
                setPaymentTargetMonth(val);
                if (val.startsWith('INSTALLMENT_PLAN:')) {
                  const p = activePlans.find(plan => `INSTALLMENT_PLAN:${plan.planId}` === val);
                  if (p && p.currency === 'USD') {
                    setPaymentCurrency('USD');
                  }
                }
              }}
              options={cycleOptions}
            />
          </div>



          {/* Selector de Moneda: Soles o Dólares */}
          <div className="form-group">
            <label className="form-label">Moneda del Abono</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`btn-secondary ${paymentCurrency === 'PEN' ? 'active-currency-pill' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  background: paymentCurrency === 'PEN' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-subtle)',
                  color: paymentCurrency === 'PEN' ? 'var(--accent-success)' : 'var(--text-secondary)',
                  border: paymentCurrency === 'PEN' ? '1.5px solid var(--accent-success)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setPaymentCurrency('PEN')}
              >
                <Banknote size={16} />
                <span>Soles • PEN</span>
              </button>
              <button
                type="button"
                className={`btn-secondary ${paymentCurrency === 'USD' ? 'active-currency-pill' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  background: paymentCurrency === 'USD' ? 'rgba(14, 165, 233, 0.15)' : 'var(--bg-subtle)',
                  color: paymentCurrency === 'USD' ? 'var(--accent-info)' : 'var(--text-secondary)',
                  border: paymentCurrency === 'USD' ? '1.5px solid var(--accent-info)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  setPaymentCurrency('USD');
                  fetchPaymentSunatRate(paymentDate, true);
                }}
              >
                <DollarSign size={16} />
                <span>Dólares • USD</span>
              </button>
            </div>
          </div>

          {/* Bloque de Tipo de Cambio cuando se paga en USD */}
          {paymentCurrency === 'USD' && (
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={15} style={{ color: 'var(--accent-info)' }} />
                  Tipo de cambio • USD a PEN
                </label>
                {paymentTcInfo && (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
                      background: paymentTcInfo.isFallback ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: paymentTcInfo.isFallback ? 'var(--accent-warning)' : 'var(--accent-success)',
                      border: paymentTcInfo.isFallback ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🏛️ {paymentTcInfo.source} • {paymentTcInfo.date}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="input-card-payment-tc"
                    type="number"
                    step="0.0001"
                    className="form-input"
                    style={{ paddingRight: '40px' }}
                    value={paymentExchangeRate}
                    onChange={e => {
                      setPaymentExchangeRate(e.target.value);
                      setHasUserManuallyEditedPaymentTc(true);
                    }}
                    placeholder="3.7200"
                  />
                  {isFetchingPaymentTc && (
                    <div style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.72rem',
                      color: 'var(--accent-info)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Loader2 size={13} className="spin-slow" />
                    </div>
                  )}
                </div>
                <button
                  id="btn-fetch-sunat-card-payment"
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setHasUserManuallyEditedPaymentTc(false);
                    fetchPaymentSunatRate(paymentDate, true);
                  }}
                  title="Restablecer cotización oficial para esta fecha"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={13} />
                  Oficial
                </button>
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Tipo de cambio de referencia. Puedes ajustarlo según la tasa aplicada a tu operación.
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Monto abonado {paymentCurrency === 'USD' ? '($ USD)' : '(S/ PEN)'}
            </label>
            <input
              id="input-card-payment-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="form-input"
              required
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
            />
          </div>

          {/* Modalidad de amortización anticipada (Bancaria / SBS) */}
          {selectedPlan && (() => {
            const isPlanUsd = selectedPlan.currency === 'USD';
            const effectivePlanPrepay = isPlanUsd
              ? (paymentCurrency === 'USD' ? parsedAmt : (parsedRate > 0 ? parsedAmt / parsedRate : 0))
              : calculatedPen;
            const quotaAmt = selectedPlan.monthlyAmount;
            const fullQuotasCovered = quotaAmt > 0 ? Math.min(selectedPlan.remainingInstallments, Math.floor((effectivePlanPrepay + 0.009) / quotaAmt)) : 0;
            const newBalance = Math.max(0, Math.round((selectedPlan.remainingDebt - effectivePlanPrepay) * 100) / 100);
            const remainingInstallmentsCount = selectedPlan.remainingInstallments - fullQuotasCovered;
            const newMonthlyQuota = selectedPlan.remainingInstallments > 0 ? Math.round((newBalance / selectedPlan.remainingInstallments) * 100) / 100 : 0;
            const formatPlanAmt = (val: number) => isPlanUsd ? `$${val.toFixed(2)} USD` : formatSoles(val);

            return (
              <div style={{
                marginBottom: '16px',
                padding: '14px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={15} style={{ color: 'var(--accent-brand)' }} />
                    ¿Cómo aplicar el abono?
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  {/* Opción A: Reducir plazo */}
                  <button
                    type="button"
                    onClick={() => setPrepaymentMode('REDUCE_TERM')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: prepaymentMode === 'REDUCE_TERM' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-subtle)',
                      border: prepaymentMode === 'REDUCE_TERM' ? '1.5px solid var(--accent-brand)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      color: prepaymentMode === 'REDUCE_TERM' ? 'var(--accent-brand)' : 'var(--text-primary)'
                    }}>
                      Reducir plazo
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Menos cuotas por pagar
                    </span>
                  </button>

                  {/* Opción B: Reducir cuota */}
                  <button
                    type="button"
                    onClick={() => setPrepaymentMode('REDUCE_AMOUNT')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: prepaymentMode === 'REDUCE_AMOUNT' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-subtle)',
                      border: prepaymentMode === 'REDUCE_AMOUNT' ? '1.5px solid var(--accent-brand)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      color: prepaymentMode === 'REDUCE_AMOUNT' ? 'var(--accent-brand)' : 'var(--text-primary)'
                    }}>
                      Reducir cuota
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Cuota mensual más baja
                    </span>
                  </button>
                </div>

                {/* Resumen del nuevo cronograma (Key-Value) */}
                {parsedAmt <= 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cuotas pendientes</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{selectedPlan.remainingInstallments} × {formatPlanAmt(selectedPlan.monthlyAmount)}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Saldo actual</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{formatPlanAmt(selectedPlan.remainingDebt)}</strong>
                    </div>
                  </div>
                ) : effectivePlanPrepay >= selectedPlan.remainingDebt - 0.009 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cuotas canceladas</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--accent-success)' }}>Todas ({selectedPlan.remainingInstallments} de {selectedPlan.remainingInstallments})</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Saldo restante</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--accent-success)' }}>{formatPlanAmt(0)}</strong>
                    </div>
                  </div>
                ) : prepaymentMode === 'REDUCE_TERM' ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    padding: '10px 12px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Canceladas</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--accent-brand)' }}>
                        {fullQuotasCovered > 0 ? `${fullQuotasCovered} ${fullQuotasCovered === 1 ? 'cuota' : 'cuotas'}` : '0 (parcial)'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Por pagar</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                        {remainingInstallmentsCount} × {formatPlanAmt(quotaAmt)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nuevo saldo</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                        {formatPlanAmt(newBalance)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    padding: '10px 12px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nueva cuota</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--accent-brand)' }}>
                        {formatPlanAmt(newMonthlyQuota)}/mes
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plazo</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                        {selectedPlan.remainingInstallments} cuotas
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nuevo saldo</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                        {formatPlanAmt(newBalance)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}


          <div className="form-group">
            <label className="form-label">Origen de los fondos</label>
            <CustomSelect
              id="select-card-payment-source"
              value={paymentSourceType}
              onChange={val => setPaymentSourceType(val as PaymentSourceType)}
              options={[
                {
                  value: 'DEBIT_ACCOUNT',
                  label: paymentCurrency === 'USD'
                    ? 'Cuenta Débito (Soles)'
                    : 'Cuenta Débito / Bancos',
                  subtitle: paymentCurrency === 'USD'
                    ? `Debita el contravalor de ${formatSoles(calculatedPen)} de tu cuenta bancaria`
                    : 'Debita de tu saldo disponible en cuenta bancaria',
                  icon: <Banknote size={15} style={{ color: '#10b981' }} />
                },
                ...(paymentCurrency === 'USD' ? [{
                  value: 'USD_SAVINGS_ACCOUNT' as PaymentSourceType,
                  label: 'Fondos en Dólares',
                  subtitle: 'Amortiza la deuda en USD sin debitar de tu cuenta en Soles',
                  icon: <DollarSign size={15} style={{ color: '#0ea5e9' }} />
                }] : []),
                {
                  value: 'MERCHANT_REFUND',
                  label: 'Reembolso de Comercio',
                  subtitle: 'Abono directo a la tarjeta por devolución (sin débito en cuenta)',
                  icon: <TrendingUp size={15} style={{ color: '#0ea5e9' }} />
                },
                {
                  value: 'BANK_CREDIT',
                  label: 'Abono del Banco / Cashback',
                  subtitle: 'Bonificación o saldo a favor del banco (sin débito en cuenta)',
                  icon: <DollarSign size={15} style={{ color: '#8b5cf6' }} />
                }
              ]}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha de Pago</label>
            <CustomDatePicker
              value={paymentDate}
              onChange={setPaymentDate}
            />
          </div>

          {/* Bloque de Configuración ITF Bancario */}
          {paymentSourceType === 'DEBIT_ACCOUNT' && (
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      ITF (0.005%)
                    </span>
                    {autoItf > 0 && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: 'var(--accent-brand)',
                          border: '1px solid rgba(99, 102, 241, 0.3)'
                        }}
                      >
                        +{formatSoles(autoItf)}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                    {calculatedPen >= 1000
                      ? 'Aplica para transferencias desde S/ 1,000 en cuenta bancaria.'
                      : 'Operación menor a S/ 1,000 (sin retención).'}
                  </p>
                </div>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: applyItf ? 'var(--accent-brand)' : 'var(--text-muted)'
                  }}
                  title="Desactiva si pagas desde tu cuenta sueldo"
                >
                  <input
                    id="toggle-apply-itf"
                    type="checkbox"
                    checked={applyItf}
                    onChange={e => setApplyItf(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--accent-brand)', cursor: 'pointer' }}
                  />
                  <span>Aplicar</span>
                </label>
              </div>

              {applyItf && autoItf > 0 && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem'
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Monto de retención:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isEditingItf ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>S/</span>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input tabular-nums"
                          style={{ width: '70px', padding: '2px 6px', fontSize: '0.75rem', height: '26px' }}
                          value={itfAmountInput !== '' ? itfAmountInput : autoItf.toFixed(2)}
                          onChange={e => setItfAmountInput(e.target.value)}
                          placeholder={autoItf.toFixed(2)}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.68rem', padding: '2px 6px', height: '26px' }}
                          onClick={() => {
                            setItfAmountInput('');
                            setIsEditingItf(false);
                          }}
                        >
                          Auto
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          +{formatSoles(effectiveItf)}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px' }}
                          onClick={() => setIsEditingItf(true)}
                          title="Ajustar centavos si el banco debitó un redondeo particular"
                        >
                          {itfAmountInput.trim() !== '' ? 'Modificado' : 'Editar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumen de la Operación (Key-Value Ledger Estándar) */}
          <div style={{
            padding: '12px 14px',
            background: 'var(--bg-subtle)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: '8px'
            }}>
              Detalle del Pago
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.81rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monto a la tarjeta:</span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {paymentCurrency === 'USD' ? `$${parsedAmt.toFixed(2)} USD` : formatSoles(parsedAmt)}
                </span>
              </div>

              {paymentCurrency === 'USD' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tipo de cambio:</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {parsedRate.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Equivalente en Soles:</span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {formatSoles(calculatedPen)}
                    </span>
                  </div>
                </>
              )}

              {paymentSourceType === 'DEBIT_ACCOUNT' && effectiveItf > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>ITF retenido (0.005%):</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--accent-brand)' }}>
                    +{formatSoles(effectiveItf)}
                  </span>
                </div>
              )}

              {selectedPlan && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Modalidad:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-brand)' }}>
                    {prepaymentMode === 'REDUCE_TERM' ? 'Reducir plazo' : 'Reducir cuota'}
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '6px',
                marginTop: '2px',
                borderTop: '1px dashed var(--border-subtle)',
                fontWeight: 700
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {paymentSourceType === 'DEBIT_ACCOUNT' ? 'Cargo a tu cuenta:' : 'Cargo en cuenta:'}
                </span>
                <span className="tabular-nums" style={{
                  color: paymentSourceType === 'DEBIT_ACCOUNT'
                    ? (totalDebitFromAccount > 0 ? 'var(--accent-warning)' : 'var(--text-primary)')
                    : 'var(--accent-success)',
                  fontSize: '0.9rem'
                }}>
                  {paymentSourceType === 'DEBIT_ACCOUNT'
                    ? formatSoles(totalDebitFromAccount)
                    : 'S/ 0.00 (Sin débito)'}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {isEditing
                ? 'Guardar cambios'
                : parsedAmt > 0
                ? `Pagar ${paymentCurrency === 'USD' ? `$${parsedAmt.toFixed(2)} USD` : formatSoles(parsedAmt)}`
                : 'Confirmar pago'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
