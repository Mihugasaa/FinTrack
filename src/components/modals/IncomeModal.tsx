'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { useFinance } from '@/contexts/FinanceContext';

export const IncomeModal: React.FC = () => {
  const {
    setIsIncomeModalOpen,
    addExtraIncome,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();

  // Estado del formulario local al modal: teclear aquí no re-renderiza el dashboard.
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  const onClose = () => setIsIncomeModalOpen(false);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addExtraIncome(incomeDesc, incomeAmount, incomeDate);
  };
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
            <CustomDatePicker
              id="input-income-date"
              value={incomeDate}
              onChange={setIncomeDate}
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
