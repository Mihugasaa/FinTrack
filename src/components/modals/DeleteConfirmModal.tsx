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
  futureOccurrencesCount?: number;
}

export const DeleteConfirmModal: React.FC = () => {
  const {
    itemToDelete,
    setItemToDelete,
    handleConfirmDelete,
    handleConfirmDeleteFuture,
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
  const futureCount = item.futureOccurrencesCount ?? 0;
  const isRecurringWithFuture = item.type === 'transaction' && !!item.isFixed && futureCount > 0;

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

        {/* Aviso de repeticiones de suscripción recurrente */}
        {isRecurringWithFuture && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-danger)' }}>
              <Repeat size={13} />
              <span>Suscripción recurrente detectada</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Existen <strong>{futureCount} {futureCount === 1 ? 'repetición programada' : 'repeticiones programadas'}</strong> en los meses posteriores de este año. Puedes eliminar únicamente el registro de este mes o cancelar la suscripción de este mes en adelante.
            </p>
          </div>
        )}

        {/* Botones de Acción */}
        {isRecurringWithFuture ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <button
                id="btn-confirm-delete-single"
                type="button"
                className="btn-secondary"
                onClick={onConfirm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Eliminar únicamente el registro de este mes puntual"
              >
                <Trash2 size={14} />
                <span>Solo este mes</span>
              </button>
              <button
                id="btn-confirm-delete-future"
                type="button"
                className="btn-danger-confirm"
                onClick={handleConfirmDeleteFuture}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Eliminar este gasto y todas sus repeticiones futuras hasta fin de año"
              >
                <Trash2 size={14} />
                <span>De aquí en adelante ({futureCount + 1} meses)</span>
              </button>
            </div>
            <button
              id="btn-cancel-delete"
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{
                alignSelf: 'center',
                fontSize: '0.8rem',
                padding: '6px 18px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};
