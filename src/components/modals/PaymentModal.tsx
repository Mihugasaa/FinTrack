'use client';

import React from 'react';
import { X, CreditCard, Banknote, TrendingUp, DollarSign } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { PaymentMethod } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';

type PaymentSourceType = 'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT';

interface PaymentModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isEditing: boolean;
  paymentMethods: PaymentMethod[];
  paymentCardId: string;
  setPaymentCardId: (v: string) => void;
  paymentSourceType: PaymentSourceType;
  setPaymentSourceType: (v: PaymentSourceType) => void;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  paymentDate: string;
  setPaymentDate: (v: string) => void;
  formatSoles: (v: number) => string;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const PaymentModal: React.FC = () => {
  const {
    handleClosePaymentModal,
    handleMakeCardPayment,
    editingCardPaymentIndex,
    paymentMethods,
    paymentCardId,
    setPaymentCardId,
    paymentSourceType,
    setPaymentSourceType,
    paymentAmount,
    setPaymentAmount,
    paymentDate,
    setPaymentDate,
    formatSoles,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const onClose = handleClosePaymentModal;
  const onSubmit = handleMakeCardPayment;
  const isEditing = editingCardPaymentIndex !== null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick(onClose)}
    >
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
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


          <div className="form-group">
            <label className="form-label">Origen de los Fondos / Motivo del Abono</label>
            <CustomSelect
              id="select-card-payment-source"
              value={paymentSourceType}
              onChange={val => setPaymentSourceType(val as PaymentSourceType)}
              options={[
                {
                  value: 'DEBIT_ACCOUNT',
                  label: 'Pago desde Cuenta Débito / Bancos',
                  subtitle: 'Descuenta de tu saldo disponible en banco',
                  icon: <Banknote size={15} style={{ color: '#10b981' }} />
                },
                {
                  value: 'MERCHANT_REFUND',
                  label: 'Reembolso de Comercio / Devolución',
                  subtitle: 'Devolución directa a la tarjeta (no descuenta de banco)',
                  icon: <TrendingUp size={15} style={{ color: '#0ea5e9' }} />
                },
                {
                  value: 'BANK_CREDIT',
                  label: 'Abono de Banco / Cashback / Saldo a Favor',
                  subtitle: 'Abono promocional o regularización del banco',
                  icon: <DollarSign size={15} style={{ color: '#8b5cf6' }} />
                }
              ]}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monto Abonado / Pagado (S/)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="form-input"
              required
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha de Pago</label>
            <input
              type="date"
              className="form-input"
              required
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
            />
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            💡 <strong>Efecto en tus finanzas:</strong> {
              paymentSourceType === 'DEBIT_ACCOUNT'
                ? `Este abono amortizará la deuda de la tarjeta y descontará automáticamente ${formatSoles(parseFloat(paymentAmount) || 0)} de tu Saldo Débito (Bancos).`
                : `Este abono amortizará la deuda de la tarjeta (o generará saldo a favor) SIN descontar dinero de tu cuenta bancaria ni saldo débito.`
            }
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
              {isEditing ? 'Guardar Cambios' : 'Registrar Abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
