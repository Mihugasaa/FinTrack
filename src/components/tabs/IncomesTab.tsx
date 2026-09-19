'use client';

import React from 'react';
import {
  Plus,
  Building2,
  Briefcase,
  Coins,
  Trash2,
  PieChart
} from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { getEffectiveDayOfMonth } from '@/lib/calculations';

export const IncomesTab: React.FC = () => {
  const {
    monthNames,
    currentMonth,
    currentYear,
    setIsIncomeModalOpen,
    setIsSalaryModalOpen,
    totalSalaryAmount,
    currentOtherIncomes,
    debitStats,
    diagnostic,
    salaries,
    setSalarySource,
    setSalaryAmount,
    setSalaryPayDay,
    setItemToDelete,
    fixedExpensesTotal,
    formatDisplayDate,
    formatSoles
  } = useFinance();
  const totalOtherIncomes = currentOtherIncomes.reduce((a, b) => a + b.amount, 0);
  const totalIncome = totalSalaryAmount + totalOtherIncomes;

  // Cálculos 100% dinámicos en base a datos reales (sin valores hardcodeados)
  const fixedExpenses = fixedExpensesTotal;
  // Total consumido del mes (fijos + variables, neto de reembolsos), tomado del
  // diagnóstico de liquidez. Así el desglose de la barra separa correctamente el
  // gasto variable en vez de dejarlo siempre en 0.
  const consumedTotal = diagnostic.totalExpensesConsumed;
  const variableExpenses = Math.max(0, consumedTotal - fixedExpenses);
  const estimatedMargin = Math.max(0, totalIncome - consumedTotal);

  const baseForBar = Math.max(totalIncome, fixedExpenses + variableExpenses + estimatedMargin, 1);
  const pctFixed = Math.round((fixedExpenses / baseForBar) * 100);
  const pctVar = Math.round((variableExpenses / baseForBar) * 100);
  const pctMargin = Math.max(0, 100 - pctFixed - pctVar);

  const totalSourcesCount = salaries.length + currentOtherIncomes.length;

  return (
    <section className="incomes-panel clean-card panel-body">
      {/* Cabecera */}
      <div className="panel-header">
        <div>
          <h2 className="panel-header-title">
            Mis Ingresos y Sueldos • {monthNames[currentMonth]} {currentYear}
          </h2>
          <p className="panel-header-subtitle">
            Gestión y fechas de abono de nómina, sueldos fijos e ingresos extraordinarios
          </p>
        </div>
        <div className="action-group">
          <button id="btn-add-extra-income" className="btn-secondary" onClick={() => setIsIncomeModalOpen(true)}>
            <Plus size={15} />
            <span>Ingreso Extra</span>
          </button>
          <button id="btn-config-salary" className="btn-primary" onClick={() => setIsSalaryModalOpen(true)}>
            <Building2 size={15} />
            <span>Configurar Sueldo</span>
          </button>
        </div>
      </div>

      {/* 3 KPIs Superiores Nivelados */}
      <div className="stats-grid-3">
        <div className="metric-stat-card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
          <span className="text-caption text-muted">
            Total Ingresos Previstos
          </span>
          <div className="tabular-nums text-h1 font-bold text-success" style={{ marginTop: '4px' }}>
            {formatSoles(totalIncome)}
          </div>
          <span className="text-body-sm text-muted">
            Nómina: {formatSoles(totalSalaryAmount)} + Extras: {formatSoles(totalOtherIncomes)}
          </span>
        </div>

        <div className="metric-stat-card" style={{ borderLeft: '4px solid var(--border-medium)' }}>
          <span className="text-caption text-muted">
            Acreditado en Cuenta Hoy
          </span>
          <div className="tabular-nums text-h1 font-bold text-primary" style={{ marginTop: '4px' }}>
            {formatSoles(debitStats.salariesReceivedToday + debitStats.otherIncomesReceivedToday)}
          </div>
          <span className="text-body-sm text-muted">
            {debitStats.isSalaryCreditedToday
              ? 'Nómina acreditada en cuenta'
              : 'Cobrado efectivamente a la fecha'}
          </span>
        </div>

        <div className="metric-stat-card" style={{ borderLeft: '4px solid var(--accent-warning)' }}>
          <span className="text-caption text-muted">
            Por Acreditar a Fin de Mes
          </span>
          <div
            className="tabular-nums text-h1 font-bold"
            style={{
              color: debitStats.salariesPending > 0 ? 'var(--accent-warning)' : 'var(--text-muted)',
              marginTop: '4px'
            }}
          >
            {formatSoles(debitStats.salariesPending)}
          </div>
          <span className="text-body-sm text-muted">
            {debitStats.salariesPending > 0
              ? `Abono programado: Día ${debitStats.salaryPayDay} de ${monthNames[currentMonth]}`
              : 'Nómina completada'}
          </span>
        </div>
      </div>

      {/* Grid 50/50 Principal Nivelado (Armonía Zen) */}
      <div className="overview-grid-balanced" style={{ marginBottom: 0 }}>
        {/* Columna Izquierda: Fuentes de Ingreso Registradas (Nómina & Extras) */}
        <div className="clean-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: 0 }}>
          <div>
            <div className="section-header" style={{ marginBottom: '16px' }}>
              <h3 className="section-title">
                <Building2 size={16} color="var(--accent-brand)" />
                <span>Fuentes de Ingreso Registradas • {totalSourcesCount}</span>
              </h3>
              <span className="badge badge-neutral">{monthNames[currentMonth]}</span>
            </div>

            {totalSourcesCount === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '10px', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No hay ingresos registrados para este mes.
              </div>
            ) : (
              <div>
                {/* 1. Sueldos Fijos / Nómina */}
                {salaries.map(sal => (
                  <div key={sal.id} className="income-item-row">
                    <div className="income-item-left">
                      <div className="income-icon-wrap icon-salary" title="Nómina Laboral Fija">
                        <Briefcase size={18} />
                      </div>
                      <div>
                        <div className="income-item-name">{sal.source}</div>
                        <div className="income-item-date">
                          Fecha de abono: Día {sal.payDay} de cada mes
                        </div>
                      </div>
                    </div>

                    <div className="income-item-right">
                      <span className="income-item-amount tabular-nums text-primary">
                        {formatSoles(sal.amount)}
                      </span>
                      {debitStats.isSalaryCreditedToday ? (
                        <span className="badge badge-success">Acreditado</span>
                      ) : (
                        <span className="badge badge-warning">
                          Se abona {getEffectiveDayOfMonth(currentYear, currentMonth, sal.payDay)}/{currentMonth.toString().padStart(2, '0')}
                        </span>
                      )}
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => {
                          setSalarySource(sal.source);
                          setSalaryAmount(sal.amount.toString());
                          setSalaryPayDay(sal.payDay.toString());
                          setIsSalaryModalOpen(true);
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))}

                {/* 2. Ingresos Extraordinarios */}
                {currentOtherIncomes.map(inc => (
                  <div key={inc.id} className="income-item-row">
                    <div className="income-item-left">
                      <div className="income-icon-wrap icon-extra" title="Ingreso Extraordinario">
                        <Coins size={18} />
                      </div>
                      <div>
                        <div className="income-item-name">{inc.description}</div>
                        <div className="income-item-date">
                          Abonado el: {formatDisplayDate(inc.receivedDate)}
                        </div>
                      </div>
                    </div>

                    <div className="income-item-right">
                      <span className="income-item-amount tabular-nums text-success">
                        +{formatSoles(inc.amount)}
                      </span>
                      <span className="badge badge-success">Acreditado</span>
                      <button
                        className="btn-action-icon"
                        onClick={() => {
                          setItemToDelete({
                            id: inc.id,
                            type: 'income',
                            description: inc.description,
                            amount: inc.amount,
                            date: inc.receivedDate,
                            categoryName: 'Ingreso Extra'
                          });
                        }}
                        title="Eliminar ingreso"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pie de ayuda sutil que equilibra la altura */}
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', paddingTop: '12px', borderTop: '1px dashed var(--border-subtle)', marginTop: '16px' }}>
            💡 Los sueldos se reflejan automáticamente en tu liquidez bancaria al cumplirse su día de abono programado.
          </div>
        </div>

        {/* Columna Derecha: Panel de Destino del Sueldo & Salud Financiera (100% Dinámico) */}
        <div className="clean-card" style={{ padding: '22px', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: 0 }}>
          <div>
            <div className="section-header" style={{ marginBottom: '14px' }}>
              <h3 className="section-title">
                <PieChart size={16} color="var(--accent-brand)" />
                <span>Destino y Salud del Sueldo</span>
              </h3>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Dinámico</span>
            </div>

            <p className="text-body-sm text-muted" style={{ marginBottom: '14px' }}>
              Distribución calculada de tus ingresos netos entre obligaciones fijas y margen libre:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="dest-row">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="dest-dot" style={{ background: 'var(--accent-danger)' }} />
                  Gastos Fijos Comprometidos
                </span>
                <strong className="tabular-nums text-primary">{formatSoles(fixedExpenses)}</strong>
              </div>

              <div className="dest-row">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="dest-dot" style={{ background: 'var(--accent-warning)' }} />
                  Gastos Variables / Tarjetas
                </span>
                <strong className="tabular-nums text-primary">{formatSoles(variableExpenses)}</strong>
              </div>

              <div className="dest-row">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="dest-dot" style={{ background: 'var(--accent-success)' }} />
                  Margen Disponible Estimado
                </span>
                <strong className="tabular-nums text-success">{formatSoles(estimatedMargin)}</strong>
              </div>

              {/* Barra dinámica proporcional sin valores fijos */}
              <div className="dest-bar">
                <div style={{ width: `${pctFixed}%`, background: 'var(--accent-danger)' }} title={`Fijos: ${pctFixed}%`} />
                <div style={{ width: `${pctVar}%`, background: 'var(--accent-warning)' }} title={`Variables: ${pctVar}%`} />
                <div style={{ width: `${pctMargin}%`, background: 'var(--accent-success)' }} title={`Margen: ${pctMargin}%`} />
              </div>
            </div>
          </div>

          <div className="next-pay-card">
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-brand)' }}>
              Próximo Abono Programado
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginTop: '2px' }}>
              Día {debitStats.salaryPayDay} de {monthNames[currentMonth]}
            </div>
            <div className="text-body-sm text-muted" style={{ marginTop: '2px' }}>
              {debitStats.isSalaryCreditedToday
                ? 'Nómina ya acreditada en tu cuenta de débito.'
                : `Monto por ingresar a tu cuenta: ${formatSoles(debitStats.salariesPending)}`}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
