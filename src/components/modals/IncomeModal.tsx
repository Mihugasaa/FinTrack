'use client';

import React from 'react';
import { X } from 'lucide-react';

interface IncomeModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  incomeDesc: string;
  setIncomeDesc: (v: string) => void;
  incomeDate: string;
  setIncomeDate: (v: string) => void;
  incomeAmount: string;
  setIncomeAmount: (v: string) => void;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({
  onClose,
  onSubmit,
  incomeDesc,
  setIncomeDesc,
  incomeDate,
  setIncomeDate,
  incomeAmount,
  setIncomeAmount,
  handleBackdropMouseDown,
  handleBackdropClick
}) => {
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
