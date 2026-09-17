'use client';

import React from 'react';
import { Coins, X } from 'lucide-react';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { Receivable } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

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
    collectPaymentDate,
    setCollectPaymentDate,
    collectPaymentNotes,
    setCollectPaymentNotes,
    formatSoles,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();

  const onClose = () => setIsCollectModalOpen(false);
  const onSubmit = handleSaveCollect;
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  const rawRem = collectingDebtorGroup ? collectingDebtorGroup.totalRemaining : (collectingRec?.remainingAmount || 0);
  const maxRem = Math.round(rawRem * 100) / 100;

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
          borderTop: '3px solid var(--accent-success)',
          borderRadius: '16px'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-collect-title"
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
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--accent-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Coins size={20} />
            </div>
            <div>
              <h2 id="modal-collect-title" className="modal-title" style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {collectingDebtorGroup ? 'Registrar Abono a Deudor' : 'Registrar Abono a Préstamo'}
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                Registra el ingreso recibido a cuenta de este préstamo.
              </p>
            </div>
          </div>
          <button
            id="btn-close-collect-modal"
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
                  Deudor (A quien prestaste)
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {collectingDebtorGroup ? collectingDebtorGroup.debtorName : collectingRec?.debtorName}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.35' }}>
                  {collectingDebtorGroup
                    ? `Abono consolidado para ${collectingDebtorGroup.items.length} ${collectingDebtorGroup.items.length === 1 ? 'préstamo' : 'préstamos acumulados'}`
                    : collectingRec?.description}
                </div>
              </div>
              <span
                className="badge badge-success"
                style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '8px', flexShrink: 0 }}
              >
                Préstamo por Cobrar
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
                {formatSoles(rawRem)}
              </strong>
            </div>
          </div>

          {/* Monto Input y Botones Rápidos */}
          <div className="form-group">
            <label className="form-label">Monto recibido • Soles</label>
            <input
              id="input-collect-amount"
              type="number"
              step="0.01"
              max={maxRem}
              min="0.01"
              placeholder={`Hasta ${maxRem.toFixed(2)}`}
              className="form-input"
              required
              value={collectAmountInput}
              onChange={e => setCollectAmountInput(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
              onClick={() => setCollectAmountInput((maxRem / 2).toFixed(2))}
            >
              Mitad • 50%: S/ {(maxRem / 2).toFixed(2)}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
              onClick={() => setCollectAmountInput(maxRem.toFixed(2))}
            >
              Total • 100%: S/ {maxRem.toFixed(2)}
            </button>
          </div>

          {/* Selector de Fecha de Cobranza */}
          <div className="form-group">
            <label className="form-label">Fecha de Cobranza</label>
            <CustomDatePicker
              value={collectPaymentDate}
              onChange={setCollectPaymentDate}
            />
          </div>

          {/* Notas / Constancia Opcional */}
          <div className="form-group">
            <label className="form-label">Notas / Constancia • Opcional</label>
            <input
              type="text"
              placeholder="ej. Yape, Plin, Transferencia BCP, Efectivo"
              className="form-input"
              value={collectPaymentNotes}
              onChange={e => setCollectPaymentNotes(e.target.value)}
            />
          </div>

          {/* Efecto Financiero */}
          <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            💡 <strong>Efecto financiero:</strong> Este abono ingresa a tu flujo y reduce directamente el saldo que te debe tu prestatario.
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
              id="btn-submit-collect"
              type="submit"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #059669, #047857)',
                borderColor: '#047857',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
              }}
            >
              <Coins size={14} />
              <span>Registrar Cobranza</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
