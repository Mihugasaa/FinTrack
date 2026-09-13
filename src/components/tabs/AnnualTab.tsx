'use client';

import React, { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';

interface MonthDetailRecord {
  id: string;
  name: string;
  isProjected: boolean;
  income: number;
  consumedExpenses: number;
  cashOut: number;
  surplus: number;
  savingsRatePct: number;
  statusText: string;
  statusType: 'green' | 'red' | 'blue';
  cardType: 'green' | 'red' | 'blue';
}

export const AnnualTab: React.FC = () => {
  const {
    monthlyHistoricalFlow,
    annualCategoryBreakdown,
    cardDebtSummary,
    currentYear,
    formatSoles
  } = useFinance();
  const [filterMode, setFilterMode] = useState<'all' | 'closed'>('all');
  const [visualTab, setVisualTab] = useState<'flow' | 'categories'>('flow');

  // Meses reales derivados del flujo consolidado del usuario.
  const activeMonthsData = useMemo<MonthDetailRecord[]>(() => {
    return monthlyHistoricalFlow.map(f => {
      const savingsPct = f.inVal > 0 ? Math.round((f.savings / f.inVal) * 100) : 0;
      const isPositive = f.savings >= 0;
      return {
        id: f.key,
        name: f.label,
        isProjected: f.isProjected,
        income: f.inVal,
        consumedExpenses: f.consumed,
        cashOut: f.outVal,
        surplus: f.savings,
        savingsRatePct: savingsPct,
        statusText: isPositive ? 'Superávit' : 'Ajustado',
        statusType: isPositive ? 'green' : 'red',
        cardType: isPositive ? 'green' : 'red'
      };
    });
  }, [monthlyHistoricalFlow]);

  // Filtrado de meses
  const displayedMonths = useMemo(() => {
    if (filterMode === 'closed') {
      return activeMonthsData.filter(m => !m.isProjected);
    }
    return activeMonthsData;
  }, [filterMode, activeMonthsData]);

  const closedCount = useMemo(() => activeMonthsData.filter(m => !m.isProjected).length, [activeMonthsData]);

  // Totales dinámicos según filtro
  const totals = useMemo(() => {
    const totalIncome = displayedMonths.reduce((acc, m) => acc + m.income, 0);
    const totalConsumed = displayedMonths.reduce((acc, m) => acc + m.consumedExpenses, 0);
    const totalCashOut = displayedMonths.reduce((acc, m) => acc + m.cashOut, 0);
    const totalSurplus = displayedMonths.reduce((acc, m) => acc + m.surplus, 0);
    const effectiveSavingsRate = totalIncome > 0 ? (totalSurplus / totalIncome) * 100 : 0;

    return {
      income: totalIncome,
      consumed: totalConsumed,
      cashOut: totalCashOut,
      surplus: totalSurplus,
      savingsRate: effectiveSavingsRate
    };
  }, [displayedMonths]);

  // Hitos reales del periodo mostrado (récord de ahorro, mayor salida y colchón).
  const highlights = useMemo(() => {
    if (displayedMonths.length === 0) {
      return { bestSaving: null as MonthDetailRecord | null, biggestOut: null as MonthDetailRecord | null };
    }
    const bestSaving = displayedMonths.reduce((best, m) => (m.surplus > best.surplus ? m : best), displayedMonths[0]);
    const biggestOut = displayedMonths.reduce((top, m) => (m.cashOut > top.cashOut ? m : top), displayedMonths[0]);
    return { bestSaving, biggestOut };
  }, [displayedMonths]);

  // Macro KPIs Dinámicos
  const heroSavingsRate = Number(totals.savingsRate.toFixed(1));
  const heroSurplus = totals.surplus;
  const totalAnnualIncome = totals.income;
  const totalAnnualCashOut = totals.cashOut;
  const cashOutCommittedPct = totalAnnualIncome > 0 ? (totalAnnualCashOut / totalAnnualIncome) * 100 : 0;

  // Deuda de tarjetas gestionada a la fecha, derivada del resumen real por tarjeta.
  const cardStats = useMemo(() => {
    const obligations = cardDebtSummary.reduce((acc, c) => acc + (c.consumedToDate || 0) + (c.initialDebt || 0), 0);
    const paid = cardDebtSummary.reduce((acc, c) => acc + (c.paidToDate || 0), 0);
    const liquidatedPct = obligations > 0 ? Math.min(100, (paid / obligations) * 100) : 0;
    return { paid, liquidatedPct };
  }, [cardDebtSummary]);

  // Donut de categorías del año (consumos devengados reales del año visible).
  const categoryList = useMemo(() => {
    const sum = annualCategoryBreakdown.reduce((acc, c) => acc + c.total, 0);
    return annualCategoryBreakdown.slice(0, 5).map(c => ({
      name: c.category.name,
      total: c.total,
      pct: sum > 0 ? (c.total / sum) * 100 : 0,
      color: c.category.color || '#3b82f6'
    }));
  }, [annualCategoryBreakdown]);

  const annualCategoryTotal = useMemo(
    () => annualCategoryBreakdown.reduce((acc, c) => acc + c.total, 0),
    [annualCategoryBreakdown]
  );

  // SVG Donut calculation
  const donutCircumference = 238.76;
  const donutSlices = useMemo(() => {
    let accumulated = 0;
    return categoryList.map(item => {
      const sliceLength = (item.pct / 100) * donutCircumference;
      const offset = accumulated;
      accumulated += sliceLength;
      return {
        ...item,
        dashArray: `${sliceLength.toFixed(2)} ${(donutCircumference - sliceLength).toFixed(2)}`,
        dashOffset: -offset
      };
    });
  }, [categoryList]);

  // Datos para gráfico de barras de flujo (mismo flujo real consolidado).
  const flowItems = monthlyHistoricalFlow;

  // Escala del gráfico: el mayor de ingreso o salida entre los meses, con margen.
  const maxFlowVal = useMemo(() => {
    const peak = flowItems.reduce((max, m) => Math.max(max, m.inVal, m.outVal), 0);
    return peak > 0 ? peak * 1.1 : 1;
  }, [flowItems]);

  return (
    <section className="annual-summary-panel clean-card panel-body">
      {/* Header Zen */}
      <div className="annual-header">
        <div className="annual-title-group">
          <div className="annual-title-row">
            <h2 className="annual-title">Consolidado y Salud Financiera {currentYear}</h2>
            <span className="annual-chip-audit">
              {displayedMonths.length} {displayedMonths.length === 1 ? 'Periodo Auditado' : 'Periodos Auditados'}
            </span>
          </div>
          <p className="annual-subtitle">
            Evolución mes a mes de ingresos efectivos, salidas de caja, capacidad de ahorro y proyecciones.
          </p>
        </div>

        <div className="segmented-tabs-wrap">
          <button
            type="button"
            className={`segmented-tab-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            <span>Consolidado {currentYear}</span>
          </button>
          <button
            type="button"
            className={`segmented-tab-btn ${filterMode === 'closed' ? 'active' : ''}`}
            onClick={() => setFilterMode('closed')}
          >
            <span>Solo Cerrados</span>
          </button>
        </div>
      </div>

      {/* 4 KPIs Clave Desaturados */}
      <div className="annual-kpis-clean">
        {/* Card 1: Hero Gauge de Ahorro */}
        <div className="hero-gauge-box">
          <div className="gauge-circle-wrap">
            <svg className="gauge-circle-svg" viewBox="0 0 80 80">
              <circle className="gauge-circle-bg" cx="40" cy="40" r="35" />
              <circle
                className="gauge-circle-fill"
                cx="40"
                cy="40"
                r="35"
                style={{ strokeDashoffset: 139 }}
              />
            </svg>
            <div className="gauge-circle-center tabular-nums">{heroSavingsRate}%</div>
          </div>
          <div>
            <div className="kpi-lbl">Superávit Neto Anual</div>
            <div className="kpi-num tabular-nums" style={{ color: 'var(--accent-success)' }}>
              +{formatSoles(heroSurplus)}
            </div>
            <div className="kpi-sub">Excedente neto acumulado</div>
          </div>
        </div>

        {/* Card 2: Ingresos Totales */}
        <div className="annual-kpi-box box-border-green">
          <div className="kpi-lbl">Ingresos Totales</div>
          <div className="kpi-num tabular-nums">{formatSoles(totalAnnualIncome)}</div>
          <div className="kpi-sub">Sueldos y rentas percibidas</div>
        </div>

        {/* Card 3: Salida Real en Caja */}
        <div className="annual-kpi-box box-border-blue">
          <div className="kpi-lbl">Salida Real en Caja</div>
          <div className="kpi-num tabular-nums">{formatSoles(totalAnnualCashOut)}</div>
          <div className="kpi-sub">{cashOutCommittedPct.toFixed(1)}% del ingreso comprometido</div>
        </div>

        {/* Card 4: Deuda TC Cubierta */}
        <div className="annual-kpi-box box-border-purple">
          <div className="kpi-lbl">Deuda TC Gestionada</div>
          <div className="kpi-num tabular-nums">{formatSoles(cardStats.paid)}</div>
          <div className="kpi-sub">{cardStats.liquidatedPct.toFixed(1)}% de consumos liquidados</div>
        </div>
      </div>

      {/* Selector Centralizado de Vista Visual */}
      <div className="annual-segmented-bar">
        <div className="segmented-tabs-wrap">
          <button
            type="button"
            className={`segmented-tab-btn ${visualTab === 'flow' ? 'active' : ''}`}
            onClick={() => setVisualTab('flow')}
          >
            <span>📊 Ritmo de Flujo de Caja</span>
          </button>
          <button
            type="button"
            className={`segmented-tab-btn ${visualTab === 'categories' ? 'active' : ''}`}
            onClick={() => setVisualTab('categories')}
          >
            <span>🍩 Distribución por Categorías</span>
          </button>
        </div>

        {visualTab === 'flow' && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '14px', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} /> Ingreso
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f43f5e' }} /> Salida Caja
            </span>
          </div>
        )}
      </div>

      {/* Contenedor Visual: Vista Flujo de Caja */}
      {visualTab === 'flow' && (
        <div className="annual-visual-card">
          <div className="flow-bars-grid">
            {flowItems.map(item => {
              const inPct = Math.min(100, Math.round((item.inVal / maxFlowVal) * 100));
              const outPct = Math.min(100, Math.round((item.outVal / maxFlowVal) * 100));
              const isPositive = item.savings >= 0;

              return (
                <div key={item.key} className="flow-bar-row">
                  <span className="flow-month-name">{item.label}</span>
                  <div className="flow-tracks">
                    <div className="flow-track-item">
                      <div className="flow-fill-income" style={{ width: `${inPct}%` }} />
                    </div>
                    <div className="flow-track-item">
                      <div className="flow-fill-expense" style={{ width: `${outPct}%` }} />
                    </div>
                  </div>
                  <span
                    className="flow-net-amount tabular-nums"
                    style={{ color: isPositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                  >
                    {isPositive ? '+' : ''}{formatSoles(item.savings)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Fila de 3 Hitos Integrada (derivados del flujo real) */}
          <div className="annual-highlights-strip">
            <div className="highlight-item">
              <div className="highlight-emoji">🏆</div>
              <div>
                <div className="highlight-label">Récord de Ahorro</div>
                <div className="highlight-val tabular-nums">
                  {highlights.bestSaving
                    ? `${highlights.bestSaving.name} • ${highlights.bestSaving.surplus >= 0 ? '+' : ''}${formatSoles(highlights.bestSaving.surplus)}`
                    : 'Sin datos'}
                </div>
              </div>
            </div>

            <div className="highlight-item">
              <div className="highlight-emoji">💳</div>
              <div>
                <div className="highlight-label">Mayor Salida de Caja</div>
                <div className="highlight-val tabular-nums">
                  {highlights.biggestOut
                    ? `${highlights.biggestOut.name} • ${formatSoles(highlights.biggestOut.cashOut)}`
                    : 'Sin datos'}
                </div>
              </div>
            </div>

            <div className="highlight-item">
              <div className="highlight-emoji">🎯</div>
              <div>
                <div className="highlight-label">Colchón Acumulado {currentYear}</div>
                <div className="highlight-val tabular-nums">
                  {totals.surplus >= 0 ? '+' : ''}{formatSoles(totals.surplus)} en Cuenta
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor Visual: Vista Categorías */}
      {visualTab === 'categories' && (
        <div className="annual-visual-card">
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border-subtle)" strokeWidth="12" />
                  {donutSlices.map((slice, idx) => (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="12"
                      strokeDasharray={slice.dashArray}
                      strokeDashoffset={slice.dashOffset}
                    />
                  ))}
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Total Anual
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {annualCategoryTotal >= 1000
                      ? `S/ ${(annualCategoryTotal / 1000).toFixed(1)}k`
                      : formatSoles(annualCategoryTotal)}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                Consumos devengados {currentYear}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categoryList.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                  Aún no hay consumos registrados este año.
                </p>
              )}
              {categoryList.map((cat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '10px'
                  }}
                >
                  <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: cat.color }} />
                    {cat.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <span className="tabular-nums font-bold" style={{ fontSize: '0.88rem' }}>
                      {formatSoles(cat.total)}
                    </span>
                    <span className="tabular-nums font-bold" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {cat.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 1. VISTA DE ESCRITORIO: Tabla Zen Limpia */}
      <div className="annual-desktop-matrix annual-matrix-wrapper">
        <div className="table-responsive">
          <table className="transactions-table">
            <thead>
              <tr>
                <th style={{ width: '170px' }}>Mes</th>
                <th className="text-right" style={{ width: '140px' }}>Ingresos</th>
                <th className="text-right" style={{ width: '150px' }}>Gastos Devengados</th>
                <th className="text-right" style={{ width: '150px' }}>Salida Real Caja</th>
                <th className="text-right" style={{ width: '140px' }}>Superávit</th>
                <th className="text-right" style={{ width: '110px' }}>Tasa Ahorro</th>
                <th className="text-right" style={{ width: '140px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {displayedMonths.map(row => {
                const isSurplusPositive = row.surplus >= 0;
                const isRatePositive = row.savingsRatePct >= 0;

                return (
                  <tr key={row.id}>
                    <td>
                      <span style={{ fontWeight: 700 }}>{row.name}</span>
                      {row.isProjected && (
                        <span style={{ fontSize: '0.68rem', color: '#7c3aed', fontWeight: 700, marginLeft: '6px' }}>
                          PROYECTADO
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums text-right font-bold">{formatSoles(row.income)}</td>
                    <td
                      className="tabular-nums text-right"
                      style={{ color: row.isProjected ? 'var(--text-muted)' : 'var(--accent-danger)' }}
                    >
                      {formatSoles(row.consumedExpenses)} {row.isProjected ? 'fijos' : ''}
                    </td>
                    <td className="tabular-nums text-right font-bold">{formatSoles(row.cashOut)}</td>
                    <td
                      className="tabular-nums text-right font-bold"
                      style={{ color: isSurplusPositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                    >
                      {isSurplusPositive ? '+' : ''}{formatSoles(row.surplus)}
                    </td>
                    <td
                      className="tabular-nums text-right font-bold"
                      style={{ color: isRatePositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                    >
                      {isRatePositive ? '+' : ''}{row.savingsRatePct}%
                    </td>
                    <td className="text-right">
                      <span
                        className={`health-pill ${
                          row.statusType === 'green'
                            ? 'pill-green'
                            : row.statusType === 'red'
                            ? 'pill-red'
                            : 'pill-blue'
                        }`}
                      >
                        {row.statusText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border-medium)', background: 'var(--bg-subtle)', fontWeight: 800 }}>
                <td>
                  {filterMode === 'closed' ? `TOTAL CERRADOS ${currentYear}` : 'TOTAL ANUAL CONSOLIDADO'}
                </td>
                <td className="tabular-nums text-right font-bold" style={{ color: 'var(--accent-success)' }}>
                  {formatSoles(totals.income)}
                </td>
                <td className="tabular-nums text-right font-bold" style={{ color: 'var(--accent-danger)' }}>
                  {formatSoles(totals.consumed)}
                </td>
                <td className="tabular-nums text-right font-bold">
                  {formatSoles(totals.cashOut)}
                </td>
                <td
                  className="tabular-nums text-right font-bold"
                  style={{ color: totals.surplus >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                >
                  {totals.surplus >= 0 ? '+' : ''}{formatSoles(totals.surplus)}
                </td>
                <td className="tabular-nums text-right font-bold" style={{ color: '#d97706' }}>
                  {totals.savingsRate.toFixed(1)}%
                </td>
                <td className="text-right">
                  <span className="health-pill pill-green">
                    {totals.surplus >= 0 ? 'Superávit' : 'Déficit'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 2. VISTA MÓVIL DEDICADA: Tarjetas Mensuales Táctiles (< 768px) */}
      <div className="annual-mobile-cards-list">
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '2px',
            letterSpacing: '0.04em'
          }}
        >
          Desglose Mes a Mes
        </div>

        {displayedMonths.map(row => {
          const isSurplusPositive = row.surplus >= 0;
          const isRatePositive = row.savingsRatePct >= 0;

          return (
            <div
              key={row.id}
              className={`annual-mobile-card ${
                row.cardType === 'green'
                  ? 'm-card-green'
                  : row.cardType === 'red'
                  ? 'm-card-red'
                  : 'm-card-blue'
              }`}
            >
              <div className="m-card-header">
                <div>
                  <span className="m-card-month">{row.name}</span>
                  <div style={{ marginTop: '2px' }}>
                    <span
                      className={`health-pill ${
                        row.statusType === 'green'
                          ? 'pill-green'
                          : row.statusType === 'red'
                          ? 'pill-red'
                          : 'pill-blue'
                      }`}
                    >
                      {row.isProjected ? `Proyectado • ${row.statusText}` : row.statusText}
                    </span>
                  </div>
                </div>
                <div
                  className="m-card-superavit tabular-nums"
                  style={{ color: isSurplusPositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                >
                  {isSurplusPositive ? '+' : ''}{formatSoles(row.surplus)}
                </div>
              </div>

              <div className="m-card-metrics-grid">
                <div className="m-metric-item">
                  <span className="m-metric-lbl">Ingresos</span>
                  <span className="m-metric-val tabular-nums">
                    S/ {Math.round(row.income).toLocaleString('es-PE')}
                  </span>
                </div>
                <div className="m-metric-item">
                  <span className="m-metric-lbl">Salida Caja</span>
                  <span
                    className="m-metric-val tabular-nums"
                    style={{ color: row.cardType === 'red' ? 'var(--accent-danger)' : 'var(--text-primary)' }}
                  >
                    S/ {Math.round(row.cashOut).toLocaleString('es-PE')}
                  </span>
                </div>
                <div className="m-metric-item">
                  <span className="m-metric-lbl">Tasa Ahorro</span>
                  <span
                    className="m-metric-val tabular-nums"
                    style={{ color: isRatePositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                  >
                    {isRatePositive ? '+' : ''}{row.savingsRatePct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
