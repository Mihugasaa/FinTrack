'use client';

import React from 'react';
import { X, CreditCard, Wallet, Check } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { CARD_COLOR_PRESETS } from '@/lib/constants';

interface CardModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newCardName: string;
  setNewCardName: (v: string) => void;
  newCardType: 'credit' | 'debit';
  setNewCardType: (v: 'credit' | 'debit') => void;
  newCardColor: string;
  setNewCardColor: (v: string) => void;
  newCardLimit: string;
  setNewCardLimit: (v: string) => void;
  newCardCloseDay: string;
  setNewCardCloseDay: (v: string) => void;
  newCardDueDay: string;
  setNewCardDueDay: (v: string) => void;
  newCardInitialDebt: string;
  setNewCardInitialDebt: (v: string) => void;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const CardModal: React.FC<CardModalProps> = ({
  onClose,
  onSubmit,
  newCardName,
  setNewCardName,
  newCardType,
  setNewCardType,
  newCardColor,
  setNewCardColor,
  newCardLimit,
  setNewCardLimit,
  newCardCloseDay,
  setNewCardCloseDay,
  newCardDueDay,
  setNewCardDueDay,
  newCardInitialDebt,
  setNewCardInitialDebt,
  handleBackdropMouseDown,
  handleBackdropClick
}) => {
  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick(onClose)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
        <div className="modal-title-row">
          <span className="text-h2 font-bold">Agregar Tarjeta o Medio de Pago</span>
          <button className="month-nav-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {/* Previsualización Dinámica (Diseño UX Estructurado) */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${newCardColor}18 0%, ${newCardColor}06 100%)`,
              border: `1.5px solid ${newCardColor}35`,
              marginBottom: '16px',
              transition: 'all 0.25s ease'
            }}
          >
            {/* Cabecera de la Tarjeta / Cuenta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: newCardColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: `0 4px 12px ${newCardColor}45`,
                    transition: 'background 0.25s ease'
                  }}
                >
                  <CreditCard size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {newCardName || 'Nueva Cuenta o Tarjeta'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {newCardType === 'credit' ? 'Tarjeta de Crédito' : 'Cuenta Débito / Líquida'}
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: '6px',
                  background: `${newCardColor}22`,
                  color: newCardColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  border: `1px solid ${newCardColor}30`
                }}
              >
                {newCardType === 'credit' ? 'Crédito' : 'Débito'}
              </span>
            </div>

            {/* Métricas Clave o Estado según tipo */}
            {newCardType === 'credit' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: `1px solid ${newCardColor}20`
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Límite
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    S/ {parseFloat(newCardLimit || '0').toLocaleString('es-PE')}
                  </span>
                </div>

                <div
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Corte
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {newCardCloseDay ? `Día ${newCardCloseDay}` : '—'}
                  </span>
                </div>

                <div
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Pago
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {newCardDueDay ? `Día ${newCardDueDay}` : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: `1px solid ${newCardColor}20`,
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>💡 Saldo disponible directo sin ciclo de facturación ni intereses.</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del Medio o Banco</label>
            <input
              type="text"
              placeholder="ej. TC BBVA, TC Ripley, Débito BCP"
              className="form-input"
              required
              value={newCardName}
              onChange={e => setNewCardName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Tipo de Cuenta</label>
            <CustomSelect
              id="select-card-type"
              value={newCardType}
              onChange={val => setNewCardType(val as 'credit' | 'debit')}
              options={[
                { value: 'credit', label: 'Tarjeta de Crédito', subtitle: 'Línea de crédito, pagos y deuda', icon: <CreditCard size={15} style={{ color: '#818cf8' }} /> },
                { value: 'debit', label: 'Débito / Efectivo', subtitle: 'Cuenta de ahorros, saldo disponible', icon: <Wallet size={15} style={{ color: '#34d399' }} /> }
              ]}
            />
          </div>


          {/* Selector de Estilo y Color Curado (Bank-Grade Swatches) */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>
              Estilo Visual de la Tarjeta
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {CARD_COLOR_PRESETS.map(preset => {
                const isSelected = (newCardColor || '').toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setNewCardColor(preset.hex)}
                    title={preset.label}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: preset.hex,
                      border: isSelected ? '2.5px solid var(--text-primary)' : '2px solid transparent',
                      boxShadow: isSelected ? `0 0 0 2px var(--bg-surface), 0 3px 8px ${preset.hex}60` : '0 1px 3px rgba(0,0,0,0.12)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                      padding: 0
                    }}
                  >
                    {isSelected && <Check size={16} color="#ffffff" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {newCardType === 'credit' && (
            <>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Día de Corte (1 - 31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="form-input"
                    required
                    value={newCardCloseDay}
                    onChange={e => setNewCardCloseDay(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Día de Pago (1 - 31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="form-input"
                    required
                    value={newCardDueDay}
                    onChange={e => setNewCardDueDay(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Límite de Crédito (S/)</label>
                <input
                  type="number"
                  step="100"
                  className="form-input"
                  value={newCardLimit}
                  onChange={e => setNewCardLimit(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Deuda Previa Arrastrada (S/)
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                    (opcional: si ya tienes consumos de meses previos pendientes de pago)
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="form-input"
                  value={newCardInitialDebt}
                  onChange={e => setNewCardInitialDebt(e.target.value)}
                />
              </div>
            </>
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
              Crear Tarjeta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
