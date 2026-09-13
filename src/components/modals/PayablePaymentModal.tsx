'use client';

import React from 'react';
import { Coins, X } from 'lucide-react';
import { FALLBACK_USD_PEN_RATE } from '@/lib/constants';
import { Payable, CreditorGroup } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';

interface PayablePaymentModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  payingPayable: Payable | null;
  payingCreditorGroup: CreditorGroup | null;
  payablePaymentAmount: string;
  setPayablePaymentAmount: (v: string) => void;
  payablePaymentDate: string;
  setPayablePaymentDate: (v: string) => void;
  payablePaymentNotes: string;
  setPayablePaymentNotes: (v: string) => void;
  formatSoles: (v: number) => string;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => void;
}

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
  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick(onClose)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
        <div className="modal-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={18} color="var(--accent-warning)" />
            <span className="text-h2 font-bold">
              {payingCreditorGroup ? 'Abonar a Deuda Consolidada' : 'Amortizar Deuda'}
            </span>
          </div>
          <button className="month-nav-btn modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Acreedor: {payingCreditorGroup ? payingCreditorGroup.creditorName : payingPayable?.creditorName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {payingCreditorGroup
                ? `Abono consolidado para ${payingCreditorGroup.items.length} compromisos acumulados (distribución en cascada FIFO)`
                : payingPayable?.description}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saldo pendiente total:</span>
              <div style={{ textAlign: 'right' }}>
                <span className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-warning)' }}>
                  {(() => {
                    if (payingPayable) {
                      const isUsd = payingPayable.currency === 'USD';
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
                </span>
              </div>
            </div>
          </div>

          {(() => {
            const isUsd = payingPayable?.currency === 'USD' || (!!payingCreditorGroup?.hasUsd && !!payingCreditorGroup?.isPureUsd);
            const rawRem = payingPayable
              ? ((isUsd && payingPayable.originalAmount && payingPayable.remainingAmount > payingPayable.originalAmount)
                  ? Math.max(0, payingPayable.originalAmount - (payingPayable.paidAmount ?? 0))
                  : (payingPayable.remainingAmount || 0))
              : (isUsd ? (payingCreditorGroup?.totalRemainingUsd || 0) : (payingCreditorGroup?.totalRemaining || 0));
            const currSymbol = isUsd ? '$ USD' : 'S/ PEN';

            return (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Monto a Abonar • {currSymbol}</label>
                  <button
                    type="button"
                    className="btn-link"
                    style={{ fontSize: '0.75rem', color: 'var(--accent-brand)' }}
                    onClick={() => setPayablePaymentAmount(rawRem.toFixed(2))}
                  >
                    Pagar total • {isUsd ? `$ ${rawRem.toFixed(2)} USD` : formatSoles(rawRem)}
                  </button>
                </div>
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
                  autoFocus
                />
              </div>
            );
          })()}

          <div className="form-group">
            <label className="form-label">Fecha de Pago</label>
            <input
              type="date"
              className="form-input"
              required
              value={payablePaymentDate}
              onChange={e => setPayablePaymentDate(e.target.value)}
            />
          </div>

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

          <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            💡 <strong>Efecto financiero:</strong> Este pago amortiza la deuda con tu acreedor y se descuenta de tu flujo bancario disponible sin duplicar gastos de consumo.
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button id="btn-submit-payable-payment" type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Coins size={14} />
              <span>
                Registrar Abono • {payingPayable?.currency === 'USD' || (payingCreditorGroup?.hasUsd && payingCreditorGroup?.isPureUsd) ? '$ USD' : 'S/ PEN'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
