'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Repeat, Trash2, RotateCcw } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

/** Registro que el usuario está por eliminar (gasto, ingreso o préstamo). */
export interface DeleteConfirmItem {
  id: string;
  type: 'transaction' | 'income' | 'receivable' | 'payable';
  description: string;
  amount: number;
  currency?: string;
  date?: string;
  categoryName?: string;
  paymentMethodName?: string;
  paymentMethodColor?: string;
  isFixed?: boolean;
  futureOccurrencesCount?: number;
  collectedAmount?: number;
  collectionsCount?: number;
  linkedTransaction?: { id: string; date: string; amountPen: number };
  payablePaidPen?: number;
  payableCreditedPen?: number;
}

const DELETE_TITLES: Record<DeleteConfirmItem['type'], string> = {
  transaction: '¿Eliminar este gasto?',
  income: '¿Eliminar este ingreso?',
  receivable: '¿Eliminar este préstamo?',
  payable: '¿Eliminar esta deuda?'
};

export const DeleteConfirmModal: React.FC = () => {
  const {
    itemToDelete,
    setItemToDelete,
    handleConfirmDelete,
    handleConfirmDeleteFuture,
    handleRevertReceivableFromDelete,
    handleBackdropMouseDown,
    handleBackdropClick,
    formatDisplayDate,
    formatSoles
  } = useFinance();
  const onClose = () => setItemToDelete(null);
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  // Borrar también la salida vinculada de un préstamo (desmarcado por defecto:
  // solo se elimina lo que el usuario eligió explícitamente).
  const [deleteLinkedTx, setDeleteLinkedTx] = useState(false);
  useEffect(() => {
    setDeleteLinkedTx(false);
  }, [itemToDelete?.id]);

  if (!itemToDelete) return null;
  const item = itemToDelete;
  const onConfirm = () => handleConfirmDelete({ deleteLinkedTransaction: deleteLinkedTx });
  const futureCount = item.futureOccurrencesCount ?? 0;
  const isRecurringWithFuture = item.type === 'transaction' && !!item.isFixed && futureCount > 0;

  // Préstamo con cobros: la acción recomendada es revertirlos, no borrarlo.
  const isReceivable = item.type === 'receivable';
  const collected = isReceivable ? (item.collectedAmount ?? 0) : 0;
  const hasCollections = collected > 0.005;
  const linkedTx = isReceivable ? item.linkedTransaction : undefined;
  const formatItemAmount = (amt: number) => (
    item.currency === 'USD' ? `$ ${amt.toFixed(2)} USD` : formatSoles(amt)
  );

  // Deuda propia: lo que deja de contar en el saldo si se elimina
  const isPayable = item.type === 'payable';
  const payablePaid = isPayable ? (item.payablePaidPen ?? 0) : 0;
  const payableCredited = isPayable ? (item.payableCreditedPen ?? 0) : 0;

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
                {DELETE_TITLES[item.type]}
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {hasCollections
                  ? 'Ya tiene cobros registrados.'
                  : 'Esta acción no se puede deshacer.'}
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
                {formatItemAmount(item.amount)}
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
              <span>Gasto recurrente detectado</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Existen pagos programados en los meses posteriores. Puedes eliminar únicamente el registro de este mes o cancelar los pagos de este mes en adelante.
            </p>
          </div>
        )}

        {/* Deuda propia: qué deja de contar en el saldo al eliminarla */}
        {isPayable && (payablePaid > 0.005 || payableCredited > 0.005) && (
          <div className="delete-alt-notice is-danger">
            <p className="delete-alt-notice-text">
              {payablePaid > 0.005 && `Se borran también sus pagos (${formatSoles(payablePaid)}) y dejan de descontarse de tu saldo. `}
              {payableCredited > 0.005 && `El dinero que entró a tu cuenta (${formatSoles(payableCredited)}) deja de sumar a tu saldo.`}
            </p>
          </div>
        )}

        {/* Préstamo con cobros: revertir es la alternativa que conserva todo */}
        {hasCollections && (
          <div className="delete-alt-notice">
            <div className="delete-alt-notice-title">
              <RotateCcw size={13} />
              <span>
                {formatItemAmount(collected)} cobrados
                {(item.collectionsCount ?? 0) > 1 ? ` en ${item.collectionsCount} abonos` : ''}
              </span>
            </div>
            <p className="delete-alt-notice-text">
              Si reviertes los cobros, el préstamo vuelve a Pendientes y su salida se queda en Movimientos. Eliminarlo borra también su historial.
            </p>
          </div>
        )}

        {/* Préstamo con salida vinculada: decidir si también se borra el desembolso */}
        {linkedTx && (
          <label className="delete-linked-option" htmlFor="chk-delete-linked-tx">
            <input
              type="checkbox"
              id="chk-delete-linked-tx"
              checked={deleteLinkedTx}
              onChange={e => setDeleteLinkedTx(e.target.checked)}
            />
            <span className="delete-linked-option-copy">
              <strong>{hasCollections ? 'Si lo eliminas, borrar también su salida' : 'Borrar también su salida en Movimientos'}</strong>
              <span>
                {formatSoles(linkedTx.amountPen)} del {formatDisplayDate(linkedTx.date)}. Si la dejas, sigue descontada de tu saldo.
              </span>
            </span>
          </label>
        )}

        {/* Botones de Acción */}
        {hasCollections ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              <button
                id="btn-revert-receivable-collections"
                type="button"
                className="btn-primary"
                onClick={handleRevertReceivableFromDelete}
                style={{ padding: '10px 14px', fontSize: '0.825rem' }}
                title="Quitar los cobros y devolver el préstamo a Pendientes"
              >
                <RotateCcw size={14} />
                <span>Revertir cobros</span>
              </button>
              <button
                id="btn-confirm-delete"
                type="button"
                className="btn-danger-confirm"
                onClick={onConfirm}
                style={{ padding: '10px 14px', fontSize: '0.825rem' }}
                title="Borrar el préstamo y su historial de cobros"
              >
                <Trash2 size={14} />
                <span>Eliminar préstamo</span>
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
        ) : isRecurringWithFuture ? (
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
                title="Eliminar este gasto y todas sus repeticiones futuras"
              >
                <Trash2 size={14} />
                <span>De aquí en adelante</span>
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
