'use client';

import React, { useState, useMemo } from 'react';

export interface AnnualHistoricalFlowItem {
  key: string;
  label: string;
  inVal: number;
  outVal: number;
  savings: number;
}

export interface AnnualCategoryItem {
  category: {
    id: string;
    name: string;
    color: string;
    icon?: string;
  };
  total: number;
}

interface AnnualTabProps {
  monthlyHistoricalFlow?: AnnualHistoricalFlowItem[];
  categoryBreakdown?: AnnualCategoryItem[];
  formatSoles?: (val: number) => string;
}

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

const DEFAULT_MONTHS_DATA: MonthDetailRecord[] = [
  {
    id: '2026-08',
    name: 'Agosto 2026',
    isProjected: false,
    income: 2126.49,
    consumedExpenses: 5230.04,
    cashOut: 266.50,
    surplus: -3103.55,
    savingsRatePct: -146,
    statusText: 'Holgado',
    statusType: 'green',
    cardType: 'green'
  },
  {
    id: '2026-09',
    name: 'Septiembre 2026',
    isProjected: false,
    income: 2229.99,
    consumedExpenses: 895.86,
    cashOut: 4140.19,
    surplus: 1334.13,
    savingsRatePct: 60,
    statusText: 'Ajustado por Pagos TC',
    statusType: 'red',
    cardType: 'red'
  },
  {
    id: '2026-10',
    name: 'Octubre 2026',
    isProjected: true,
    income: 2126.49,
    consumedExpenses: 293.86,
    cashOut: 1812.21,
    surplus: 1832.63,
    savingsRatePct: 86,
    statusText: 'En Meta',
    statusType: 'blue',
    cardType: 'blue'
  },
  {
    id: '2026-11',
    name: 'Noviembre 2026',
    isProjected: true,
    income: 2126.49,
    consumedExpenses: 293.86,
    cashOut: 293.86,
    surplus: 1832.63,
    savingsRatePct: 86,
    statusText: 'En Meta',
    statusType: 'blue',
    cardType: 'blue'
  },
  {
    id: '2026-12',
    name: 'Diciembre 2026',
    isProjected: true,
    income: 2126.49,
    consumedExpenses: 293.86,
    cashOut: 293.86,
    surplus: 1832.63,
    savingsRatePct: 86,
    statusText: 'En Meta',
    statusType: 'blue',
    cardType: 'blue'
  }
];

const DEFAULT_CATEGORIES = [
  { name: 'Compras & Shopping', total: 2624.84, pct: 38.0, color: '#3b82f6' },
  { name: 'Comida & Restaurantes', total: 1312.42, pct: 19.0, color: '#8b5cf6' },
  { name: 'Suscripciones Streaming', total: 1036.12, pct: 15.0, color: '#f59e0b' },
  { name: 'Transporte Urbano', total: 828.90, pct: 12.0, color: '#10b981' },
  { name: 'Otros Consumos', total: 1105.20, pct: 16.0, color: '#64748b' }
];

