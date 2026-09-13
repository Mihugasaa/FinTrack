'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';

export const IncomeModal: React.FC = () => {
  const {
    setIsIncomeModalOpen,
    handleAddExtraIncome,
    incomeDesc,
    setIncomeDesc,
    incomeDate,
    setIncomeDate,
    incomeAmount,
    setIncomeAmount,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const onClose = () => setIsIncomeModalOpen(false);
  const onSubmit = handleAddExtraIncome;
  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick(onClose)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
        <div className="modal-title-row">
          <span className="text-h2 font-bold">Registrar Ingreso Extra</span>
          <button id="btn-close-income-modal" className="month-nav-btn modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Descripción del Ingreso</label>
            <input
              id="input-income-desc"
              type="text"
              placeholder="ej. Bono, Venta de producto, Freelance"
              className="form-input"
              required
              value={incomeDesc}
              onChange={e => setIncomeDesc(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha del Ingreso</label>
            <input
              id="input-income-date"
              type="date"
              className="form-input"
              required
              value={incomeDate}
              onChange={e => setIncomeDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monto Ingresado • Soles</label>
            <input
              id="input-income-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="form-input"
              required
              value={incomeAmount}
              onChange={e => setIncomeAmount(e.target.value)}
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
              Agregar a Débito
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
