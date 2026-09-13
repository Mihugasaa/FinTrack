'use client';

import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';

interface AdjustDebitModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  monthNames: string[];
  currentMonth: number;
  currentYear: number;
  prevMonthClosingBalance?: { amount: number; monthName: string } | null;
  tempDebitBalance: string;
  setTempDebitBalance: (v: string) => void;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => void;
  formatSoles: (v: number) => string;
}

export const AdjustDebitModal: React.FC = () => {
  const {
    setIsAdjustDebitModalOpen,
    handleAdjustDebit,
    monthNames,
    currentMonth,
    currentYear,
    prevMonthClosingBalance,
    tempDebitBalance,
    setTempDebitBalance,
    handleBackdropMouseDown,
    handleBackdropClick,
    formatSoles
  } = useFinance();
  const onClose = () => setIsAdjustDebitModalOpen(false);
  const onSubmit = handleAdjustDebit;
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
            Indica con cuánto dinero en cuenta o débito arrancaste el mes de <strong>{monthNames[currentMonth]} {currentYear}</strong>.
          </p>

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

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Actualizar Saldo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
