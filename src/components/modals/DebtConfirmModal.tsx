'use client';

import React, { useEffect } from 'react';
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Calendar,
  Wallet,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

export const DebtConfirmModal: React.FC = () => {
  const {
    debtConfirmData,
    setDebtConfirmData,
    formatDisplayDate,
    formatSoles,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();

  const onClose = () => setDebtConfirmData(null);
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  // Soporte para tecla Esc (cerrar/volver)
  useEffect(() => {
    if (!debtConfirmData) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debtConfirmData]);

  if (!debtConfirmData) return null;

  const item = debtConfirmData;
  const isPayable = item.type === 'payable';
  const isUsd = item.currency === 'USD';
  const isFullySettled = item.newRemaining <= 0;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 1060 }}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick(onClose)}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <div
        ref={modalBoxRef}
        className="modal-box"
        style={{
          maxWidth: '530px',
          width: '100%',
          padding: '22px 26px',
          borderTop: isPayable ? '3px solid var(--accent-warning)' : '3px solid var(--accent-success)',
          borderRadius: '16px'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-debt-confirm-title"
      >
        <div className="modal-drag-zone" {...dragHandleProps}>
          <div className="modal-drag-handle" />
        </div>

        {/* Header con Icono Temático y Botón Cerrar */}
        <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: isPayable ? 'rgba(245, 158, 11, 0.14)' : 'rgba(16, 185, 129, 0.12)',
                color: isPayable ? 'var(--accent-warning)' : 'var(--accent-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isPayable ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
            </div>
            <div>
              <h2 id="modal-debt-confirm-title" className="modal-title" style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {item.title || (isPayable ? '¿Confirmar Amortización de Deuda?' : '¿Confirmar Cobranza de Préstamo?')}
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                {isPayable
                  ? (isFullySettled
                      ? 'Verifica los detalles antes de liquidar el saldo total de tu acreedor.'
                      : 'Verifica los detalles antes de registrar la salida de dinero de tu cuenta.')
                  : (isFullySettled
                      ? 'Verifica los detalles antes de registrar el cobro total del saldo pendiente.'
                      : 'Verifica los detalles antes de registrar el ingreso de dinero a tu cuenta.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-action-icon"
            onClick={onClose}
            title={item.isDirectAction ? 'Cancelar' : 'Volver al formulario'}
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta de Resumen Financiero con Espaciado Generoso */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '16px'
          }}
        >
          {/* Fila: Destinatario / Origen */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isPayable ? 'Acreedor (A quien debes)' : 'Deudor (A quien prestaste)'}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {item.partyName}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.35' }}>
                {item.description}
              </div>
            </div>
            <span
              className={isPayable ? 'badge badge-warning' : 'badge badge-success'}
              style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '8px', flexShrink: 0 }}
            >
              {isPayable ? 'Deuda Mía' : 'Préstamo por Cobrar'}
            </span>
          </div>

          {/* Banner de Monto de la Operación */}
          <div
            style={{
              padding: '11px 14px',
              borderRadius: '10px',
              background: isPayable ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)',
              border: isPayable ? '1px solid rgba(239, 68, 68, 0.16)' : '1px solid rgba(16, 185, 129, 0.16)',
              marginBottom: '14px'
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: isPayable ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
              {isPayable ? 'Monto a Debitar de tu Cuenta' : 'Monto a Acreditar en tu Cuenta'}
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: isPayable ? 'var(--accent-danger)' : 'var(--accent-success)',
                letterSpacing: '-0.02em',
                marginTop: '2px'
              }}
            >
              {isPayable ? '-' : '+'}
              {isUsd ? `$ ${item.amount.toFixed(2)} USD` : formatSoles(item.amount)}
            </div>
            {isUsd && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Contravalor en Soles: -{formatSoles(item.amountPen)}
              </div>
            )}
          </div>

          {/* Detalles Técnicos de la Operación */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Calendar size={15} color="var(--accent-brand)" />
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Fecha de Registro:</span>
                <strong style={{ fontSize: '0.825rem' }}>{formatDisplayDate(item.date)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Wallet size={15} color="#10b981" />
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Medio Afectado:</span>
                <strong style={{ color: '#10b981', fontSize: '0.825rem' }}>Cuenta Débito</strong>
              </div>
            </div>
          </div>

          {/* Impacto en el Saldo Pendiente del Compromiso */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Saldo Restante Posterior:</span>
              <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem', color: isFullySettled ? 'var(--accent-success)' : 'var(--text-primary)' }}>
                {isUsd ? `$ ${item.newRemaining.toFixed(2)} USD` : formatSoles(item.newRemaining)}
              </span>
            </div>

            {isFullySettled ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--accent-success)',
                  background: 'rgba(16, 185, 129, 0.14)',
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}
              >
                <CheckCircle2 size={13} />
                <span>¡Quedará 100% saldado!</span>
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Amortización parcial
              </span>
            )}
          </div>

          {/* Notas / Observaciones si existen */}
          {item.notes && (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px dashed var(--border-subtle)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FileText size={13} />
              <span>Notas: <em>{item.notes}</em></span>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '9px 18px', fontSize: '0.85rem' }}
            onClick={onClose}
          >
            {item.isDirectAction ? 'Cancelar' : 'Volver a editar'}
          </button>

          <button
            id="btn-confirm-debt-payment"
            type="button"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: isPayable
                ? 'linear-gradient(135deg, #d97706, #b45309)'
                : 'linear-gradient(135deg, #059669, #047857)',
              borderColor: isPayable ? '#b45309' : '#047857',
              boxShadow: isPayable ? '0 2px 8px rgba(217, 119, 6, 0.25)' : '0 2px 8px rgba(5, 150, 105, 0.25)'
            }}
            onClick={() => item.onConfirm()}
          >
            <Coins size={14} />
            <span>
              {isPayable
                ? (isFullySettled ? 'Sí, Liquidar Todo' : 'Sí, Confirmar y Debitar')
                : (isFullySettled ? 'Sí, Cobrar Todo' : 'Sí, Confirmar Cobranza')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