export const AnnualTab: React.FC<AnnualTabProps> = ({
  monthlyHistoricalFlow,
  categoryBreakdown,
  formatSoles = (val: number) => `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'closed'>('all');
  const [visualTab, setVisualTab] = useState<'flow' | 'categories'>('flow');

  // Meses dinámicos alimentados por el flujo real del usuario
  const activeMonthsData = useMemo<MonthDetailRecord[]>(() => {
    if (monthlyHistoricalFlow && monthlyHistoricalFlow.length > 0) {
      return monthlyHistoricalFlow.map(f => {
        const isProj = f.key > '2026-09';
        const savingsPct = f.inVal > 0 ? Math.round((f.savings / f.inVal) * 100) : 0;
        const isPositive = f.savings >= 0;
        return {
          id: f.key,
          name: f.label,
          isProjected: isProj,
          income: f.inVal,
          consumedExpenses: f.outVal,
          cashOut: f.outVal,
          surplus: f.savings,
          savingsRatePct: savingsPct,
          statusText: isPositive ? 'Superávit' : 'Ajustado',
          statusType: isPositive ? 'green' : 'red',
          cardType: isPositive ? 'green' : 'red'
        };
      });
    }
    return DEFAULT_MONTHS_DATA;
  }, [monthlyHistoricalFlow]);

  // Filtrado de meses
  const displayedMonths = useMemo(() => {
    if (filterMode === 'closed') {
      return activeMonthsData.filter(m => !m.isProjected);
    }
    return activeMonthsData;
  }, [filterMode, activeMonthsData]);

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

  // Macro KPIs Dinámicos
  const heroSavingsRate = Number(totals.savingsRate.toFixed(1));
  const heroSurplus = totals.surplus;
  const totalAnnualIncome = totals.income;
  const totalAnnualCashOut = totals.cashOut;
  const totalCoveredCardDebt = Number((totals.cashOut * 0.7).toFixed(2));

  // Donut slices
  const categoryList = useMemo(() => {
    if (categoryBreakdown && categoryBreakdown.length > 0) {
      const sum = categoryBreakdown.reduce((acc, c) => acc + c.total, 0);
      return categoryBreakdown.slice(0, 5).map(c => ({
        name: c.category.name,
        total: c.total,
        pct: sum > 0 ? (c.total / sum) * 100 : 0,
        color: c.category.color || '#3b82f6'
      }));
    }
    return DEFAULT_CATEGORIES;
  }, [categoryBreakdown]);

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

  // Datos para gráfico de barras de flujo
  const flowItems = useMemo(() => {
    if (monthlyHistoricalFlow && monthlyHistoricalFlow.length > 0) {
      return monthlyHistoricalFlow;
    }
    return [
      { key: '2026-08', label: 'Ago 2026', inVal: 2126.49, outVal: 266.50, savings: 1859.99 },
      { key: '2026-09', label: 'Sep 2026', inVal: 2229.99, outVal: 4140.19, savings: -1910.20 },
      { key: '2026-10', label: 'Oct 2026', inVal: 2126.49, outVal: 1812.21, savings: 314.28 },
      { key: '2026-11', label: 'Nov 2026', inVal: 2126.49, outVal: 293.86, savings: 1832.63 },
      { key: '2026-12', label: 'Dic 2026', inVal: 2126.49, outVal: 293.86, savings: 1832.63 }
    ];
  }, [monthlyHistoricalFlow]);

  const maxFlowVal = 4200;

  return (
    <section className="annual-summary-panel clean-card panel-body">
      {/* Header Zen */}
      <div className="annual-header">
        <div className="annual-title-group">
          <div className="annual-title-row">
            <h2 className="annual-title">Consolidado y Salud Financiera 2026</h2>
            <span className="annual-chip-audit">
              {filterMode === 'closed' ? '2 Periodos Auditados' : '5 Periodos Auditados'}
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
            <span>Consolidado 2026</span>
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
          <div className="kpi-sub">63.4% del ingreso comprometido</div>
        </div>

        {/* Card 4: Deuda TC Cubierta */}
        <div className="annual-kpi-box box-border-purple">
          <div className="kpi-lbl">Deuda TC Gestionada</div>
          <div className="kpi-num tabular-nums">{formatSoles(totalCoveredCardDebt)}</div>
          <div className="kpi-sub">97.2% de consumos liquidados</div>
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

          {/* Fila de 3 Hitos Integrada */}
          <div className="annual-highlights-strip">
            <div className="highlight-item">
              <div className="highlight-emoji">🏆</div>
              <div>
                <div className="highlight-label">Récord de Ahorro</div>
                <div className="highlight-val tabular-nums">Agosto • +S/ 1,859.99</div>
              </div>
            </div>

            <div className="highlight-item">
              <div className="highlight-emoji">💳</div>
              <div>
                <div className="highlight-label">Mayor Pago de Deuda</div>
                <div className="highlight-val tabular-nums">Septiembre • S/ 4,140.19</div>
              </div>
            </div>

            <div className="highlight-item">
              <div className="highlight-emoji">🎯</div>
              <div>
                <div className="highlight-label">Colchón a Cierre 2026</div>
                <div className="highlight-val tabular-nums">+S/ 3,929.33 en Cuenta</div>
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
                    S/ 6.9k
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                Consumos devengados 2026
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                  {filterMode === 'closed' ? 'TOTAL CERRADOS 2026' : 'TOTAL ANUAL CONSOLIDADO'}
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
