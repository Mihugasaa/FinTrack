'use client';

import React from 'react';
import { Building2, X, Sparkles } from 'lucide-react';

interface SalaryModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  salarySource: string;
  setSalarySource: (v: string) => void;
  salaryAmount: string;
  setSalaryAmount: (v: string) => void;
  salaryPayDay: string;
  setSalaryPayDay: (v: string) => void;
  monthNames: string[];
  currentMonth: number;
  currentYear: number;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SalaryModal: React.FC<SalaryModalProps> = ({
  onClose,
  onSubmit,
  salarySource,
  setSalarySource,
  salaryAmount,
  setSalaryAmount,
  salaryPayDay,
  setSalaryPayDay,
  monthNames,
  currentMonth,
  currentYear,
  handleBackdropMouseDown,
  handleBackdropClick
}) => {
  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick(onClose)}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-handle" />
        <div className="modal-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="var(--accent-brand)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Configurar Sueldo / Nómina</h3>
          </div>
          <button className="btn-action-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Empresa / Empleo</label>
            <input
              type="text"
              placeholder="ej. Empleo Principal, Empresa SAC"
              className="form-input"
              required
              value={salarySource}
              onChange={e => setSalarySource(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monto Neto Mensual (S/)</label>
            <input
              type="number"
              step="0.01"
              placeholder="2126.49"
              className="form-input"
              required
              value={salaryAmount}
              onChange={e => setSalaryAmount(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Día del mes en que te abonan</label>
            <input
              type="number"
              min="1"
              max="31"
              placeholder="30 (último día hábil o día 25)"
              className="form-input"
              required
              value={salaryPayDay}
              onChange={e => setSalaryPayDay(e.target.value)}
            />
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Permite calcular tu dinero disponible real si estás a mitad de mes antes del pago.
            </span>
          </div>

          <div
            style={{
              background: 'var(--accent-brand-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            <Sparkles size={16} color="var(--accent-brand)" style={{ flexShrink: 0 }} />
            <span>
              <strong>Vigencia:</strong> Aplica a partir de <strong>{monthNames[currentMonth]} {currentYear}</strong> en adelante. Tus meses históricos anteriores conservan su registro original intacto.
            </span>
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
              Guardar Sueldo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
