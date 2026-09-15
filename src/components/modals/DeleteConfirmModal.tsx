'use client';

import React from 'react';
import { AlertTriangle, X, Repeat, Trash2 } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

/** Registro que el usuario está por eliminar (gasto, ingreso o préstamo). */
export interface DeleteConfirmItem {
  id: string;
  type: 'transaction' | 'income' | 'receivable';
  description: string;
  amount: number;
  currency?: string;
  date?: string;
  categoryName?: string;
  paymentMethodName?: string;
  paymentMethodColor?: string;
  isFixed?: boolean;
}

export const DeleteConfirmModal: React.FC = () => {
  const {
    itemToDelete,
    setItemToDelete,
    handleConfirmDelete,
    handleBackdropMouseDown,
    handleBackdropClick,
    formatDisplayDate,
    formatSoles
  } = useFinance();
  const onClose = () => setItemToDelete(null);
  const onConfirm = handleConfirmDelete;
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  if (!itemToDelete) return null;
  const item = itemToDelete;
  return (
    <div
      className="modal-overlay"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick(onClose)}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <div
        ref={modalBoxRef}
        className="modal-box modal-confirm-delete"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-delete-title"
      >
        <div className="modal-drag-zone" {...dragHandleProps}>
          <div className="modal-drag-handle" />
        </div>
        <div className="modal-header" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="delete-warning-icon">
              <AlertTriangle size={20} color="var(--accent-danger)" />
            </div>
            <div>
              <h2 id="modal-delete-title" className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                ¿Eliminar este {item.type === 'transaction' ? 'gasto' : item.type === 'income' ? 'ingreso' : 'préstamo'}?
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                Esta acción no se puede deshacer y se actualizará en la base de datos.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-action-icon"
            onClick={onClose}
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta de Resumen del Registro a Eliminar */}
        <div className="delete-summary-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {item.description}
                </span>
                {item.isFixed && (
                  <span className="badge-fixed-tag">
                    <Repeat size={10} /> Fijo
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '6px', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {item.date && <span>{formatDisplayDate(item.date)}</span>}
                {item.paymentMethodName && (
                  <>
                    <span>•</span>
                    <span style={{ color: item.paymentMethodColor || 'inherit', fontWeight: 600 }}>
                      {item.paymentMethodName}
                    </span>
                  </>
                )}
                {item.categoryName && (
                  <>
                    <span>•</span>
                    <span>{item.categoryName}</span>
                  </>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-danger)' }} className="tabular-nums">
                {formatSoles(item.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button
            id="btn-cancel-delete"
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ minWidth: '95px' }}
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-delete"
            type="button"
            className="btn-danger-confirm"
            onClick={onConfirm}
            style={{ minWidth: '125px' }}
          >
            <Trash2 size={15} />
            <span>Sí, Eliminar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
