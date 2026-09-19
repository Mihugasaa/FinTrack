'use client';

import React from 'react';
import { Coins, X } from 'lucide-react';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { FALLBACK_USD_PEN_RATE } from '@/lib/constants';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

export const PayablePaymentModal: React.FC = () => {
  const {
    setIsPayablePaymentModalOpen,
    handlePayPayable,
    payingPayable,
    payingCreditorGroup,
    payablePaymentAmount,
    setPayablePaymentAmount,
    payablePaymentDate,
    setPayablePaymentDate,
    payablePaymentNotes,
    setPayablePaymentNotes,
    formatSoles,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();

  const onClose = () => setIsPayablePaymentModalOpen(false);
  const onSubmit = handlePayPayable;
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  const isUsd = payingPayable?.currency === 'USD' || (!!payingCreditorGroup?.hasUsd && !!payingCreditorGroup?.isPureUsd);
  const rawRem = payingPayable
    ? ((isUsd && payingPayable.originalAmount && payingPayable.remainingAmount > payingPayable.originalAmount)
        ? Math.max(0, payingPayable.originalAmount - (payingPayable.paidAmount ?? 0))
        : (payingPayable.remainingAmount || 0))
    : (isUsd ? (payingCreditorGroup?.totalRemainingUsd || 0) : (payingCreditorGroup?.totalRemaining || 0));
  const currSymbol = isUsd ? '$ USD' : 'S/ PEN';

  return (
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick(onClose)}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <div
        className="modal-box"
        ref={modalBoxRef}
        style={{
          maxWidth: '530px',
          width: '100%',
          padding: '22px 26px',
          borderTop: '3px solid var(--accent-warning)',
          borderRadius: '16px',
          overflow: 'visible'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-payable-payment-title"
      >
        <div className="modal-drag-zone" {...dragHandleProps}>
          <div className="modal-drag-handle" />
        </div>

        {/* Cabecera con Icono Temático y Botón Cerrar */}
        <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.14)',
                color: 'var(--accent-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Coins size={20} />
            </div>
            <div>
              <h2 id="modal-payable-payment-title" className="modal-title" style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {payingCreditorGroup ? 'Abonar a Deuda Consolidada' : 'Amortizar Deuda'}
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Registra la salida de dinero para amortizar este compromiso.
              </p>
            </div>
          </div>
          <button
            id="btn-close-payable-payment-modal"
            type="button"
            className="btn-action-icon"
            onClick={onClose}
            title="Cerrar"
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {/* Tarjeta de Contexto de la Entidad */}
          <div
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Acreedor (A quien debes)
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {payingCreditorGroup ? payingCreditorGroup.creditorName : payingPayable?.creditorName}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.35' }}>
                  {payingCreditorGroup
                    ? `Abono consolidado para ${payingCreditorGroup.items.length} ${payingCreditorGroup.items.length === 1 ? 'compromiso' : 'compromisos acumulados'}`
                    : payingPayable?.description}
                </div>
              </div>
              <span
                className="badge badge-warning"
                style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '8px', flexShrink: 0 }}
              >
                Deuda Mía
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.8rem'
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Saldo pendiente actual:</span>
              <strong className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-warning)' }}>
                {(() => {
                  if (payingPayable) {
                    const orig = (isUsd && payingPayable.originalAmount) ? payingPayable.originalAmount : (payingPayable.originalAmount ?? payingPayable.totalAmount ?? 0);
                    const paid = payingPayable.paidAmount ?? 0;
                    const rem = (isUsd && payingPayable.remainingAmount > orig) ? Math.max(0, orig - paid) : (payingPayable.remainingAmount ?? orig);
                    if (isUsd) {
                      const pen = payingPayable.amountPen ? (rem / (orig || 1)) * payingPayable.amountPen : rem * (payingPayable.exchangeRate || FALLBACK_USD_PEN_RATE);
                      return `$ ${rem.toFixed(2)} USD • ${formatSoles(pen)}`;
                    }
                    return formatSoles(rem);
                  }
                  if (payingCreditorGroup) {
                    if (payingCreditorGroup.hasUsd && payingCreditorGroup.isPureUsd) {
                      return `$ ${(payingCreditorGroup.totalRemainingUsd || 0).toFixed(2)} USD • ${formatSoles(payingCreditorGroup.totalRemaining)}`;
                    }
                    if (payingCreditorGroup.hasUsd) {
                      return `${formatSoles(payingCreditorGroup.totalRemaining)} • $ ${(payingCreditorGroup.totalRemainingUsd || 0).toFixed(2)} USD`;
                    }
                    return formatSoles(payingCreditorGroup.totalRemaining);
                  }
                  return 'S/ 0.00';
                })()}
              </strong>
            </div>
          </div>

          {/* Campo Monto */}
          <div className="form-group">
            <label className="form-label">Monto a Abonar • {currSymbol}</label>
            <input
              id="input-payable-payment-amount"
              type="number"
              step="0.01"
              max={rawRem}
              placeholder={`Hasta ${rawRem.toFixed(2)}`}
              className="form-input"
              required
              value={payablePaymentAmount}
              onChange={e => setPayablePaymentAmount(e.target.value)}
            />
          </div>

          {/* Campo Fecha */}
          <div className="form-group">
            <label className="form-label">Fecha de Pago</label>
            <CustomDatePicker
              value={payablePaymentDate}
              onChange={setPayablePaymentDate}
            />
          </div>

          {/* Campo Notas / Constancia */}
          <div className="form-group">
            <label className="form-label">Notas / Constancia • Opcional</label>
            <input
              type="text"
              placeholder="ej. Transferencia BCP, Yape, Efectivo"
              className="form-input"
              value={payablePaymentNotes}
              onChange={e => setPayablePaymentNotes(e.target.value)}
            />
          </div>

          {/* Efecto Financiero */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            💡 <strong>Efecto financiero:</strong> Este pago amortiza la deuda con tu acreedor y se descuenta de tu flujo disponible sin duplicar gastos de consumo.
          </div>

          {/* Acciones */}
          <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '9px 18px', fontSize: '0.85rem' }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              id="btn-submit-payable-payment"
              type="submit"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #d97706, #b45309)',
                borderColor: '#b45309',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)'
              }}
            >
              <Coins size={14} />
              <span>Registrar Abono • {currSymbol}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
