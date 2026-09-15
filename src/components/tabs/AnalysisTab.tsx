'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { AnnualTab } from './AnnualTab';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Sparkles,
  AlertTriangle,
  Activity,
  CheckCircle2,
  X
} from 'lucide-react';

interface CFONarrative {
  liquidityInsight: string;
  spendingLeakInsight: string;
  actionableRecommendation: string;
  updatedAt: string; // ISO
}

type AnalysisView = 'month' | 'trend' | 'projection';

export const AnalysisTab: React.FC = () => {
  const {
    forecastHorizon,
    setForecastHorizon,
    monthlyHistoricalFlow,
    monthNames,
    currentMonth,
    currentYear,
    categoryBreakdown,
    forecastData,
    dismissedAnomalyIds,
    handleResetDismissedAnomalies,
    aiAnomalies,
    handleDismissAnomaly,
    formatSoles,
    diagnostic: liquidityDiagnostic,
    financialHealth,
    monthlyComparison,
    totalSalaryAmount,
    totalReceivablesRemaining,
    totalPayablesRemaining
  } = useFinance();

  const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  const narrativeStorageKey = `cfo-narrative-${monthKey}`;

  // Vista activa del hub de Análisis: diagnóstico del mes, tendencia histórica o
  // proyección a futuro. Reúne lo que antes eran los tabs Analítica y Anual.
  const [analysisView, setAnalysisView] = useState<AnalysisView>('month');

  const [cfoNarrative, setCfoNarrative] = useState<CFONarrative | null>(null);
  const [isLoadingCfo, setIsLoadingCfo] = useState(false);
  const [cfoError, setCfoError] = useState<string | null>(null);

  // La narrativa de IA se persiste por mes en localStorage para no re-consumir
  // tokens ni recomputar en cada visita. El puntaje NO depende de esto: es
  // determinista y siempre está disponible al instante desde `financialHealth`.
  useEffect(() => {
    setCfoError(null);
    try {
      const cached = localStorage.getItem(narrativeStorageKey);
      setCfoNarrative(cached ? JSON.parse(cached) : null);
    } catch {
      setCfoNarrative(null);
    }
  }, [narrativeStorageKey]);

  const fetchCfoDiagnostic = async () => {
    setIsLoadingCfo(true);
    setCfoError(null);
    try {
      const currentMonthFlow = monthlyHistoricalFlow.find(m => m.key === monthKey);
      const extraTotal = currentMonthFlow
        ? Math.max(0, currentMonthFlow.inVal - (totalSalaryAmount || 0))
        : 0;

      const topCats = categoryBreakdown.slice(0, 4).map(c => ({
        category: c.category.name,
        amount: Math.round(c.total * 100) / 100,
        percentage: Math.round(c.percentage * 10) / 10
      }));

      const res = await fetch('/api/ai/cfo-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthName: monthNames[currentMonth],
          year: currentYear,
          totalIncome: (totalSalaryAmount || 0) + extraTotal,
          baseSalary: totalSalaryAmount || 0,
          extraIncomesTotal: extraTotal,
          totalConsumedExpenses: liquidityDiagnostic?.totalExpensesConsumed || 0,
          realCashOutflow: liquidityDiagnostic?.realCashOutflow || 0,
          liquidityMargin: liquidityDiagnostic?.liquidityMargin || 0,
          liquidityStatus: liquidityDiagnostic?.isPositive ? 'ALCANZA' : 'NO_ALCANZA',
          savingsRatePercentage: liquidityDiagnostic?.savingsRatePercentage || 0,
          topCategories: topCats,
          pendingReceivablesTotal: totalReceivablesRemaining || 0,
          pendingPayablesTotal: totalPayablesRemaining || 0,
          // Diagnóstico determinista: la IA lo explica, no lo recalcula.
          healthScore: financialHealth.score,
          healthLevel: financialHealth.level,
          components: financialHealth.components.map(c => ({ label: c.label, points: c.points, max: c.max, detail: c.detail })),
          trend: financialHealth.trend
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al obtener diagnóstico');
      const narrative: CFONarrative = {
        liquidityInsight: json.data.liquidityInsight,
        spendingLeakInsight: json.data.spendingLeakInsight,
        actionableRecommendation: json.data.actionableRecommendation,
        updatedAt: new Date().toISOString()
      };
      setCfoNarrative(narrative);
      try { localStorage.setItem(narrativeStorageKey, JSON.stringify(narrative)); } catch { /* almacenamiento no disponible */ }
    } catch (e: any) {
      console.warn('Error CFO Copilot:', e);
      setCfoError(e.message || 'No se pudo generar el diagnóstico.');
    } finally {
      setIsLoadingCfo(false);
    }
  };

  // 1. Margen promedio mensual neto (ahorro promedio de los meses con flujo)
  const validMonths = monthlyHistoricalFlow.filter(m => m.inVal > 0 || m.outVal > 0);
  const avgMonthlySavings = validMonths.length > 0
    ? validMonths.reduce((acc, curr) => acc + curr.savings, 0) / validMonths.length
    : 0;

  // Escala dinámica del gráfico de barras: el pico real de ingreso/salida con
  // un pequeño margen. Las líneas guía se etiquetan a partir de esa escala.
  const flowScaleMax = Math.max(
    1,
    ...monthlyHistoricalFlow.map(m => Math.max(m.inVal, m.outVal))
  ) * 1.05;
  const flowGridlines = [1, 0.75, 0.5, 0.25].map(f => flowScaleMax * f);
  const fmtCompact = (v: number) => (v >= 1000 ? `S/ ${(v / 1000).toFixed(1)}k` : `S/ ${Math.round(v)}`);
  // Margen compacto con signo para la etiqueta bajo cada columna del comparativo.
  const fmtMargin = (v: number) => `${v >= 0 ? '+' : '-'}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(Math.abs(v))}`;

  // 2. Punto crítico de liquidez (mes con menor saldo final proyectado en el horizonte)
  const criticalMonth = forecastData.length > 0
    ? [...forecastData].sort((a, b) => a.projectedEndingBalance - b.projectedEndingBalance)[0]
    : null;

  // 3. Saldo proyectado final en el horizonte actual (3 o 6 meses)
  const horizonEndingMonth = forecastData.length > 0 ? forecastData[forecastData.length - 1] : null;
  const initialBalance = forecastData.length > 0 ? forecastData[0].projectedInitialBalance : 0;
  const horizonEndingBalance = horizonEndingMonth ? horizonEndingMonth.projectedEndingBalance : 0;
  const growthPercent = initialBalance > 0
    ? Math.round(((horizonEndingBalance - initialBalance) / initialBalance) * 100)
    : 0;

  // Semáforo de 3 Estados para salud financiera: Superávit, Ajustado, Déficit
  const getForecastHealth = (endingBalance: number) => {
    if (endingBalance < 0) {
      return {
        label: 'Déficit',
        badgeClass: 'badge-danger',
        colorClass: 'text-danger',
        statusClass: 'status-deficit',
        color: 'var(--accent-danger)'
      };
    }
    if (endingBalance < 500) {
      return {
        label: 'Ajustado',
        badgeClass: 'badge-warning',
        colorClass: 'text-warning',
        statusClass: 'status-tight',
        color: 'var(--accent-warning)'
      };
    }
    return {
      label: 'Superávit',
      badgeClass: 'badge-success',
      colorClass: 'text-success',
      statusClass: 'status-surplus',
      color: 'var(--accent-success)'
    };
  };

  const criticalHealth = criticalMonth ? getForecastHealth(criticalMonth.projectedEndingBalance) : null;

  // Color del badge de salud según el puntaje determinista.
  const scoreBadgeClass = financialHealth.score >= 60 ? 'badge-success' : financialHealth.score >= 40 ? 'badge-warning' : 'badge-danger';

  // Sparkline de la trayectoria del saldo final: arranca en el saldo inicial de
  // hoy y recorre el saldo final proyectado de cada mes del horizonte elegido.
  const forecastSparkline = useMemo(() => {
    if (forecastData.length === 0) return null;
    const balances = [forecastData[0].projectedInitialBalance, ...forecastData.map(f => f.projectedEndingBalance)];
    const labels = ['Hoy', ...forecastData.map(f => f.monthLabel.slice(0, 3))];
    // Coordenadas normalizadas: el SVG se estira a lo ancho con altura fija (CSS)
    // y `preserveAspectRatio="none"`. El texto va en HTML aparte para que no se
    // deforme ni se encoja en móvil; los trazos usan `non-scaling-stroke`.
    const W = 1000, H = 100, padX = 6, padT = 14, padB = 14;
    const n = balances.length;
    const maxV = Math.max(0, ...balances);
    const minV = Math.min(0, ...balances);
    const span = (maxV - minV) || 1;
    const baseV = minV < 0 ? 0 : minV;
    const xAt = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - 2 * padX));
    const yAt = (v: number) => padT + (1 - (v - minV) / span) * (H - padT - padB);
    const coords = balances.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    const linePath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `M ${coords[0].x.toFixed(1)} ${yAt(baseV).toFixed(1)} `
      + coords.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      + ` L ${coords[n - 1].x.toFixed(1)} ${yAt(baseV).toFixed(1)} Z`;
    const up = balances[n - 1] >= balances[0];
    // Puntos con posición en % (para marcadores y etiquetas de valor en HTML,
    // que así no se deforman con el estirado del SVG).
    const points = balances.map((v, i) => ({
      label: labels[i],
      v,
      xPct: (xAt(i) / W) * 100,
      yPct: (yAt(v) / H) * 100
    }));
    const delta = balances[n - 1] - balances[0];
    return { W, H, padX, points, linePath, areaPath, yZero: yAt(0), last: balances[n - 1], delta, up, lineColor: up ? 'var(--accent-success)' : 'var(--accent-danger)' };
  }, [forecastData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Header del hub de Análisis */}
      <div className="analytics-section-title">
        <div>
          <h2 className="panel-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} color="var(--accent-brand)" />
            <span>Análisis Financiero</span>
          </h2>
          <p className="panel-header-subtitle">
            Diagnóstico del mes, tendencia del año y proyección de saldos, todo en un solo lugar.
          </p>
        </div>
      </div>

      {/* 2. Top Macro KPIs: Pulso Ejecutivo (persistente en todas las vistas) */}
      <div className="analytics-macro-kpis">
        <div className="macro-kpi-card" style={{ borderLeft: '4px solid var(--accent-brand)' }}>
          <div className="macro-kpi-top">
            <span>Margen Promedio Mensual</span>
            <TrendingUp size={15} color="var(--accent-brand)" />
          </div>
          <div className="macro-kpi-val text-brand tabular-nums">
            {avgMonthlySavings >= 0 ? `+${formatSoles(avgMonthlySavings)}` : formatSoles(avgMonthlySavings)}
          </div>
          <div className="macro-kpi-sub">
            <span>Capacidad media de ahorro neto mensual</span>
          </div>
        </div>

        <div className="macro-kpi-card" style={{ borderLeft: `4px solid ${criticalHealth?.color || 'var(--accent-warning)'}` }}>
          <div className="macro-kpi-top">
            <span>Punto Crítico de Liquidez</span>
            <AlertTriangle size={15} color={criticalHealth?.color || 'var(--accent-warning)'} />
          </div>
          <div className={`macro-kpi-val tabular-nums ${criticalHealth?.colorClass || 'text-warning'}`}>
            {criticalMonth ? formatSoles(criticalMonth.projectedEndingBalance) : 'S/ 0.00'}
          </div>
          <div className="macro-kpi-sub">
            <span>
              Mes de menor saldo: <strong>{criticalMonth?.monthLabel || 'N/A'}</strong>
            </span>
            {criticalHealth && (
              <span className={`badge ${criticalHealth.badgeClass} nowrap`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                {criticalHealth.label}
              </span>
            )}
          </div>
        </div>

        <div className="macro-kpi-card" style={{ borderLeft: `4px solid ${horizonEndingBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}` }}>
          <div className="macro-kpi-top">
            <span>Saldo Proyectado a {forecastHorizon} Meses</span>
            <Activity size={15} color={horizonEndingBalance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'} />
          </div>
          <div className={`macro-kpi-val tabular-nums ${horizonEndingBalance >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatSoles(horizonEndingBalance)}
          </div>
          <div className="macro-kpi-sub">
            <span>
              Tendencia acumulada: <strong>{growthPercent >= 0 ? `+${growthPercent}%` : `${growthPercent}%`}</strong> vs inicial
            </span>
          </div>
        </div>
      </div>

      {/* 3. Selector de vista del hub */}
      <div className="analysis-hub-tabs">
        <div className="segmented-tabs-wrap">
          <button
            id="analysis-view-month"
            type="button"
            className={`segmented-tab-btn ${analysisView === 'month' ? 'active' : ''}`}
            onClick={() => setAnalysisView('month')}
            title="Diagnóstico y salud financiera del mes actual"
          >
            <span>Mes actual</span>
          </button>
          <button
            id="analysis-view-trend"
            type="button"
            className={`segmented-tab-btn ${analysisView === 'trend' ? 'active' : ''}`}
            onClick={() => setAnalysisView('trend')}
            title="Evolución mes a mes y consolidado del año"
          >
            <span>Tendencia</span>
          </button>
          <button
            id="analysis-view-projection"
            type="button"
            className={`segmented-tab-btn ${analysisView === 'projection' ? 'active' : ''}`}
            onClick={() => setAnalysisView('projection')}
            title="Proyección de liquidez a 3 o 6 meses"
          >
            <span>Proyección</span>
          </button>
        </div>
      </div>

      {/* ===================== VISTA: MES ACTUAL (diagnóstico + auditoría) ===================== */}
      {analysisView === 'month' && (
        <>
        <div
          className="cfo-copilot-card clean-card"
          style={{
            background: 'var(--accent-brand-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '20px 24px',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--accent-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 4px 12px var(--accent-brand-subtle)'
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Copiloto CFO • Salud Financiera</span>
                  <span
                    className={`badge ${scoreBadgeClass}`}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    title="Calculado con tus movimientos del mes, siempre igual."
                  >
                    Salud {financialHealth.score}/100 • {financialHealth.level}
                  </span>
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Tu puntaje del mes, calculado con tus propios movimientos.
                </p>
              </div>
            </div>

            <button
              id="btn-refresh-ai-diagnostic"
              type="button"
              className="btn-secondary"
              onClick={fetchCfoDiagnostic}
              disabled={isLoadingCfo}
              style={{
                padding: '7px 14px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'rgba(139, 92, 246, 0.4)'
              }}
            >
              <Sparkles size={14} color="var(--accent-brand)" />
              <span>{isLoadingCfo ? 'Consultando...' : cfoNarrative ? 'Actualizar explicación' : 'Explicar en simple'}</span>
            </button>
          </div>

          {/* Desglose determinista del puntaje (siempre visible, sin IA) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            {financialHealth.components.map(c => {
              const pct = c.max > 0 ? Math.max(0, Math.min(100, (c.points / c.max) * 100)) : 0;
              const barColor = pct >= 66 ? 'var(--accent-success)' : pct >= 33 ? 'var(--accent-warning)' : 'var(--accent-danger)';
              return (
                <div
                  key={c.key}
                  title={c.detail}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '10px 12px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{c.label}</span>
                    <span className="tabular-nums" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.points}/{c.max}
                    </span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: 'var(--border-subtle)', marginTop: '7px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.35' }}>{c.detail}</p>
                </div>
              );
            })}
          </div>

          {/* Qué cambió vs mes anterior (determinista) */}
          {monthlyComparison && (monthlyComparison.prevExpense > 0 || monthlyComparison.currExpense > 0) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '10px',
                padding: '8px 12px',
                marginBottom: '14px'
              }}
            >
              <span>{monthlyComparison.isReduction ? '📉' : '📈'}</span>
              <span>
                Gasto vs {monthlyComparison.prevMonthLabel}:{' '}
                <strong style={{ color: monthlyComparison.isReduction ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                  {monthlyComparison.variationStr}
                </strong>{' '}
                • diferencia de {formatSoles(monthlyComparison.differential)}
              </span>
            </div>
          )}

          {cfoError && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-danger)', fontSize: '0.78rem', marginBottom: '14px' }}>
              {cfoError}
            </div>
          )}

          {cfoNarrative ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                {/* Bloque 1: Solvencia & Cobertura */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <span>💧</span>
                    <span>Solvencia & Liquidez</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>
                    {cfoNarrative.liquidityInsight}
                  </p>
                </div>

                {/* Bloque 2: Detección de Fugas */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-warning)' }}>
                    <span>🔍</span>
                    <span>Fugas & Concentración</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>
                    {cfoNarrative.spendingLeakInsight}
                  </p>
                </div>

                {/* Bloque 3: Acción Recomendada */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-brand)' }}>
                    <span>🎯</span>
                    <span>Acción Inmediata CFO</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>
                    {cfoNarrative.actionableRecommendation}
                  </p>
                </div>
              </div>
              <p style={{ margin: '10px 2px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                Explicación actualizada el {new Date(cfoNarrative.updatedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderRadius: '10px', padding: '12px 16px', border: '1px dashed var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span>💡</span>
                <span>Tu puntaje ya está arriba. Pulsa <strong>Explicar en simple</strong> para leerlo en lenguaje claro y ver la acción que más te conviene esta semana.</span>
              </div>
            </div>
          )}
        </div>

        {/* Centro de Auditoría de IA: detalle completo (la tira compacta y descartable vive en Visión General) */}
        <div className="ai-audit-container">
          <div className="chart-card-header" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-brand)" />
              <span className="chart-card-title">
                Auditoría Inteligente & Detección de Patrones
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {dismissedAnomalyIds.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto' }}
                  onClick={handleResetDismissedAnomalies}
                  title="Restaurar alertas de auditoría descartadas"
                >
                  Restaurar • {dismissedAnomalyIds.length}
                </button>
              )}
              <span className="badge badge-brand nowrap">
                {aiAnomalies.length} {aiAnomalies.length === 1 ? 'Alerta Activa' : 'Alertas Activas'}
              </span>
            </div>
          </div>

          {aiAnomalies.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <CheckCircle2 size={20} color="var(--accent-success)" />
              <div>
                <strong style={{ color: 'var(--accent-success)', fontSize: '0.85rem' }}>Todo en orden en tus movimientos</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                  No se detectaron cobros dobles, picos inusuales ni suscripciones fuera de patrón en los gastos registrados.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {aiAnomalies.map(anom => {
                const severityLabel = anom.severity === 'high' ? 'ALTA' : anom.severity === 'medium' ? 'MODERADA' : 'LEVE';
                const severityBadge = anom.severity === 'high' ? 'badge-danger' : anom.severity === 'medium' ? 'badge-warning' : 'badge-neutral';
                const iconColor = anom.severity === 'high' ? 'var(--accent-danger)' : anom.severity === 'medium' ? 'var(--accent-warning)' : 'var(--accent-brand)';

                return (
                  <div key={anom.id} className={`anomaly-item ${anom.severity}`}>
                    <AlertTriangle
                      size={18}
                      color={iconColor}
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{anom.title}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className={`badge ${severityBadge} nowrap`}
                            style={{ fontSize: '0.65rem' }}
                          >
                            {severityLabel}
                          </span>
                          <button
                            type="button"
                            className="btn-dismiss-alert"
                            onClick={() => handleDismissAnomaly(anom.id)}
                            title="Descartar esta alerta"
                            aria-label="Descartar alerta"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                        {anom.description}
                      </p>
                      {anom.suggestedAction && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--accent-brand)', fontWeight: 600 }}>
                          💡 Sugerencia: {anom.suggestedAction}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
      )}

      {/* ===================== VISTA: TENDENCIA (mes a mes + consolidado anual) ===================== */}
      {analysisView === 'trend' && (
        <>
          <div className="analytics-chart-full">
            {/* Gráfico Dinámico de Barras */}
            <div className="chart-card">
              <div className="chart-card-header">
                <span className="chart-card-title" title="Comparativa mensual de ingresos netos vs salidas de caja y margen">
                  <TrendingUp size={16} color="var(--accent-brand)" />
                  Evolución Mensual: Ingresos vs Salidas Reales
                </span>
                <span className="badge badge-brand" title={`Consolidado financiero del año ${currentYear}`}>Consolidado {currentYear}</span>
              </div>

              <div className="chart-canvas-area">
                {/* Líneas Guía Horizontales con Escala de Montos (derivada de datos) */}
                <div className="chart-gridlines">
                  {flowGridlines.map((v, i) => (
                    <div key={i} className="chart-gridline-row"><span className="chart-gridline-label">{fmtCompact(v)}</span></div>
                  ))}
                  <div className="chart-gridline-row baseline"><span className="chart-gridline-label">S/ 0</span></div>
                </div>

                <div className="chart-bars-container">
                  {monthlyHistoricalFlow.map(m => {
                    const maxH = flowScaleMax;
                    const inH = Math.min(100, Math.round((m.inVal / maxH) * 100));
                    const outH = Math.min(100, Math.round((m.outVal / maxH) * 100));

                    return (
                      <div key={m.key} className="chart-bar-column">
                        <div className="chart-bar-track" title={`${m.label}: Ingresos S/ ${m.inVal.toFixed(2)} | Salidas S/ ${m.outVal.toFixed(2)} | Margen S/ ${m.savings.toFixed(2)}`}>
                          <div className="chart-bar-group">
                            <div
                              className="chart-bar-item chart-bar-income"
                              style={{ height: `${inH}%` }}
                              title={`Ingresos • ${m.label}: S/ ${m.inVal.toFixed(2)}`}
                            />
                            <div
                              className="chart-bar-item chart-bar-expense"
                              style={{ height: `${outH}%` }}
                              title={`Salida Real de Caja • ${m.label}: S/ ${m.outVal.toFixed(2)}`}
                            />
                          </div>
                        </div>
                        <span className="chart-bar-label" title={`Mes de ${m.label}`}>{m.label.slice(0, 3)}</span>
                        <span
                          className="chart-bar-margin"
                          style={{ color: m.savings >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                          title={`Margen del mes • ${m.label}: ${m.savings >= 0 ? '+' : ''}S/ ${m.savings.toFixed(2)}`}
                        >
                          {fmtMargin(m.savings)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="chart-legend">
                <div className="chart-legend-item" title="Dinero efectivamente cobrado en cuenta bancaria">
                  <span className="chart-legend-dot" style={{ background: '#10b981' }} />
                  <span>Ingresos</span>
                </div>
                <div className="chart-legend-item" title="Pagos y egresos reales salidos de tu cuenta">
                  <span className="chart-legend-dot" style={{ background: '#ef4444' }} />
                  <span>Salida Real</span>
                </div>
                <div className="chart-legend-item" title="Margen neto del mes (ingresos menos salidas), anotado bajo cada columna">
                  <span style={{ fontWeight: 800, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1 }}>±</span>
                  <span>Margen mensual</span>
                </div>
              </div>
            </div>
          </div>

          {/* Consolidado del año (antes tab "Resumen Anual") */}
          <AnnualTab />
        </>
      )}

      {/* ===================== VISTA: PROYECCIÓN (simulador) ===================== */}
      {analysisView === 'projection' && (
        <div className="simulator-zen-card">
          <div className="sim-header">
            <div>
              <div className="sim-title">
                <Calendar size={18} color="var(--accent-brand)" />
                <span>Simulador de Flujo Predictivo</span>
                <span className="badge badge-success nowrap">Tiempo Real</span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Cálculo predictivo de arrastre de saldos, sueldos, gastos fijos y cuotas de tarjetas.
              </p>
            </div>

            {/* Selector de Horizonte Integrado */}
            <div className="sim-pills">
              <button
                id="forecast-horizon-3"
                type="button"
                className={`sim-pill-btn ${forecastHorizon === 3 ? 'active' : ''}`}
                onClick={() => setForecastHorizon(3)}
                title="Proyectar liquidez para los próximos 3 meses"
              >
                3 Meses
              </button>
              <button
                id="forecast-horizon-6"
                type="button"
                className={`sim-pill-btn ${forecastHorizon === 6 ? 'active' : ''}`}
                onClick={() => setForecastHorizon(6)}
                title="Proyectar liquidez para los próximos 6 meses"
              >
                6 Meses
              </button>
            </div>
          </div>

          {forecastSparkline && (
            <div className="sim-sparkline">
              <div className="sim-sparkline-head">
                <span>Trayectoria del saldo final proyectado</span>
                <span className="tabular-nums" style={{ color: forecastSparkline.lineColor, fontWeight: 700 }}>
                  {forecastSparkline.up ? '▲' : '▼'} {forecastSparkline.delta >= 0 ? '+' : ''}{formatSoles(forecastSparkline.delta)} en {forecastHorizon} meses
                </span>
              </div>
              <div className="sim-spark-plot">
                <svg
                  className="sim-spark-svg"
                  viewBox={`0 0 ${forecastSparkline.W} ${forecastSparkline.H}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Trayectoria del saldo final proyectado mes a mes"
                >
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={forecastSparkline.lineColor} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={forecastSparkline.lineColor} stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line
                    x1={forecastSparkline.padX}
                    y1={forecastSparkline.yZero}
                    x2={forecastSparkline.W - forecastSparkline.padX}
                    y2={forecastSparkline.yZero}
                    stroke="var(--border-medium)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path d={forecastSparkline.areaPath} fill="url(#sparkFill)" stroke="none" />
                  <path d={forecastSparkline.linePath} fill="none" stroke={forecastSparkline.lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {forecastSparkline.points.map((p, i, arr) => {
                  const alignX = i === 0 ? '0' : i === arr.length - 1 ? '-100%' : '-50%';
                  const alignY = p.yPct < 26 ? '55%' : '-165%';
                  return (
                    <React.Fragment key={i}>
                      <span className="sim-spark-dot" style={{ left: `${p.xPct}%`, top: `${p.yPct}%`, borderColor: forecastSparkline.lineColor }} />
                      <span className="sim-spark-val tabular-nums" style={{ left: `${p.xPct}%`, top: `${p.yPct}%`, transform: `translate(${alignX}, ${alignY})`, color: forecastSparkline.lineColor }}>
                        {fmtCompact(p.v)}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="sim-spark-axis">
                {forecastSparkline.points.map((p, i) => (
                  <span key={i} title={`${p.label}: ${formatSoles(p.v)}`}>{p.label}</span>
                ))}
              </div>
            </div>
          )}

          <div className="forecast-cards-grid">
            {forecastData.map(f => {
              const health = getForecastHealth(f.projectedEndingBalance);

              return (
                <div key={`${f.year}-${f.month}`} className={`forecast-card ${health.statusClass}`}>
                  <div className="forecast-card-header">
                    <span className="forecast-month-badge">{f.monthLabel}</span>
                    <span className={`badge ${health.badgeClass} nowrap`}>
                      {health.label}
                    </span>
                  </div>

                  <div className="forecast-stat-row">
                    <span>Saldo Inicial:</span>
                    <strong className="tabular-nums">{formatSoles(f.projectedInitialBalance)}</strong>
                  </div>
                  <div className="forecast-stat-row">
                    <span>+ Ingresos:</span>
                    <strong className="tabular-nums text-success">+{formatSoles(f.expectedIncome)}</strong>
                  </div>
                  {(f.scheduledReceivableDue ?? 0) > 0 && (
                    <div className="forecast-stat-row" style={{ color: 'var(--accent-success)' }}>
                      <span>+ Cobranzas Programadas:</span>
                      <strong className="tabular-nums">+{formatSoles(f.scheduledReceivableDue ?? 0)}</strong>
                    </div>
                  )}
                  <div className="forecast-stat-row">
                    <span>- Fijos Programados:</span>
                    <strong className="tabular-nums text-danger">-{formatSoles(f.fixedExpenses)}</strong>
                  </div>
                  <div className="forecast-stat-row">
                    <span title="Promedio histórico de tus gastos variables, aplicado por igual a cada mes proyectado">- Variables (prom. histórico):</span>
                    <strong className="tabular-nums text-muted">-{formatSoles(f.projectedVariableExpenses)}</strong>
                  </div>
                  {f.projectedCardOutflows > 0 && (
                    <div className="forecast-stat-row" style={{ color: 'var(--accent-warning)' }}>
                      <span>- Vencimiento Tarjetas:</span>
                      <strong className="tabular-nums">-{formatSoles(f.projectedCardOutflows)}</strong>
                    </div>
                  )}
                  {(f.scheduledDebtDue ?? 0) > 0 && (
                    <div className="forecast-stat-row" style={{ color: 'var(--accent-danger)' }}>
                      <span>- Deudas por Vencer:</span>
                      <strong className="tabular-nums">-{formatSoles(f.scheduledDebtDue ?? 0)}</strong>
                    </div>
                  )}

                  <div className="forecast-ending-balance">
                    <span>Saldo Final</span>
                    <strong className={`tabular-nums ${health.colorClass}`}>
                      {formatSoles(f.projectedEndingBalance)}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
