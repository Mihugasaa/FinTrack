'use client';

import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';

export const AdjustDebitModal: React.FC = () => {
  const {
    setIsAdjustDebitModalOpen,
    adjustDebit,
    clearDebitOverride,
    isInitialDebitAuto,
    monthNames,
    currentMonth,
    currentYear,
    prevMonthClosingBalance,
    initialDebitForMonth,
    handleBackdropMouseDown,
    handleBackdropClick,
    formatSoles
  } = useFinance();

  // Estado local del formulario: se siembra con el saldo base actual del mes.
  const [tempDebitBalance, setTempDebitBalance] = useState(
    () => (initialDebitForMonth ? initialDebitForMonth.toString() : '0')
  );

  const onClose = () => setIsAdjustDebitModalOpen(false);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustDebit(tempDebitBalance);
  };
  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick(onClose)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
        <div className="modal-title-row">
          <span className="text-h2 font-bold">Ajustar Saldo Débito Inicial</span>
          <button className="month-nav-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
<strong>{monthNames[currentMonth]} {currentYear}</strong> arranca con el saldo con que cerró el mes pasado. Escribe un monto aquí solo si quieres fijar otro valor a mano.
          </p>

          {isInitialDebitAuto && (
            <p style={{ fontSize: '0.75rem', color: 'var(--accent-info)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={13} /> Este mes está usando el saldo que viene del mes pasado.
            </p>
          )}

          {prevMonthClosingBalance && (
            <div style={{ marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => setTempDebitBalance(prevMonthClosingBalance.amount.toFixed(2))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: 'var(--accent-info)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                title={`Copiar saldo de cierre de ${prevMonthClosingBalance.monthName}`}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} /> Usar cierre de {prevMonthClosingBalance.monthName}:
                </span>
                <strong className="tabular-nums font-bold">{formatSoles(prevMonthClosingBalance.amount)}</strong>
              </button>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Saldo Inicial (S/)</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              required
              value={tempDebitBalance}
              onChange={e => setTempDebitBalance(e.target.value)}
              autoFocus
            />
          </div>

          {!isInitialDebitAuto && (
            <button
              type="button"
              onClick={clearDebitOverride}
              style={{
                width: '100%',
                marginBottom: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px dashed var(--border-default)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600
              }}
              title="Quitar el saldo manual y volver al arrastre automático del mes anterior"
            >
              ↳ Restaurar arrastre automático
            </button>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {isInitialDebitAuto ? 'Anclar Saldo' : 'Actualizar Saldo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
