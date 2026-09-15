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
  statusType: 'green' | 'red' | 'blue' | 'amber';
  cardType: 'green' | 'red' | 'blue' | 'amber';
  surplusDelta: number | null;
}

// Estado por tramos de tasa de ahorro (reemplaza el binario superávit/déficit).
const savingsTier = (pct: number): { text: string; type: 'green' | 'red' | 'blue' | 'amber' } => {
  if (pct < 0) return { text: 'Déficit', type: 'red' };
  if (pct < 10) return { text: 'Ajustado', type: 'amber' };
  if (pct < 20) return { text: 'Estable', type: 'blue' };
  return { text: 'Saludable', type: 'green' };
};

const pillClassOf = (type: 'green' | 'red' | 'blue' | 'amber') =>
  type === 'green' ? 'pill-green' : type === 'red' ? 'pill-red' : type === 'amber' ? 'pill-amber' : 'pill-blue';

const mCardClassOf = (type: 'green' | 'red' | 'blue' | 'amber') =>
  type === 'green' ? 'm-card-green' : type === 'red' ? 'm-card-red' : type === 'amber' ? 'm-card-amber' : 'm-card-blue';

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
    return monthlyHistoricalFlow.map((f, i, arr) => {
      const savingsPct = f.inVal > 0 ? Math.round((f.savings / f.inVal) * 100) : 0;
      const tier = savingsTier(savingsPct);
      // Variación del superávit respecto al mes previo (para la flecha ▲▼).
      const prev = i > 0 ? arr[i - 1] : null;
      const surplusDelta = prev ? Number((f.savings - prev.savings).toFixed(2)) : null;
      return {
        id: f.key,
        name: f.label,
        isProjected: f.isProjected,
        income: f.inVal,
        consumedExpenses: f.consumed,
        cashOut: f.outVal,
        surplus: f.savings,
        savingsRatePct: savingsPct,
        statusText: tier.text,
        statusType: tier.type,
        cardType: tier.type,
        surplusDelta
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

  // Gauge de ahorro: el arco se deriva del dato real (antes estaba hardcodeado).
  // Circunferencia del círculo r=35 ≈ 220 (coincide con stroke-dasharray del CSS).
  const GAUGE_CIRCUMFERENCE = 220;
  const gaugePct = Math.max(0, Math.min(100, heroSavingsRate));
  const gaugeOffset = GAUGE_CIRCUMFERENCE * (1 - gaugePct / 100);
  const gaugeColor = heroSavingsRate >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)';

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

  // Datos para gráfico de flujo (mismo flujo real consolidado).
  const flowItems = monthlyHistoricalFlow;

  // Geometría del gráfico "Ritmo de Flujo de Caja": barras del MARGEN NETO de cada
  // mes (contribución: verde si ahorró, rojo si sobregastó) + línea del COLCHÓN
  // ACUMULADO, ambos en el MISMO eje de soles. La altura de cada barra es lo que
  // hace subir/bajar la línea, así el par barras+línea cuenta una sola historia.
  const cushionChart = useMemo(() => {
    // Coordenadas normalizadas; el SVG se estira a lo ancho con altura fija (CSS).
    // Sin eje Y ni etiquetas internas: esas van en HTML para no deformarse.
    const W = 1000, H = 240;
    // padT amplio: deja aire arriba para las etiquetas de valor del colchón sin que
    // se recorten cuando el pico queda cerca del borde superior.
    const padL = 10, padR = 10, padT = 42, padB = 20;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const n = flowItems.length;

    // Colchón acumulado (línea) + margen neto del mes (barra de contribución).
    let run = 0;
    const pts = flowItems.map((m, i) => {
      run += m.savings;
      return { key: m.key, label: m.label.slice(0, 3), savings: m.savings, cum: run, i };
    });

    // Eje COMPARTIDO que cubre acumulado, márgenes y el cero.
    const cumVals = pts.map(p => p.cum);
    const savVals = pts.map(p => p.savings);
    const maxV = Math.max(0, ...cumVals, ...savVals);
    const minV = Math.min(0, ...cumVals, ...savVals);
    const span = (maxV - minV) || 1;

    const xAt = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
    const yAt = (v: number) => padT + (1 - (v - minV) / span) * innerH;
    const yZero = yAt(0);

    const linePath = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xAt(p.i).toFixed(1)} ${yAt(p.cum).toFixed(1)}`).join(' ');
    // Área bajo la línea del colchón (hasta la base cero): da "cuerpo" a la línea y
    // llena el espacio, comunicando el colchón que se va acumulando.
    const areaPath = n >= 1
      ? `M ${xAt(0).toFixed(1)} ${yZero.toFixed(1)} ` +
        pts.map(p => `L ${xAt(p.i).toFixed(1)} ${yAt(p.cum).toFixed(1)}`).join(' ') +
        ` L ${xAt(n - 1).toFixed(1)} ${yZero.toFixed(1)} Z`
      : '';

    // Líneas guía + eje Y (referencia de escala en soles). Sin esto el gráfico se
    // sentía "sin ayuda": no había forma de leer cuánto vale cada altura. Solo se
    // etiqueta el mínimo negativo cuando está lo bastante lejos del cero para no
    // encimarse con su etiqueta.
    const showMin = minV < 0 && (0 - minV) / span > 0.1;
    const tickVals = showMin ? [maxV, 0, minV] : [maxV, maxV / 2, 0];
    const gridTicks = Array.from(new Set(tickVals)).map(v => ({ v, yPct: (yAt(v) / H) * 100, y: yAt(v) }));

    return { W, H, padL, padR, padT, padB, innerW, innerH, n, pts, maxV, minV, xAt, yAt, yZero, linePath, areaPath, gridTicks };
  }, [flowItems]);

  // Formateo compacto para las etiquetas del gráfico (soporta negativos).
  const fmtCushion = (v: number) => (Math.abs(v) >= 1000 ? `S/ ${(v / 1000).toFixed(1)}k` : `S/ ${Math.round(v)}`);

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
                style={{ strokeDashoffset: gaugeOffset, stroke: gaugeColor }}
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '14px', fontWeight: 600, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '16px', height: '3px', borderRadius: '2px', background: 'var(--accent-brand)' }} /> Colchón acumulado
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} /> Mes con ahorro
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f43f5e' }} /> Mes en rojo
            </span>
          </div>
        )}
      </div>

      {/* Contenedor Visual: Vista Flujo de Caja */}
      {visualTab === 'flow' && (
        <div className="annual-visual-card">
          {cushionChart.n === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '28px 0' }}>
              Aún no hay meses con actividad este año para trazar la evolución.
            </p>
          ) : (
            <div className="annual-flow-chart">
              <div className="annual-flow-plot-row">
                {/* Eje Y (referencia de escala en soles), en HTML para no deformarse. */}
                <div className="annual-flow-yaxis" aria-hidden>
                  {cushionChart.gridTicks.map(t => (
                    <span key={`yt-${t.v}`} className="annual-flow-ytick tabular-nums" style={{ top: `${t.yPct}%` }}>
                      {fmtCushion(t.v)}
                    </span>
                  ))}
                </div>

                <div className="annual-flow-plot">
                  <div className="annual-flow-svgwrap">
                    <svg
                      className="annual-flow-svg"
                      viewBox={`0 0 ${cushionChart.W} ${cushionChart.H}`}
                      preserveAspectRatio="none"
                      role="img"
                      aria-label="Ahorro neto de cada mes y colchón acumulado a lo largo del año"
                    >
                      <defs>
                        <linearGradient id="cushionGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent-brand)" stopOpacity="0.24" />
                          <stop offset="100%" stopColor="var(--accent-brand)" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>

                      {/* Líneas guía horizontales (escala) */}
                      {cushionChart.gridTicks.map(t => (
                        <line
                          key={`grid-${t.v}`}
                          x1={cushionChart.padL}
                          y1={t.y}
                          x2={cushionChart.W - cushionChart.padR}
                          y2={t.y}
                          stroke="var(--border-subtle)"
                          strokeWidth="1"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}

                      {/* Área del colchón acumulado (da cuerpo a la línea) */}
                      {cushionChart.areaPath && (
                        <path d={cushionChart.areaPath} fill="url(#cushionGrad)" stroke="none" />
                      )}

                      {/* Barras del ahorro NETO del mes (verde ahorró / rojo sobregastó):
                          su altura es la contribución que sube o baja el colchón. */}
                      {cushionChart.pts.map(p => {
                        const x = cushionChart.xAt(p.i);
                        const yv = cushionChart.yAt(p.savings);
                        const top = Math.min(yv, cushionChart.yZero);
                        const h = Math.max(1.5, Math.abs(yv - cushionChart.yZero));
                        return (
                          <rect key={`bar-${p.key}`} x={x - 10} y={top} width="20" height={h} rx="2" fill={p.savings >= 0 ? '#10b981' : '#f43f5e'} opacity="0.5" />
                        );
                      })}

                      {/* Línea base cero, resaltada solo si hay meses en negativo */}
                      {cushionChart.minV < 0 && (
                        <line
                          x1={cushionChart.padL}
                          y1={cushionChart.yZero}
                          x2={cushionChart.W - cushionChart.padR}
                          y2={cushionChart.yZero}
                          stroke="var(--border-medium)"
                          strokeWidth="1.2"
                          strokeDasharray="4 4"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}

                      {/* Línea del colchón acumulado */}
                      <path d={cushionChart.linePath} fill="none" stroke="var(--accent-brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>

                    {/* Dots + valor del colchón por punto (HTML, no se deforma). El
                        último se enfatiza; los intermedios se ocultan en móvil angosto. */}
                    {cushionChart.pts.map((p, i, arr) => {
                      const xPct = (cushionChart.xAt(p.i) / cushionChart.W) * 100;
                      const yPct = (cushionChart.yAt(p.cum) / cushionChart.H) * 100;
                      const isLast = i === arr.length - 1;
                      const isMid = i !== 0 && !isLast;
                      const alignX = i === 0 ? '0' : isLast ? '-100%' : '-50%';
                      return (
                        <React.Fragment key={`cum-${p.key}`}>
                          <span className="annual-flow-dot" style={{ left: `${xPct}%`, top: `${yPct}%` }} />
                          <span
                            className={`annual-flow-cval tabular-nums${isLast ? ' is-last' : ''}${isMid ? ' is-mid' : ''}`}
                            style={{ left: `${xPct}%`, top: `${yPct}%`, transform: `translate(${alignX}, -150%)` }}
                            title={`${p.label}: colchón acumulado ${formatSoles(p.cum)}`}
                          >
                            {isLast ? 'Colchón ' : ''}{p.cum >= 0 ? '+' : ''}{fmtCushion(p.cum)}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Eje X de meses en HTML para que sea legible en cualquier ancho */}
                  <div className="annual-flow-axis">
                    {cushionChart.pts.map(p => (
                      <span key={p.key} title={`${p.label}: ahorro del mes ${p.savings >= 0 ? '+' : ''}${formatSoles(p.savings)}`}>{p.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
          <div className="annual-cat-layout">
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

            <div className="annual-cat-legend">
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
                    gap: '10px',
                    padding: '10px 14px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '10px'
                  }}
                >
                  <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: cat.color, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexShrink: 0 }}>
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
                      <div>{isSurplusPositive ? '+' : ''}{formatSoles(row.surplus)}</div>
                      {row.surplusDelta !== null && Math.abs(row.surplusDelta) >= 0.01 && (
                        <div
                          style={{ fontSize: '0.68rem', fontWeight: 700, color: row.surplusDelta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                          title={`Variación del superávit respecto al mes anterior`}
                        >
                          {row.surplusDelta >= 0 ? '▲' : '▼'} {formatSoles(Math.abs(row.surplusDelta))}
                        </div>
                      )}
                    </td>
                    <td
                      className="tabular-nums text-right font-bold"
                      style={{ color: isRatePositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                    >
                      {isRatePositive ? '+' : ''}{row.savingsRatePct}%
                    </td>
                    <td className="text-right">
                      <span className={`health-pill ${pillClassOf(row.statusType)}`}>
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
                  {(() => {
                    const tier = savingsTier(totals.savingsRate);
                    return <span className={`health-pill ${pillClassOf(tier.type)}`}>{tier.text}</span>;
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Nota metodológica: distingue el gasto devengado de la salida real y explica los tiers de estado */}
      <p className="annual-table-note">
        <strong>Gastos devengados</strong> = lo que consumiste en el mes, por la fecha del gasto. <strong>Salida real de caja</strong> = lo que efectivamente salió de tu cuenta ese mes, por la fecha de vencimiento del pago. El <strong>Estado</strong> va por tasa de ahorro: Saludable ≥ 20%, Estable 10 a 20%, Ajustado 0 a 10%, Déficit bajo 0%.
      </p>

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
              className={`annual-mobile-card ${mCardClassOf(row.cardType)}`}
            >
              <div className="m-card-header">
                <div>
                  <span className="m-card-month">{row.name}</span>
                  <div style={{ marginTop: '2px' }}>
                    <span className={`health-pill ${pillClassOf(row.statusType)}`}>
                      {row.isProjected ? `Proyectado • ${row.statusText}` : row.statusText}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    className="m-card-superavit tabular-nums"
                    style={{ color: isSurplusPositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                  >
                    {isSurplusPositive ? '+' : ''}{formatSoles(row.surplus)}
                  </div>
                  {row.surplusDelta !== null && Math.abs(row.surplusDelta) >= 0.01 && (
                    <div style={{ fontSize: '0.66rem', fontWeight: 700, color: row.surplusDelta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {row.surplusDelta >= 0 ? '▲' : '▼'} {formatSoles(Math.abs(row.surplusDelta))}
                    </div>
                  )}
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
