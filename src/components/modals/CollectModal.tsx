'use client';

import React from 'react';
import { Coins, X } from 'lucide-react';
import { Receivable } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';

export interface CollectingDebtorGroup {
  debtorName: string;
  totalRemaining: number;
  items: Receivable[];
}

export const CollectModal: React.FC = () => {
  const {
    setIsCollectModalOpen,
    handleSaveCollect,
    collectingRec,
    collectingDebtorGroup,
    collectAmountInput,
    setCollectAmountInput,
    formatSoles,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const onClose = () => setIsCollectModalOpen(false);
  const onSubmit = handleSaveCollect;
  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick(onClose)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
        <div className="modal-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={18} color="var(--accent-success)" />
            <span className="text-h2 font-bold">
              {collectingDebtorGroup ? 'Registrar Abono a Deudor' : 'Registrar Abono a Préstamo'}
            </span>
          </div>
          <button id="btn-close-collect-modal" className="month-nav-btn" onClick={onClose}>
            <X size={16} />
          </button>

        </div>

        <form onSubmit={onSubmit}>
          <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {collectingDebtorGroup ? collectingDebtorGroup.debtorName : collectingRec?.debtorName}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {collectingDebtorGroup
                ? `Abono consolidado para ${collectingDebtorGroup.items.length} préstamos acumulados`
                : collectingRec?.description}
            </div>
            {collectingDebtorGroup && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-brand)', marginTop: '6px', background: 'var(--accent-brand-subtle)', padding: '6px 8px', borderRadius: '6px', lineHeight: '1.4' }}>
                💡 <strong>Método Cascada • FIFO:</strong> El abono saldará primero los préstamos más antiguos y el saldo restante amortizará los siguientes.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Deuda restante total:</span>
              <strong className="tabular-nums" style={{ color: 'var(--accent-warning)' }}>
                {formatSoles(collectingDebtorGroup ? collectingDebtorGroup.totalRemaining : (collectingRec?.remainingAmount || 0))}
              </strong>
            </div>
          </div>

          {(() => {
            const rawRem = collectingDebtorGroup ? collectingDebtorGroup.totalRemaining : (collectingRec?.remainingAmount || 0);
            const maxRem = Math.round(rawRem * 100) / 100;
            return (
              <>
                <div className="form-group">
                  <label className="form-label">Monto que te abonaron hoy • Soles</label>
                  <input
                    id="input-collect-amount"
                    type="number"
                    step="0.01"
                    max={maxRem}
                    min="0.01"
                    placeholder="0.00"
                    className="form-input"
                    required
                    value={collectAmountInput}
                    onChange={e => setCollectAmountInput(e.target.value)}
                    autoFocus
                  />

                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => setCollectAmountInput((maxRem / 2).toFixed(2))}
                  >
                    Mitad • 50%: S/ {(maxRem / 2).toFixed(2)}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => setCollectAmountInput(maxRem.toFixed(2))}
                  >
                    Total • 100%: S/ {maxRem.toFixed(2)}
                  </button>
                </div>
              </>
            );
          })()}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Registrar Cobranza
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
