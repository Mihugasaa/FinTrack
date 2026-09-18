'use client';

import React from 'react';
import { Calendar, X, Save, Clock, CheckCircle2, ArrowDownLeft } from 'lucide-react';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

export const EditCollectModal: React.FC = () => {
  const {
    isEditCollectModalOpen,
    setIsEditCollectModalOpen,
    editingCollectRecId,
    editCollectPaymentDate,
    setEditCollectPaymentDate,
    editCollectPaymentNotes,
    setEditCollectPaymentNotes,
    editCollectAmount,
    editCollectDebtorName,
    handleSaveEditCollectPayment,
    formatSoles,
    formatDisplayDate,
    currentDateStr,
    receivables,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();

  if (!isEditCollectModalOpen) return null;

  const onClose = () => setIsEditCollectModalOpen(false);
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  const targetRec = receivables.find(r => r.id === editingCollectRecId);
  const loanDate = targetRec?.loanDate;

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
          maxWidth: '500px',
          width: '100%',
          padding: '24px 26px',
          borderTop: '3px solid var(--accent-success)',
          borderRadius: '16px',
          overflow: 'visible'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-edit-collect-title"
      >
        <div className="modal-drag-zone" {...dragHandleProps}>
          <div className="modal-drag-handle" />
        </div>

        {/* Cabecera */}
        <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--accent-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <ArrowDownLeft size={22} />
            </div>
            <div>
              <h2 id="modal-edit-collect-title" className="modal-title" style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
                Editar Fecha del Cobro
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Ajusta la fecha real en que el dinero ingresó a tu cuenta.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-action-icon"
            onClick={onClose}
            title="Cerrar"
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta de Contexto del Préstamo y Cobro */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '18px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Deudor
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {editCollectDebtorName}
              </div>
              {targetRec?.description && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {targetRec.description}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Monto Recibido
              </div>
              <div className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-success)', marginTop: '2px' }}>
                +{formatSoles(editCollectAmount)}
              </div>
            </div>
          </div>

          {/* Comparativa: Fecha de Desembolso Original */}
          {loanDate && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.76rem',
                color: 'var(--text-muted)'
              }}
            >
              <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span>
                Dinero prestado el: <strong style={{ color: 'var(--text-secondary)' }}>{formatDisplayDate(loanDate)}</strong>
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveEditCollectPayment}>
          {/* Selector de Fecha de Cobranza */}
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <div style={{ marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.84rem' }}>
                Fecha de Cobranza
              </label>
            </div>

            <CustomDatePicker
              value={editCollectPaymentDate}
              onChange={setEditCollectPaymentDate}
            />
          </div>

          {/* Notas / Referencia */}
          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.84rem' }}>
              Notas / Referencia (Opcional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Transferencia BCP, Plin, abono en efectivo..."
              value={editCollectPaymentNotes}
              onChange={e => setEditCollectPaymentNotes(e.target.value)}
            />
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '8px 18px', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={15} />
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
