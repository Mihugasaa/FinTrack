'use client';

import React from 'react';
import { X, Banknote, DollarSign, Sparkles, Repeat } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR4 } from '@/lib/constants';
import { CurrencyCode } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

export const PayableModal: React.FC = () => {
  const {
    setIsPayableModalOpen,
    handleCreatePayable,
    editingPayableId,
    setEditingPayableId,
    payableCreditorName,
    setPayableCreditorName,
    payableDesc,
    setPayableDesc,
    payableAmount,
    setPayableAmount,
    payableCurrency,
    setPayableCurrency,
    payableIssueDate,
    setPayableIssueDate,
    payableExchangeRate,
    setPayableExchangeRate,
    payableTcInfo,
    isFetchingPayableTc,
    setHasUserManuallyEditedPayableTc,
    payableDueDate,
    setPayableDueDate,
    payableIsCreditedToDebit,
    setPayableIsCreditedToDebit,
    fetchPayableSunatRate,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const onClose = () => {
    setIsPayableModalOpen(false);
    setEditingPayableId(null);
  };
  const onSubmit = handleCreatePayable;
  const isEditing = !!editingPayableId;
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
          <span className="text-h2 font-bold">{isEditing ? 'Editar Deuda Mía' : 'Registrar Deuda Mía'}</span>
          <button id="btn-close-payable-modal" className="month-nav-btn modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">¿Quién te prestó el dinero? • Acreedor</label>
            <input
              id="input-payable-creditor"
              type="text"
              placeholder="ej. Carlos R., Mamá, Amigo, Prestamista"
              className="form-input"
              required
              value={payableCreditorName}
              onChange={e => setPayableCreditorName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Concepto o Motivo de la Deuda</label>
            <input
              id="input-payable-desc"
              type="text"
              placeholder="ej. Préstamo para laptop, Emergencia familiar"
              className="form-input"
              required
              value={payableDesc}
              onChange={e => setPayableDesc(e.target.value)}
            />
          </div>

          <div className="form-row-amount-currency">
            <div className="form-group">
              <label className="form-label">Monto Prestado</label>
              <input
                id="input-payable-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="form-input"
                required
                value={payableAmount}
                onChange={e => setPayableAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Moneda</label>
              <CustomSelect
                id="select-payable-currency"
                value={payableCurrency}
                onChange={val => {
                  const cur = val as CurrencyCode;
                  setPayableCurrency(cur);
                  if (cur === 'USD') {
                    fetchPayableSunatRate(payableIssueDate, true);
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
            <label className="form-label">Fecha en que te prestaron el dinero</label>
            <CustomDatePicker
              id="input-payable-issue-date"
              value={payableIssueDate}
              onChange={(newDate) => {
                setPayableIssueDate(newDate);
                if (payableCurrency === 'USD') {
                  fetchPayableSunatRate(newDate, true);
                }
              }}
            />
          </div>

          {payableCurrency === 'USD' && (
            <div className="loan-exchange-rate-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={15} style={{ color: 'var(--accent-success)' }} />
                  Tipo de cambio • USD a PEN
                </label>
                {payableTcInfo && (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
                      background: payableTcInfo.isFallback ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: payableTcInfo.isFallback ? 'var(--accent-warning)' : 'var(--accent-success)',
                      border: payableTcInfo.isFallback ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🏛️ {payableTcInfo.source} • {payableTcInfo.date}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="input-payable-exchange-rate"
                    type="number"
                    step="0.0001"
                    className="form-input"
                    style={{ paddingRight: '36px' }}
                    value={payableExchangeRate}
                    onChange={e => {
                      setPayableExchangeRate(e.target.value);
                      setHasUserManuallyEditedPayableTc(true);
                    }}
                    placeholder={FALLBACK_USD_PEN_RATE_STR4}
                  />
                  {isFetchingPayableTc && (
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
                    setHasUserManuallyEditedPayableTc(false);
                    fetchPayableSunatRate(payableIssueDate, true);
                  }}
                  title="Consultar cotización oficial SUNAT para esta fecha"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Repeat size={13} />
                  SUNAT
                </button>
              </div>

              <div style={{ marginTop: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {payableAmount && !isNaN(parseFloat(payableAmount)) && !isNaN(parseFloat(payableExchangeRate)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-success)', fontWeight: 600 }}>
                    <span>💵 Equivale a:</span>
                    <span style={{ fontSize: '0.85rem' }}>
                      S/ {(parseFloat(payableAmount) * parseFloat(payableExchangeRate)).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                      ${parseFloat(payableAmount).toFixed(2)} × {parseFloat(payableExchangeRate).toFixed(4)}
                    </span>
                  </div>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Cotización oficial SUNAT del día de la deuda. Puedes editarla manualmente si acordaron otra tasa.
                </span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Fecha Límite de Devolución • Opcional</label>
            <CustomDatePicker
              id="input-payable-due-date"
              value={payableDueDate}
              onChange={setPayableDueDate}
              placeholder="Sin fecha límite..."
            />
          </div>

          {/* Casilla interactiva confirmada por el usuario */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 14px',
              background: 'var(--bg-subtle)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginTop: '8px',
              marginBottom: '16px',
              cursor: 'pointer'
            }}
            onClick={() => setPayableIsCreditedToDebit(prev => !prev)}
          >
            <input
              type="checkbox"
              id="payableCreditToDebit"
              checked={payableIsCreditedToDebit}
              onChange={e => {
                e.stopPropagation();
                setPayableIsCreditedToDebit(e.target.checked);
              }}
              onClick={e => e.stopPropagation()}
              style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
            />
            <label
              htmlFor="payableCreditToDebit"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: '0.825rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0, lineHeight: 1.45 }}
            >
              <strong>¿Abonar este monto inicial a mi saldo en cuenta Débito?</strong>
              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                {payableCurrency === 'USD' && payableAmount && !isNaN(parseFloat(payableAmount))
                  ? `Se abonarán S/ ${(parseFloat(payableAmount) * (parseFloat(payableExchangeRate) || FALLBACK_USD_PEN_RATE)).toFixed(2)} • $${parseFloat(payableAmount).toFixed(2)} USD al cambio • a tu saldo disponible actual.`
                  : 'Marca esta opción si el dinero ingresó a tu cuenta bancaria para sumar a tu saldo disponible actual.'}
              </span>
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button id="btn-submit-payable" type="submit" className="btn-primary">
              {isEditing ? 'Actualizar Deuda' : 'Guardar Deuda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
