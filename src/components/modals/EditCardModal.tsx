'use client';

import React from 'react';
import { CreditCard, X, Check } from 'lucide-react';
import { CARD_COLOR_PRESETS } from '@/lib/constants';
import { useFinance } from '@/contexts/FinanceContext';

export const EditCardModal: React.FC = () => {
  const {
    setIsEditCardModalOpen,
    handleSaveEditCard,
    editCardName,
    setEditCardName,
    editCardColor,
    setEditCardColor,
    editCardLimit,
    setEditCardLimit,
    editCardInitialDebt,
    setEditCardInitialDebt,
    editCardCloseDay,
    setEditCardCloseDay,
    editCardDueDay,
    setEditCardDueDay,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const onClose = () => setIsEditCardModalOpen(false);
  const onSubmit = handleSaveEditCard;
  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick(onClose)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
        <div className="modal-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="var(--accent-brand)" />
            <span className="text-h2 font-bold">Editar Tarjeta / Límites</span>
          </div>
          <button className="month-nav-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {/* Previsualización Dinámica de la Tarjeta (Diseño UX Estructurado) */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${editCardColor}18 0%, ${editCardColor}06 100%)`,
              border: `1.5px solid ${editCardColor}35`,
              marginBottom: '16px',
              transition: 'all 0.25s ease'
            }}
          >
            {/* Cabecera de la Tarjeta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: editCardColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: `0 4px 12px ${editCardColor}45`,
                    transition: 'background 0.25s ease'
                  }}
                >
                  <CreditCard size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {editCardName || 'Nombre de la Tarjeta'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Tarjeta de Crédito
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: '6px',
                  background: `${editCardColor}22`,
                  color: editCardColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  border: `1px solid ${editCardColor}30`
                }}
              >
                Estilo Activo
              </span>
            </div>

            {/* Métricas Clave en Bloques/Chips Claros y Legibles */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: `1px solid ${editCardColor}20`
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
                  S/ {parseFloat(editCardLimit || '0').toLocaleString('es-PE')}
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
                  {editCardCloseDay ? `Día ${editCardCloseDay}` : '—'}
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
                  {editCardDueDay ? `Día ${editCardDueDay}` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del Banco o Tarjeta</label>
            <input
              id="input-edit-card-name"
              type="text"
              className="form-input"
              required
              value={editCardName}
              onChange={e => setEditCardName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Selector de Estilo y Color Curado (Bank-Grade Swatches) */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>
              Estilo Visual de la Tarjeta
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {CARD_COLOR_PRESETS.map(preset => {
                const isSelected = (editCardColor || '').toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setEditCardColor(preset.hex)}
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

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Límite de Crédito (S/)</label>
              <input
                id="input-edit-card-limit"
                type="number"
                step="50"
                className="form-input"
                value={editCardLimit}
                onChange={e => setEditCardLimit(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Deuda Pendiente Anterior (S/)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="form-input"
                value={editCardInitialDebt}
                onChange={e => setEditCardInitialDebt(e.target.value)}
                title="Consumos facturados en meses pasados que pagarás en este mes"
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Día de Corte de Ciclo (1 - 31)</label>
              <input
                type="number"
                min="1"
                max="31"
                className="form-input"
                required
                value={editCardCloseDay}
                onChange={e => setEditCardCloseDay(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Día Límite de Pago (1 - 31)</label>
              <input
                type="number"
                min="1"
                max="31"
                className="form-input"
                required
                value={editCardDueDay}
                onChange={e => setEditCardDueDay(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button id="btn-save-edit-card" type="submit" className="btn-primary">
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
