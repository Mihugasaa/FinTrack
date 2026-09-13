'use client';

import React, { useState, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Activity
} from 'lucide-react';

interface CFODiagnosisData {
  healthScore: number;
  healthLevel: string;
  liquidityInsight: string;
  spendingLeakInsight: string;
  actionableRecommendation: string;
}

export const AnalyticsTab: React.FC = () => {
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
    totalSalaryAmount,
    totalReceivablesRemaining,
    totalPayablesRemaining
  } = useFinance();
  const [cfoDiagnosis, setCfoDiagnosis] = useState<CFODiagnosisData | null>(null);
  const [isLoadingCfo, setIsLoadingCfo] = useState(false);
  const [cfoError, setCfoError] = useState<string | null>(null);

  const fetchCfoDiagnostic = async () => {
    setIsLoadingCfo(true);
    setCfoError(null);
    try {
      const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
      const currentMonthFlow = monthlyHistoricalFlow.find(m => m.key === currentMonthKey);
      const extraTotal = currentMonthFlow
        ? Math.max(0, currentMonthFlow.inVal - (totalSalaryAmount || 0))
        : 0;

      const topCats = categoryBreakdown.slice(0, 4).map(c => ({
        category: c.category.name,
        amount: c.total,
        percentage: c.percentage
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
          pendingPayablesTotal: totalPayablesRemaining || 0
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al obtener diagnóstico');
      setCfoDiagnosis(json.data);
    } catch (e: any) {
      console.warn('Error CFO Copilot:', e);
      setCfoError(e.message || 'No se pudo generar el diagnóstico.');
    } finally {
      setIsLoadingCfo(false);
    }
  };

  useEffect(() => {
    if (!cfoDiagnosis && !isLoadingCfo) {
      fetchCfoDiagnostic();
    }
  }, []);

  // 1. Margen promedio mensual neto (ahorro promedio de los meses con flujo)
  const validMonths = monthlyHistoricalFlow.filter(m => m.inVal > 0 || m.outVal > 0);
  const avgMonthlySavings = validMonths.length > 0
    ? validMonths.reduce((acc, curr) => acc + curr.savings, 0) / validMonths.length
    : 0;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Header de Analítica */}
      <div className="analytics-section-title">
        <div>
          <h2 className="panel-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} color="var(--accent-brand)" />
            <span>Analítica Financiera & Proyecciones</span>
          </h2>
          <p className="panel-header-subtitle">
            Evolución de flujo de caja, distribución de consumo por categorías y proyección predictiva de saldos.
          </p>
        </div>
      </div>

      {/* 2. Top Macro KPIs: Pulso Ejecutivo */}
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

      {/* Diagnóstico Ejecutivo CFO Copilot con Gemini IA */}
      <div
        className="cfo-copilot-card clean-card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.03) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Copiloto CFO • Diagnóstico Ejecutivo con IA</span>
                {cfoDiagnosis && (
                  <span
                    className={`badge ${
                      cfoDiagnosis.healthScore >= 80 ? 'badge-success' : cfoDiagnosis.healthScore >= 50 ? 'badge-warning' : 'badge-danger'
                    }`}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    Salud {cfoDiagnosis.healthScore}/100 • {cfoDiagnosis.healthLevel}
                  </span>
                )}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Auditoría algorítmica de solvencia, detección de fugas y estrategia de caja en tiempo real
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
            <span>{isLoadingCfo ? 'Analizando balances con IA...' : cfoDiagnosis ? 'Actualizar Diagnóstico con IA' : 'Generar Diagnóstico con IA'}</span>
          </button>
        </div>

        {cfoError && (
          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-danger)', fontSize: '0.78rem', marginBottom: '14px' }}>
            {cfoError}
          </div>
        )}

        {cfoDiagnosis ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {/* Bloque 1: Solvencia & Cobertura */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <span>💧</span>
                <span>Solvencia & Liquidez</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>
                {cfoDiagnosis.liquidityInsight}
              </p>
            </div>

            {/* Bloque 2: Detección de Fugas */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-warning)' }}>
                <span>🔍</span>
                <span>Fugas & Concentración</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>
                {cfoDiagnosis.spendingLeakInsight}
              </p>
            </div>

            {/* Bloque 3: Acción Recomendada */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-brand)' }}>
                <span>🎯</span>
                <span>Acción Inmediata CFO</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.45' }}>
                {cfoDiagnosis.actionableRecommendation}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', borderRadius: '10px', padding: '12px 16px', border: '1px dashed var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>💡</span>
              <span>Haz clic en <strong>Generar Diagnóstico con IA</strong> para auditar tu flujo de caja, detectar gastos críticos y recibir recomendaciones ejecutivas personalizadas.</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Fila 1: Gráfico de Barras Evolución + Desglose de Categorías */}
      <div className="analytics-grid-2">
        {/* Gráfico Dinámico de Barras */}
        <div className="chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title" title="Comparativa mensual de ingresos netos vs salidas de caja y margen">
              <TrendingUp size={16} color="var(--accent-brand)" />
              Evolución Mensual: Ingresos vs Salidas Reales
            </span>
            <span className="badge badge-brand" title="Consolidado financiero del año 2026">Consolidado 2026</span>
          </div>

          <div className="chart-canvas-area">
            {/* Líneas Guía Horizontales con Escala de Montos */}
            <div className="chart-gridlines">
              <div className="chart-gridline-row"><span className="chart-gridline-label">S/ 4k</span></div>
              <div className="chart-gridline-row"><span className="chart-gridline-label">S/ 3k</span></div>
              <div className="chart-gridline-row"><span className="chart-gridline-label">S/ 2k</span></div>
              <div className="chart-gridline-row"><span className="chart-gridline-label">S/ 1k</span></div>
              <div className="chart-gridline-row baseline"><span className="chart-gridline-label">S/ 0</span></div>
            </div>

            <div className="chart-bars-container">
              {monthlyHistoricalFlow.map(m => {
                const maxH = 4300;
                const inH = Math.min(100, Math.round((m.inVal / maxH) * 100));
                const outH = Math.min(100, Math.round((m.outVal / maxH) * 100));
                const savH = Math.max(5, Math.min(100, Math.round((Math.abs(m.savings) / maxH) * 100)));

                return (
                  <div key={m.key} className="chart-bar-column">
                    <div className="chart-bar-track" title={`${m.label} 2026: Ingresos S/ ${m.inVal.toFixed(2)} | Salidas S/ ${m.outVal.toFixed(2)} | Margen S/ ${m.savings.toFixed(2)}`}>
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
                        <div
                          className="chart-bar-item chart-bar-savings"
                          style={{ height: `${savH}%`, opacity: m.savings >= 0 ? 1 : 0.4 }}
                          title={`Margen Neto • ${m.label}: S/ ${m.savings.toFixed(2)}`}
                        />
                      </div>
                    </div>
                    <span className="chart-bar-label" title={`Mes de ${m.label} 2026`}>{m.label.slice(0, 3)}</span>
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
            <div className="chart-legend-item" title="Diferencia neta: Ingresos menos Salidas">
              <span className="chart-legend-dot" style={{ background: '#6366f1' }} />
              <span>Margen Neto</span>
            </div>
          </div>
        </div>

        {/* Desglose por Categorías */}
        <div className="chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title" title={`Distribución del consumo en ${monthNames[currentMonth]} ${currentYear}`}>
              <PieChart size={16} color="var(--accent-warning)" />
              Distribución por Categorías
            </span>
            <span className="badge badge-neutral">{monthNames[currentMonth]} {currentYear}</span>
          </div>

          <div className="category-progress-list">
            {categoryBreakdown.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                No hay consumos registrados en este mes.
              </p>
            )}
            {categoryBreakdown.slice(0, 5).map(item => (
              <div key={item.category.id} className="category-progress-item">
                <div className="category-progress-meta">
                  <span
                    title={item.category.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                      maxWidth: '210px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'default'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.category.color, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.category.name}
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold nowrap" title={`Monto total: ${formatSoles(item.total)} (${item.percentage.toFixed(1)}%)`}>
                    {formatSoles(item.total)} <span className="text-muted font-normal" style={{ fontSize: '0.74rem' }}>({item.percentage.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="category-progress-bar-bg" title={`${item.category.name}: ${item.percentage.toFixed(1)}%`}>
                  <div
                    className="category-progress-bar-fill"
                    style={{ width: `${Math.min(100, item.percentage)}%`, background: item.category.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Simulador Predictivo Zen (Sin saturación de 36 líneas de texto repetido) */}
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
                <div className="forecast-stat-row">
                  <span>- Fijos Programados:</span>
                  <strong className="tabular-nums text-danger">-{formatSoles(f.fixedExpenses)}</strong>
                </div>
                <div className="forecast-stat-row">
                  <span>- Variables Estimados:</span>
                  <strong className="tabular-nums text-muted">-{formatSoles(f.projectedVariableExpenses)}</strong>
                </div>
                {f.projectedCardOutflows > 0 && (
                  <div className="forecast-stat-row" style={{ color: 'var(--accent-warning)' }}>
                    <span>- Vencimiento Tarjetas:</span>
                    <strong className="tabular-nums">-{formatSoles(f.projectedCardOutflows)}</strong>
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

      {/* 4B. Diagnóstico Ejecutivo con IA: CFO Copilot */}
      <div
        className="cfo-copilot-card clean-card"
        style={{
          margin: '0 0 20px 0',
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.05) 50%, rgba(16, 185, 129, 0.04) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.28)',
          borderRadius: '16px',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  CFO Copilot • Diagnóstico Financiero con IA
                </span>
                <span className="badge badge-brand nowrap" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  Gemini Flash
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auditoría ejecutiva de solvencia, fugas y optimización patrimonial de {monthNames[currentMonth]} {currentYear}
              </span>
            </div>
          </div>

          <button
            id="btn-refresh-cfo-diagnostic"
            type="button"
            className="btn-secondary"
            onClick={fetchCfoDiagnostic}
            disabled={isLoadingCfo}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isLoadingCfo ? 'wait' : 'pointer'
            }}
          >
            {isLoadingCfo ? (
              <>
                <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12, borderWidth: 2 }} />
                <span>Analizando finanzas...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} color="var(--accent-brand)" />
                <span>{cfoDiagnosis ? 'Actualizar Diagnóstico con IA' : 'Generar Diagnóstico con IA'}</span>
              </>
            )}
          </button>
        </div>

        {cfoError && (
          <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--accent-danger)' }}>
            {cfoError}
          </p>
        )}

        {cfoDiagnosis ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span className="badge badge-success nowrap" style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 700 }}>
                Salud Financiera: {cfoDiagnosis.healthScore} / 100 • {cfoDiagnosis.healthLevel}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px'
              }}
            >
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-success)', fontWeight: 600, fontSize: '0.82rem' }}>
                  <TrendingUp size={15} />
                  <span>Salud de Flujo & Cobertura</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  {cfoDiagnosis.liquidityInsight}
                </p>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-warning)', fontWeight: 600, fontSize: '0.82rem' }}>
                  <AlertTriangle size={15} />
                  <span>Detección de Fugas & Presión</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  {cfoDiagnosis.spendingLeakInsight}
                </p>
              </div>

              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-brand)', fontWeight: 600, fontSize: '0.82rem' }}>
                  <CheckCircle2 size={15} />
                  <span>Acción Clave Esta Semana</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  {cfoDiagnosis.actionableRecommendation}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text-muted)' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem' }}>
              Pulsa el botón superior para que Gemini IA evalúe la solidez de tu flujo de caja, detecte fugas y te recomiende la jugada financiera óptima de la semana.
            </p>
          </div>
        )}
      </div>

      {/* 5. Centro de Auditoría de Inteligencia Artificial (IA) */}
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
    </div>
  );
};

