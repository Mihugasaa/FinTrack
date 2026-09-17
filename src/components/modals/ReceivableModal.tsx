'use client';

import React from 'react';
import { X, Banknote, DollarSign, Sparkles, Repeat } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR4 } from '@/lib/constants';
import { CurrencyCode } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

export const ReceivableModal: React.FC = () => {
  const {
    setIsReceivableModalOpen,
    handleCreateReceivable,
    editingReceivableId,
    setEditingReceivableId,
    debtorName,
    setDebtorName,
    loanDesc,
    setLoanDesc,
    loanAmount,
    setLoanAmount,
    loanCurrency,
    setLoanCurrency,
    loanDate,
    setLoanDate,
    loanExchangeRate,
    setLoanExchangeRate,
    loanTcInfo,
    isFetchingLoanTc,
    setHasUserManuallyEditedLoanTc,
    fetchLoanSunatRate,
    loanIsDebitedFromAccount,
    setLoanIsDebitedFromAccount,
    loanPaymentMethodId,
    setLoanPaymentMethodId,
    paymentMethods,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const onClose = () => {
    setIsReceivableModalOpen(false);
    setEditingReceivableId(null);
  };
  const onSubmit = handleCreateReceivable;
  const isEditing = !!editingReceivableId;
  const debitMethods = React.useMemo(() => {
    return (paymentMethods || []).filter(p => p.type === 'debit' || p.type === 'cash');
  }, [paymentMethods]);
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

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
          <span className="text-h2 font-bold">{isEditing ? 'Editar Préstamo' : 'Registrar Dinero Prestado'}</span>
          <button id="btn-close-receivable-modal" className="month-nav-btn modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">¿A quién le prestaste?</label>
            <input
              id="input-debtor-name"
              type="text"
              placeholder="ej. Mamá, Carlos, Hermano"
              className="form-input"
              required
              value={debtorName}
              onChange={e => setDebtorName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Concepto o Detalle</label>
            <input
              id="input-loan-desc"
              type="text"
              placeholder="ej. Compra de medicina, Cena compartida"
              className="form-input"
              value={loanDesc}
              onChange={e => setLoanDesc(e.target.value)}
            />
          </div>

          <div className="form-row-amount-currency">
            <div className="form-group">
              <label className="form-label">Monto Prestado</label>
              <input
                id="input-loan-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="form-input"
                required
                value={loanAmount}
                onChange={e => setLoanAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Moneda</label>
              <CustomSelect
                id="select-loan-currency"
                value={loanCurrency}
                onChange={val => {
                  const cur = val as CurrencyCode;
                  setLoanCurrency(cur);
                  if (cur === 'USD') {
                    fetchLoanSunatRate(loanDate, true);
                  }
                }}
                options={[
                  { value: 'PEN', label: 'Soles • PEN', icon: <Banknote size={15} style={{ color: '#10b981' }} /> },
                  { value: 'USD', label: 'Dólares • USD', icon: <DollarSign size={15} style={{ color: '#0ea5e9' }} /> },
                ]}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha en que realizaste el préstamo</label>
            <CustomDatePicker
              id="input-loan-date"
              value={loanDate}
              onChange={(newDate) => {
                setLoanDate(newDate);
                if (loanCurrency === 'USD') {
                  fetchLoanSunatRate(newDate, true);
                }
              }}
            />
          </div>

          {loanCurrency === 'USD' && (
            <div className="loan-exchange-rate-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={15} style={{ color: 'var(--accent-success)' }} />
                  Tipo de cambio • USD a PEN
                </label>
                {loanTcInfo && (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
                      background: loanTcInfo.isFallback ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: loanTcInfo.isFallback ? 'var(--accent-warning)' : 'var(--accent-success)',
                      border: loanTcInfo.isFallback ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🏛️ {loanTcInfo.source} • {loanTcInfo.date}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="input-loan-exchange-rate"
                    type="number"
                    step="0.0001"
                    className="form-input"
                    style={{ paddingRight: '36px' }}
                    value={loanExchangeRate}
                    onChange={e => {
                      setLoanExchangeRate(e.target.value);
                      setHasUserManuallyEditedLoanTc(true);
                    }}
                    placeholder={FALLBACK_USD_PEN_RATE_STR4}
                  />
                  {isFetchingLoanTc && (
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
                      <Sparkles size={13} className="spin-slow" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setHasUserManuallyEditedLoanTc(false);
                    fetchLoanSunatRate(loanDate, true);
                  }}
                  title="Consultar cotización oficial SUNAT para esta fecha"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Repeat size={13} />
                  SUNAT
                </button>
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {loanAmount && !isNaN(parseFloat(loanAmount)) && !isNaN(parseFloat(loanExchangeRate)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-success)', fontWeight: 600 }}>
                    <span>💵 Equivale a:</span>
                    <span style={{ fontSize: '0.85rem' }}>
                      S/ {(parseFloat(loanAmount) * parseFloat(loanExchangeRate)).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                      ${parseFloat(loanAmount).toFixed(2)} × {parseFloat(loanExchangeRate).toFixed(4)}
                    </span>
                  </div>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Cotización oficial SUNAT para la fecha seleccionada. Puedes editarla manualmente si acordaron otra tasa.
                </span>
              </div>
            </div>
          )}

          {!isEditing && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 14px',
                background: 'var(--bg-subtle)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginTop: '10px',
                marginBottom: '16px',
                cursor: 'pointer'
              }}
              onClick={() => setLoanIsDebitedFromAccount(prev => !prev)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <input
                  type="checkbox"
                  id="loanIsDebitedFromAccount"
                  checked={loanIsDebitedFromAccount}
                  onChange={e => {
                    e.stopPropagation();
                    setLoanIsDebitedFromAccount(e.target.checked);
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="loanIsDebitedFromAccount"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: '0.825rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0, lineHeight: 1.45 }}
                >
                  <strong>¿El dinero que presté sale de mi saldo en cuenta Débito?</strong>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                    {loanCurrency === 'USD' && loanAmount && !isNaN(parseFloat(loanAmount))
                      ? `Se debitarán S/ ${(parseFloat(loanAmount) * (parseFloat(loanExchangeRate) || FALLBACK_USD_PEN_RATE)).toFixed(2)} • $${parseFloat(loanAmount).toFixed(2)} USD al cambio • de tu saldo disponible y se registrará la salida en tus movimientos.`
                      : 'Marca esta opción si el dinero salió de tu cuenta bancaria para descontar de tu saldo disponible y registrarlo en tus movimientos.'}
                  </span>
                </label>
              </div>

              {loanIsDebitedFromAccount && debitMethods.length > 1 && (
                <div
                  style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                    Cuenta de débito de la cual salió el dinero:
                  </label>
                  <CustomSelect
                    id="select-loan-payment-method"
                    value={loanPaymentMethodId || debitMethods[0].id}
                    onChange={val => setLoanPaymentMethodId(val)}
                    options={debitMethods.map(pm => ({
                      value: pm.id,
                      label: pm.name,
                      icon: <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: pm.color }} />
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button id="btn-submit-receivable" type="submit" className="btn-primary">
              {isEditing ? 'Actualizar Préstamo' : 'Guardar Préstamo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
