'use client';

import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  Pencil,
  Trash2,
  Tag,
  AlertTriangle,
  X,
  ExternalLink,
  CreditCard,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { FALLBACK_USD_PEN_RATE } from '@/lib/constants';

interface DueCardItem {
  p: {
    cardId: string;
    cardName: string;
    cardColor: string;
    nextDueAmount: number;
    nextDueDate: string | null;
    liquidityCoverage?: {
      status: string;
      message?: string;
      shortfallAmount?: number;
    } | null;
  };
  days: number;
  weekday: string;
}

interface CardDuesSectionProps {
  dues: DueCardItem[];
  onNavigateToSchedule: () => void;
  formatDisplayDate: (d: string) => string;
  formatSoles: (amount: number) => string;
}

const CardDuesSection: React.FC<CardDuesSectionProps> = ({
  dues,
  onNavigateToSchedule,
  formatDisplayDate,
  formatSoles
}) => {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el.children.length) return;
    const scrollLeft = el.scrollLeft;
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i] as HTMLElement;
      const diff = Math.abs(child.offsetLeft - el.offsetLeft - scrollLeft);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    if (closestIdx !== activeIndex) {
      setActiveIndex(closestIdx);
    }
  };

  const scrollToCard = (idx: number) => {
    if (!containerRef.current) return;
    const child = containerRef.current.children[idx] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
    setActiveIndex(idx);
  };

  return (
    <section className="clean-card card-dues-section">
      <div className="card-dues-header">
        <div className="card-dues-title">
          <span className="card-dues-icon">💳</span>
          <span className="card-dues-title-text">Próximos Vencimientos</span>
          {dues.length > 0 && (
            <span className="card-dues-count-badge">{dues.length}</span>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary card-dues-btn"
          onClick={onNavigateToSchedule}
        >
          Ver planificador
        </button>
      </div>

      <div
        ref={containerRef}
        className="card-dues-container"
        data-count={Math.min(dues.length, 4)}
        onScroll={handleScroll}
      >
        {dues.map((d) => {
          const color = d.days < 0 ? 'var(--accent-danger)' : d.days <= 3 ? 'var(--accent-warning)' : 'var(--accent-info)';
          const label = d.days < 0 ? `venció hace ${Math.abs(d.days)} d` : d.days === 0 ? 'vence hoy' : `en ${d.days} d`;
          const coverage = d.p.liquidityCoverage;
          const isMismatch = coverage?.status === 'SALARY_MISMATCH';
          const isDeficit = coverage?.status === 'DEFICIT';
          const isCovered = coverage?.status === 'COVERED';

          return (
            <div
              key={d.p.cardId}
              className="card-due-item"
              style={{ borderLeft: `4px solid ${d.p.cardColor}` }}
            >
              <div className="card-due-name">{d.p.cardName}</div>
              <div className="card-due-meta">
                <span>{d.weekday} {formatDisplayDate(d.p.nextDueDate!)}</span>
                <span className="card-due-separator">•</span>
                <span style={{ color, fontWeight: 700 }}>{label}</span>
              </div>
              <div className="card-due-amount tabular-nums">
                {formatSoles(d.p.nextDueAmount)}
              </div>

              {coverage && coverage.status !== 'PAID' && (
                <div className="card-due-badge-wrap">
                  {isMismatch && (
                    <span
                      className="badge badge-warning"
                      style={{ fontSize: '0.67rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      title={coverage.message}
                    >
                      <span>Pre-sueldo</span>
                      <span style={{ opacity: 0.6 }}>•</span>
                      <span className="tabular-nums">Faltan {formatSoles(coverage.shortfallAmount || 0)}</span>
                    </span>
                  )}
                  {isCovered && (
                    <span
                      className="badge badge-success"
                      style={{ fontSize: '0.67rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
                      title={coverage.message}
                    >
                      Cubierto
                    </span>
                  )}
                  {isDeficit && (
                    <span
                      className="badge badge-danger"
                      style={{ fontSize: '0.67rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      title={coverage.message}
                    >
                      <span>Déficit de ciclo</span>
                      <span style={{ opacity: 0.6 }}>•</span>
                      <span className="tabular-nums">-{formatSoles(coverage.shortfallAmount || 0)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dues.length > 1 && (
        <div className="card-dues-footer-mobile">
          <button
            type="button"
            className="card-dues-nav-btn"
            onClick={() => scrollToCard(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            aria-label="Tarjeta anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="card-dues-dots" aria-hidden="true">
            {dues.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`card-dues-dot ${idx === activeIndex ? 'active' : ''}`}
                onClick={() => scrollToCard(idx)}
                aria-label={`Ver tarjeta ${idx + 1} de ${dues.length}`}
              />
            ))}
          </div>

          <span className="card-dues-counter-label">
            {activeIndex + 1} de {dues.length}
          </span>

          <button
            type="button"
            className="card-dues-nav-btn"
            onClick={() => scrollToCard(Math.min(dues.length - 1, activeIndex + 1))}
            disabled={activeIndex === dues.length - 1}
            aria-label="Siguiente tarjeta"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
};

export const OverviewTab: React.FC = () => {
  const {
    isCurrentActiveMonth,
    isPastMonth,
    isFutureMonth,
    monthNames,
    currentMonth,
    currentYear,
    currentDateStr,
    now,
    debitStats,
    initialDebitForMonth,
    isInitialDebitAuto,
    totalSalaryAmount,
    currentOtherIncomes,
    setIsAdjustDebitModalOpen,
    diagnostic,
    currentMonthTransactions,
    combinedMovements,
    monthMovementsTotal,
    categoryBreakdown,
    monthlyComparison,
    setActiveTab,
    setCardsSubTab,
    navigateToPayableCreditor,
    navigateToDebtor,
    creditorGroups,
    debtorGroups,
    aiAnomalies,
    handleDismissAnomaly,
    isOverviewAuditDismissed,
    handleToggleHideOverviewAudit,
    paymentMethods,
    categories,
    cardPaymentPlan,
    cardsLiquidityAssessment,
    resolvePaymentMethod,
    handleOpenEditTransaction,
    promptDeleteTransaction,
    cardAdvisor,
    formatDisplayDate,
    formatSoles,
    transactions,
    payables,
    cardAmortization
  } = useFinance();

  // Distribución por categoría: mostramos 6 por defecto y el resto tras "Ver más"
  // (evita saturar sin ocultar información: el badge indica el total real).
  const [showAllCats, setShowAllCats] = React.useState(false);

  // Últimos movimientos "a la fecha": mostramos los movimientos reales efectuados hasta hoy
  // (gastos, pagos a tarjeta, pagos de deudas e ingresos). Excluimos vencimientos programados
  // para reflejar solo movimientos reales de caja. En meses pasados/futuros se muestra el mes completo.
  const recentMovements = React.useMemo(() => {
    const list = combinedMovements.filter(m => {
      if (m.kind === 'scheduled_payable') return false;
      if (isCurrentActiveMonth) {
        return m.sortDate <= currentDateStr;
      }
      return true;
    });
    return list.slice(0, 5);
  }, [combinedMovements, isCurrentActiveMonth, currentDateStr]);

  // Flujo del mes visible (para las tarjetas Entradas/Salidas, según el mes sea en
  // curso, pasado o futuro). Los "previstos" incluyen sueldo + ingresos extra del mes.
  const monthIncome = totalSalaryAmount + debitStats.otherIncomesTotalMonth;
  const expectedInflow = monthIncome + debitStats.collectedFromDebtors + (debitStats.borrowedCreditedToDebitMonth || 0);
  const realizedInflow = debitStats.salariesReceivedToday + debitStats.otherIncomesReceivedToday + debitStats.collectedFromDebtors + (debitStats.borrowedCreditedToDebitToday || 0);
  const debtPaidToday = debitStats.paidToCreditorsToday || 0;
  const debtPaidMonth = debitStats.paidToCreditorsMonth || 0;
  const realizedOutflow = debitStats.debitExpensesPaidToday + debitStats.cardPaymentsPaidMonth + debtPaidToday;
  const pastOutflow = debitStats.debitExpensesTotalMonth + debitStats.cardPaymentsPaidMonth + debtPaidMonth;
  // Salida programada del mes futuro: gastos débito registrados + cuotas de tarjeta
  // por vencer pendientes de pago (netas de abonos previos o anticipados) + deudas propias programadas de ese mes.
  const scheduledOutflow = debitStats.debitExpensesTotalMonth + debitStats.unpaidCardBillsDueThisMonth + debitStats.scheduledDebtDueThisMonth;
  // Lo que aún falta pagar en el mes en curso (para no quedar solo con lo "efectuado").
  const pendingThisMonth = debitStats.unpaidCardBillsDueThisMonth + debitStats.scheduledDebtDueThisMonth;

  return (
    <div className="tab-page-container">
      {/* 1. HERO MASTER: MI DINERO EN DÉBITO (ARMONÍA ZEN Y FOCO EN LIQUIDEZ) */}
      <section className="zen-hero clean-card">
        <div className="zen-hero-left">
          <div className="zen-tag-row">
            <div className="zen-tag-group">
              <span className="zen-tag-pill">
                {isCurrentActiveMonth
                  ? 'Dinero Disponible'
                  : isPastMonth
                  ? `Cierre Cuenta Débito (${monthNames[currentMonth]} ${currentYear})`
                  : `Proyección Cuenta Débito (${monthNames[currentMonth]} ${currentYear})`}
              </span>
              <span className={`zen-status-badge ${isCurrentActiveMonth ? '' : 'zen-badge-neutral'}`}>
                {isCurrentActiveMonth
                  ? `● Líquido al ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`
                  : isPastMonth
                  ? '● Saldo al Cierre'
                  : '● Proyección Fin de Mes'}
              </span>
            </div>

            <button
              type="button"
              className="btn-secondary zen-btn-adjust"
              onClick={() => setIsAdjustDebitModalOpen(true)}
              title="Ajustar o fijar manualmente el saldo inicial de este mes"
            >
              <Pencil size={12} />
              <span>Ajustar Saldo</span>
            </button>
          </div>

          <div className="zen-amount tabular-nums">
            <span>
              {formatSoles(isCurrentActiveMonth ? debitStats.currentDebitBalanceToday : debitStats.projectedDebitBalanceMonthEnd)}
            </span>
          </div>

          <div className="zen-meta-stack">
            <div className="zen-context-row">
              <span className="zen-context-item">
                Saldo inicial: <strong>{formatSoles(initialDebitForMonth)}</strong>
                {isInitialDebitAuto && (
                  <span
                    className="badge badge-neutral"
                    style={{ marginLeft: '6px', fontSize: '0.68rem', padding: '1px 6px' }}
                    title="Arrastrado automáticamente del cierre del mes anterior"
                  >
                    Del mes anterior
                  </span>
                )}
              </span>
              {isCurrentActiveMonth && !debitStats.isSalaryCreditedToday && (
                <>
                  <span className="zen-separator">•</span>
                  <span className="zen-context-item">
                    Próximo sueldo: <strong>{formatSoles(debitStats.salariesPending)}</strong> ({debitStats.salaryPayDay}/{currentMonth.toString().padStart(2, '0')})
                  </span>
                </>
              )}
              {isPastMonth && (
                <>
                  <span className="zen-separator">•</span>
                  <span className="zen-context-item">
                    Ingresos del mes: <strong>{formatSoles(monthIncome)}</strong>
                  </span>
                </>
              )}
              {isFutureMonth && (
                <>
                  <span className="zen-separator">•</span>
                  <span className="zen-context-item">
                    Ingresos previstos: <strong>{formatSoles(monthIncome)}</strong>
                    {debitStats.otherIncomesTotalMonth > 0 && (
                      <span style={{ marginLeft: '5px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        (sueldo {formatSoles(totalSalaryAmount)} + extras {formatSoles(debitStats.otherIncomesTotalMonth)})
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>

            <div className="zen-projection-row">
              <div className="zen-projection-info">
                <span className={`badge ${diagnostic.isPositive ? 'badge-success' : 'badge-danger'}`}>
                  {diagnostic.isPositive ? 'Saldo a favor' : 'Faltante'}
                </span>
                <span className="zen-projection-text">
                  {diagnostic.isPositive ? (
                    <>
                      Cierre estimado del mes:{' '}
                      <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {formatSoles(diagnostic.liquidityMargin)}
                      </strong>{' '}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {isCurrentActiveMonth
                          ? (debitStats.isSalaryCreditedToday
                              ? '(con tu sueldo ya cobrado)'
                              : '(después de cobrar tu sueldo)')
                          : isFutureMonth
                          ? '(con tus ingresos proyectados)'
                          : '(cierre del período)'}
                      </span>
                    </>
                  ) : (
                    <>
                      Cierras el mes con un faltante de:{' '}
                      <strong className="tabular-nums text-danger">
                        {formatSoles(Math.abs(diagnostic.liquidityMargin))}
                      </strong>{' '}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        (para cubrir todos tus gastos y pagos)
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Flujo del mes: estilo Zen minimalista con salto de línea natural y tipografía limpia */}
        <div className="zen-hero-right">
          <div className="zen-flow-card">
            <span className="zen-flow-title flex items-center gap-xs">
              <ArrowDownLeft size={14} color="var(--accent-success)" />{' '}
              {isCurrentActiveMonth ? 'Ingresos del mes' : isFutureMonth ? 'Ingresos previstos' : 'Ingresos del mes'}
            </span>
            <span className="zen-flow-amount tabular-nums text-success">
              +{formatSoles(isCurrentActiveMonth ? realizedInflow : expectedInflow)}
            </span>
            <div className="zen-flow-sub">
              {isCurrentActiveMonth ? (
                debitStats.isSalaryCreditedToday ? (
                  <span>Sueldo acreditado ({formatSoles(totalSalaryAmount)})</span>
                ) : currentOtherIncomes.length > 0 ? (
                  <>
                    <span>Cobrado: {formatSoles(debitStats.salariesReceivedToday + debitStats.otherIncomesReceivedToday)}</span>
                    <span>Por cobrar: {formatSoles(debitStats.salariesPending + (debitStats.otherIncomesPending ?? Math.max(0, debitStats.otherIncomesTotalMonth - debitStats.otherIncomesReceivedToday)))}</span>
                  </>
                ) : (
                  <span>Sueldo previsto: {formatSoles(totalSalaryAmount)}</span>
                )
              ) : (
                <>
                  <span>Sueldo: {formatSoles(totalSalaryAmount)}</span>
                  {debitStats.otherIncomesTotalMonth > 0 && (
                    <span>Extras: +{formatSoles(debitStats.otherIncomesTotalMonth)}</span>
                  )}
                  {debitStats.collectedFromDebtors > 0 && (
                    <span>Cobros: +{formatSoles(debitStats.collectedFromDebtors)}</span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="zen-flow-divider" aria-hidden="true" />

          <div className="zen-flow-card">
            <span className="zen-flow-title flex items-center gap-xs">
              <ArrowUpRight size={14} color="var(--accent-danger)" />{' '}
              {isCurrentActiveMonth ? 'Gastos y pagos' : isFutureMonth ? 'Salidas programadas' : 'Gastos y pagos'}
            </span>
            <span className="zen-flow-amount tabular-nums text-danger">
              -{formatSoles(isCurrentActiveMonth ? realizedOutflow : isFutureMonth ? scheduledOutflow : pastOutflow)}
            </span>
            <div className="zen-flow-sub">
              {isCurrentActiveMonth ? (
                realizedOutflow === 0 && pendingThisMonth === 0 ? (
                  <span>Al día de hoy</span>
                ) : (
                  <>
                    <span>
                      Débito: {formatSoles(debitStats.debitExpensesPaidToday)} • Tarjetas: {formatSoles(debitStats.cardPaymentsPaidMonth)}
                    </span>
                    {debtPaidToday > 0 && <span>Deudas: {formatSoles(debtPaidToday)}</span>}
                    {pendingThisMonth > 0 && (
                      <span className="text-danger" style={{ fontWeight: 600 }}>
                        Por pagar: {formatSoles(pendingThisMonth)}
                        {debitStats.unpaidCardBillsUsdOnly > 0 && (
                          <span className="zen-flow-usd-note tabular-nums"> (${debitStats.unpaidCardBillsUsdOnly.toFixed(2)} USD)</span>
                        )}
                      </span>
                    )}
                  </>
                )
              ) : isFutureMonth ? (
                <>
                  {debitStats.unpaidCardBillsDueThisMonth > 0 && (
                    <span>
                      Tarjetas: {formatSoles(debitStats.unpaidCardBillsDueThisMonth)}
                      {debitStats.unpaidCardBillsUsdOnly > 0 && (
                        <span className="zen-flow-usd-note tabular-nums"> (${debitStats.unpaidCardBillsUsdOnly.toFixed(2)} USD)</span>
                      )}
                    </span>
                  )}
                  {debitStats.cardPaidInAdvanceThisMonth > 0 && debitStats.unpaidCardBillsDueThisMonth <= 0 && (
                    <span className="text-success">Tarjetas: al día</span>
                  )}
                  {debitStats.debitExpensesTotalMonth > 0 && (
                    <span>Débito: {formatSoles(debitStats.debitExpensesTotalMonth)}</span>
                  )}
                  {debitStats.scheduledDebtDueThisMonth > 0 && (
                    <span>Deudas: {formatSoles(debitStats.scheduledDebtDueThisMonth)}</span>
                  )}
                  {debitStats.unpaidCardBillsDueThisMonth <= 0 && debitStats.scheduledDebtDueThisMonth <= 0 && debitStats.debitExpensesTotalMonth <= 0 && (
                    <span>Sin salidas programadas</span>
                  )}
                </>
              ) : (
                <>
                  <span>
                    Débito: {formatSoles(debitStats.debitExpensesTotalMonth)} • Tarjetas: {formatSoles(debitStats.cardPaymentsPaidMonth)}
                  </span>
                  {debtPaidMonth > 0 && <span>Deudas: {formatSoles(debtPaidMonth)}</span>}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sugerencia inteligente de auditoría (discreta, no invasiva) */}
      {!isOverviewAuditDismissed && aiAnomalies.length > 0 && (
        <div className="overview-smart-suggestion-pill">
          <div className="suggestion-pill-content">
            <Sparkles size={15} className="suggestion-pill-icon" />
            <span>
              <strong>{aiAnomalies.length} {aiAnomalies.length === 1 ? 'observación detectada' : 'observaciones detectadas'}</strong> en los gastos del período.
            </span>
          </div>
          <div className="suggestion-pill-actions">
            <button
              type="button"
              className="btn-suggestion-action"
              onClick={() => setActiveTab('analysis')}
            >
              Revisar en Análisis
            </button>
            <button
              type="button"
              className="btn-suggestion-dismiss"
              onClick={() => handleToggleHideOverviewAudit(true)}
              title="Ocultar sugerencia de la pantalla principal"
              aria-label="Ocultar sugerencia"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* PRÓXIMOS VENCIMIENTOS DE TARJETAS (forward-looking: próximo pago real de cada
          tarjeta, sin importar el mes visible) */}
      {(() => {
        const now = new Date();
        const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
        const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dues = cardPaymentPlan
          .filter(p => p.nextDueAmount > 0.005 && p.nextDueDate)
          .map(p => {
            const days = Math.ceil((new Date(`${p.nextDueDate}T12:00:00`).getTime() - todayMs) / 86400000);
            return { p, days, weekday: WEEKDAYS[new Date(`${p.nextDueDate}T12:00:00`).getDay()] };
          })
          .sort((a, b) => a.days - b.days);
        if (dues.length === 0) return null;
        return (
          <CardDuesSection
            dues={dues}
            onNavigateToSchedule={() => {
              setCardsSubTab('schedule');
              setActiveTab('cards');
            }}
            formatDisplayDate={formatDisplayDate}
            formatSoles={formatSoles}
          />
        );
      })()}

      {/* FILA 2: ANÁLISIS DE GASTO Y COMPARATIVA (50% / 50% SIMÉTRICO) */}
      <div className="overview-grid-balanced">
        {/* Gráfico 1: Barra Segmentada de Categorías */}
        <div className="chart-panel clean-card" style={{ marginBottom: 0 }}>
          <div className="chart-header">
            <span className="chart-title">Distribución del Gasto por Categoría</span>
            <span className="badge badge-neutral">{categoryBreakdown.length} categorías activas</span>
          </div>

          <div className="category-progress-multi">
            {categoryBreakdown.map(item => (
              <div
                key={item.category.id}
                className="category-segment"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.category.color
                }}
                title={`${item.category.name}: ${formatSoles(item.total)} (${item.percentage.toFixed(1)}%)`}
              />
            ))}
          </div>

          <div className="category-legend-grid">
            {(showAllCats ? categoryBreakdown : categoryBreakdown.slice(0, 6)).map(item => (
              <div key={item.category.id} className="legend-item">
                <div className="legend-label-group">
                  <span className="legend-dot" style={{ backgroundColor: item.category.color }}></span>
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}
                    title={item.category.name}
                  >
                    {item.category.name}
                  </span>
                </div>
                <span className="legend-amount tabular-nums">
                  {item.percentage.toFixed(0)}% ({formatSoles(item.total)})
                </span>
              </div>
            ))}
          </div>

          {categoryBreakdown.length > 6 && (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: '10px', width: '100%', padding: '6px 10px', fontSize: '0.76rem' }}
              onClick={() => setShowAllCats(prev => !prev)}
            >
              {showAllCats ? 'Ver menos' : `Ver ${categoryBreakdown.length - 6} más`}
            </button>
          )}
        </div>

        {/* Gráfico 2: Comparativa de Flujo Mensual Dinámica */}
        <div className="chart-panel clean-card" style={{ marginBottom: 0 }}>
          <div className="chart-header">
            <span className="chart-title">Evolución de Meses</span>
            <span className="badge badge-neutral">
              {monthlyComparison.prevMonthLabel.split(' ')[0]} vs {monthlyComparison.currMonthLabel.split(' ')[0]}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="card-item-title" style={{ fontSize: '0.875rem' }}>{monthlyComparison.prevMonthLabel}</span>
                <span className="card-item-meta tabular-nums">Gasto: {formatSoles(monthlyComparison.prevExpense)}</span>
              </div>
              <div style={{ height: '9px', background: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${monthlyComparison.prevPercent}%`, height: '100%', background: 'var(--accent-warning)', borderRadius: '9999px', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="card-item-title" style={{ fontSize: '0.875rem' }}>{monthlyComparison.currMonthLabel}</span>
                <span className="card-item-meta tabular-nums">Gasto: {formatSoles(monthlyComparison.currExpense)}</span>
              </div>
              <div style={{ height: '9px', background: 'var(--bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${monthlyComparison.currPercent}%`, height: '100%', background: monthlyComparison.isReduction ? 'var(--accent-success)' : 'var(--accent-danger)', borderRadius: '9999px', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '4px' }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div className="card-item-caps">Variación Mensual</div>
                <div className={`card-amount-md tabular-nums ${monthlyComparison.isReduction ? 'text-success' : 'text-danger'}`} style={{ marginTop: '2px' }}>
                  {monthlyComparison.variationStr}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div className="card-item-caps">{monthlyComparison.isReduction ? 'Ahorro vs. Mes Anterior' : 'Diferencia en Gasto'}</div>
                <div className={`card-amount-md tabular-nums ${monthlyComparison.isReduction ? 'text-success' : 'text-danger'}`} style={{ marginTop: '2px' }}>
                  {formatSoles(monthlyComparison.differential)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overview-grid-balanced">
        {/* Movimientos Recientes */}
        <div className="transactions-panel clean-card">
          <div className="panel-toolbar">
            <span className="chart-title">Últimos Movimientos</span>
            <button
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setActiveTab('transactions')}
            >
              Ver todos ({monthMovementsTotal})
            </button>
          </div>

          {/* Vista Escritorio: Tabla compacta */}
          <div className="desktop-only table-responsive">
            <table className="tx-table">
              <thead>
                <tr>
                  <th style={{ width: '96px', paddingRight: '14px', whiteSpace: 'nowrap' }}>Fecha</th>
                  <th style={{ paddingLeft: '6px' }}>Concepto & Medio</th>
                  <th className="text-right" style={{ width: '120px', whiteSpace: 'nowrap' }}>Monto (S/)</th>
                  <th className="text-right" style={{ width: '50px', whiteSpace: 'nowrap' }}></th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map(m => {
                  if (m.kind === 'transaction') {
                    const t = m.data;
                    const pm = resolvePaymentMethod(t, paymentMethods);
                    return (
                      <tr key={`tx-${t.id}`} className={t.isFixedSubscription ? 'row-fixed-expense' : ''}>
                        <td className="card-item-meta tabular-nums" style={{ paddingRight: '14px', whiteSpace: 'nowrap' }}>
                          {formatDisplayDate(t.date)}
                        </td>
                        <td className="font-semibold text-primary" style={{ paddingLeft: '6px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', minWidth: 0 }}
                              title={t.description}
                            >
                              {t.description}
                            </span>
                            {t.isFixedSubscription && (
                              <span className="badge-fixed-tag" title="Gasto Fijo Recurrente" style={{ flexShrink: 0 }}>
                                <Repeat size={10} />
                                <span>Fijo</span>
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontSize: '0.72rem', color: pm?.color || 'var(--text-muted)' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: pm?.color || 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pm?.name || 'Débito / Efectivo'}
                            </span>
                          </div>
                        </td>
                        <td className="tx-amount-cell tabular-nums text-right font-semibold" style={{ whiteSpace: 'nowrap' }}>
                          {formatSoles(t.amountPen)}
                        </td>
                        <td className="text-right">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-action-icon"
                              onClick={() => handleOpenEditTransaction(t)}
                              title="Editar gasto"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="btn-action-icon"
                              onClick={() => promptDeleteTransaction(t)}
                              title="Eliminar gasto"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (m.kind === 'payable_payment') {
                    const pay = m.data;
                    const credGroup = creditorGroups.find(
                      g => g.creditorName?.trim().toLowerCase() === pay.creditorName?.trim().toLowerCase()
                    );
                    const isPaid = credGroup ? credGroup.isFullyPaid : false;
                    return (
                      <tr key={`pay-${pay.id}`} style={{ background: 'rgba(245, 158, 11, 0.03)' }}>
                        <td className="card-item-meta tabular-nums" style={{ paddingRight: '14px', whiteSpace: 'nowrap' }}>
                          {formatDisplayDate(pay.paymentDate)}
                        </td>
                        <td className="font-semibold text-primary" style={{ paddingLeft: '6px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', minWidth: 0 }}
                              title={`Amortización a ${pay.creditorName}`}
                            >
                              Amortización a {pay.creditorName}
                            </span>
                            <span className="badge badge-warning" style={{ fontSize: '0.625rem', padding: '1px 5px', flexShrink: 0 }}>
                              Deuda
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontSize: '0.72rem', color: '#10b981' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Cuenta Débito
                            </span>
                          </div>
                        </td>
                        <td className="tx-amount-cell tabular-nums text-right font-semibold" style={{ color: 'var(--accent-danger)', whiteSpace: 'nowrap' }}>
                          {pay.currency === 'USD' ? (
                            <div style={{ whiteSpace: 'nowrap' }}>
                              <span className="tabular-nums" style={{ fontWeight: 600 }}>-$ {pay.amount.toFixed(2)} USD</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap' }}>
                                -{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}
                              </span>
                            </div>
                          ) : (
                            `-${formatSoles(pay.amount)}`
                          )}
                        </td>
                        <td className="text-right">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-action-icon"
                              onClick={() => navigateToPayableCreditor(pay.creditorName)}
                              title={isPaid ? 'Ver en Historial Pagados (Deuda saldada)' : 'Ver saldo pendiente en Mis Deudas'}
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (m.kind === 'receivable_payment') {
                    const pay = m.data;
                    const dGroup = debtorGroups.find(
                      g => g.debtorName?.trim().toLowerCase() === pay.debtorName?.trim().toLowerCase()
                    );
                    const isPaid = dGroup ? dGroup.isFullyPaid : false;
                    return (
                      <tr key={`recpay-${pay.id}`} style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                        <td className="card-item-meta tabular-nums" style={{ paddingRight: '14px', whiteSpace: 'nowrap' }}>
                          {formatDisplayDate(pay.paymentDate)}
                        </td>
                        <td className="font-semibold text-primary" style={{ paddingLeft: '6px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', minWidth: 0 }}
                              title={`Cobro a ${pay.debtorName}`}
                            >
                              Cobro a {pay.debtorName}
                            </span>
                            <span className="badge badge-success" style={{ fontSize: '0.625rem', padding: '1px 5px', flexShrink: 0 }}>
                              Cobro Préstamo
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontSize: '0.72rem', color: '#10b981' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Cuenta Débito
                            </span>
                          </div>
                        </td>
                        <td className="tx-amount-cell tabular-nums text-right font-semibold" style={{ color: 'var(--accent-success)', whiteSpace: 'nowrap' }}>
                          {pay.currency === 'USD' ? (
                            <div style={{ whiteSpace: 'nowrap' }}>
                              <span className="tabular-nums" style={{ fontWeight: 600 }}>+$ {pay.amount.toFixed(2)} USD</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap' }}>
                                +{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}
                              </span>
                            </div>
                          ) : (
                            `+${formatSoles(pay.amount)}`
                          )}
                        </td>
                        <td className="text-right">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-action-icon"
                              onClick={() => navigateToDebtor(pay.debtorName)}
                              title={isPaid ? 'Ver en Historial Cobrados (Préstamo saldado)' : 'Ver saldo pendiente en Préstamos'}
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (m.kind === 'card_payment') {
                    const cp = m.data;
                    const pm = resolvePaymentMethod({ paymentMethodId: cp.paymentMethodId }, paymentMethods) || paymentMethods.find(p => p.id === cp.paymentMethodId);
                    return (
                      <tr key={`cp-${cp.id || m.sortDate}`} style={{ background: 'rgba(167, 139, 250, 0.03)' }}>
                        <td className="card-item-meta tabular-nums" style={{ paddingRight: '14px', whiteSpace: 'nowrap' }}>
                          {formatDisplayDate(cp.paymentDate)}
                        </td>
                        <td className="font-semibold text-primary" style={{ paddingLeft: '6px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', minWidth: 0 }}
                              title={`Abono a ${pm?.name || 'Tarjeta'}`}
                            >
                              Abono a {pm?.name || 'Tarjeta'}
                            </span>
                            <span className="badge badge-neutral" style={{ fontSize: '0.625rem', color: '#a78bfa', padding: '1px 5px', flexShrink: 0 }}>
                              Abono TC
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontSize: '0.72rem', color: '#10b981' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Cuenta Débito
                            </span>
                          </div>
                        </td>
                        <td className="tx-amount-cell tabular-nums text-right font-semibold" style={{ color: 'var(--accent-danger)', whiteSpace: 'nowrap' }}>
                          -{formatSoles(cp.amountPaid)}
                        </td>
                        <td className="text-right">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-action-icon"
                              onClick={() => setActiveTab('cards')}
                              title="Ver en Tarjetas"
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (m.kind === 'income') {
                    const inc = m.data;
                    return (
                      <tr key={`inc-${inc.id}`} style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                        <td className="card-item-meta tabular-nums" style={{ paddingRight: '14px', whiteSpace: 'nowrap' }}>
                          {formatDisplayDate(inc.date)}
                        </td>
                        <td className="font-semibold text-primary" style={{ paddingLeft: '6px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span
                              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', minWidth: 0 }}
                              title={inc.description}
                            >
                              {inc.description}
                            </span>
                            <span className="badge badge-success" style={{ fontSize: '0.625rem', padding: '1px 5px', flexShrink: 0 }}>
                              Ingreso
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontSize: '0.72rem', color: '#10b981' }}>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Cuenta Débito
                            </span>
                          </div>
                        </td>
                        <td className="tx-amount-cell tabular-nums text-right font-semibold" style={{ color: 'var(--accent-success)', whiteSpace: 'nowrap' }}>
                          +{formatSoles(inc.amount)}
                        </td>
                        <td className="text-right">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-action-icon"
                              onClick={() => setActiveTab('incomes')}
                              title="Ver en Ingresos"
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return null;
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Feed de Tarjetas Táctiles */}
          <div className="mobile-only mobile-tx-feed" style={{ marginTop: '8px' }}>
            {recentMovements.map(m => {
              if (m.kind === 'transaction') {
                const t = m.data;
                const cat = categories.find(c => c.id === t.categoryId);
                const pm = resolvePaymentMethod(t, paymentMethods);
                const isDeferred = pm?.type === 'credit';
                return (
                  <div key={`mob-tx-${t.id}`} className={`mobile-tx-card ${t.isFixedSubscription ? 'mobile-tx-card-fixed' : ''}`}>
                    <div className="mobile-tx-main-row">
                      <div className="mobile-tx-left">
                        <div className="mobile-tx-icon-wrap" style={{ background: `${cat?.color || '#6366f1'}18`, color: cat?.color || '#6366f1' }}>
                          <Tag size={16} />
                        </div>
                        <div className="mobile-tx-info">
                          <div className="mobile-tx-title-row">
                            <span className="mobile-tx-title" title={t.description}>{t.description}</span>
                            {t.isFixedSubscription && (
                              <span className="badge-fixed-tag">
                                <Repeat size={9} /> Fijo
                              </span>
                            )}
                          </div>
                          <div className="mobile-tx-meta" title={`${formatDisplayDate(t.date)} • ${pm?.name || 'Débito / Efectivo'}`}>
                            <span>{formatDisplayDate(t.date)}</span>
                            <span>•</span>
                            <span style={{ color: pm?.color || 'var(--text-secondary)', fontWeight: 500 }}>{pm?.name || 'Débito / Efectivo'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mobile-tx-right">
                        <span className="mobile-tx-amount tabular-nums">{formatSoles(t.amountPen)}</span>
                        <div className="mobile-tx-actions">
                          <button className="btn-action-icon" onClick={() => handleOpenEditTransaction(t)} title="Editar gasto">
                            <Pencil size={13} />
                          </button>
                          <button className="btn-action-icon" onClick={() => promptDeleteTransaction(t)} title="Eliminar gasto">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {isDeferred && (
                      <div className="mobile-tx-footer-row">
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Diferido</span>
                        <span className="mobile-tx-due">Vence el {formatDisplayDate(t.paymentDueDate)}</span>
                      </div>
                    )}
                  </div>
                );
              }

              if (m.kind === 'payable_payment') {
                const pay = m.data;
                const credGroup = creditorGroups.find(
                  g => g.creditorName?.trim().toLowerCase() === pay.creditorName?.trim().toLowerCase()
                );
                const isPaid = credGroup ? credGroup.isFullyPaid : false;
                return (
                  <div key={`mob-pay-${pay.id}`} className="mobile-tx-card" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
                    <div className="mobile-tx-main-row">
                      <div className="mobile-tx-left">
                        <div className="mobile-tx-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-warning)' }}>
                          <ArrowUpRight size={16} />
                        </div>
                        <div className="mobile-tx-info">
                          <div className="mobile-tx-title-row">
                            <span className="mobile-tx-title">Amortización a {pay.creditorName}</span>
                            <span className="badge badge-warning" style={{ fontSize: '0.625rem', padding: '1px 4px' }}>Deuda</span>
                          </div>
                          <div className="mobile-tx-meta">
                            <span>{formatDisplayDate(pay.paymentDate)}</span>
                            <span>•</span>
                            <span style={{ color: '#10b981', fontWeight: 500 }}>Cuenta Débito</span>
                          </div>
                        </div>
                      </div>
                      <div className="mobile-tx-right">
                        {pay.currency === 'USD' ? (
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span className="mobile-tx-amount tabular-nums text-danger" style={{ whiteSpace: 'nowrap' }}>-$ {pay.amount.toFixed(2)} USD</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap' }}>
                              -{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}
                            </span>
                          </div>
                        ) : (
                          <span className="mobile-tx-amount tabular-nums text-danger" style={{ whiteSpace: 'nowrap' }}>-{formatSoles(pay.amount)}</span>
                        )}
                        <div className="mobile-tx-actions">
                          <button
                            className="btn-action-icon"
                            onClick={() => navigateToPayableCreditor(pay.creditorName)}
                            title={isPaid ? 'Ver en Historial Pagados (Deuda saldada)' : 'Ver saldo pendiente en Mis Deudas'}
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (m.kind === 'receivable_payment') {
                const pay = m.data;
                const dGroup = debtorGroups.find(
                  g => g.debtorName?.trim().toLowerCase() === pay.debtorName?.trim().toLowerCase()
                );
                const isPaid = dGroup ? dGroup.isFullyPaid : false;
                return (
                  <div key={`mob-recpay-${pay.id}`} className="mobile-tx-card" style={{ borderLeft: '3px solid var(--accent-success)' }}>
                    <div className="mobile-tx-main-row">
                      <div className="mobile-tx-left">
                        <div className="mobile-tx-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)' }}>
                          <TrendingUp size={16} />
                        </div>
                        <div className="mobile-tx-info">
                          <div className="mobile-tx-title-row">
                            <span className="mobile-tx-title">Cobro a {pay.debtorName}</span>
                            <span className="badge badge-success" style={{ fontSize: '0.625rem', padding: '1px 4px' }}>Cobro Préstamo</span>
                          </div>
                          <div className="mobile-tx-meta">
                            <span>{formatDisplayDate(pay.paymentDate)}</span>
                            <span>•</span>
                            <span style={{ color: '#10b981', fontWeight: 500 }}>Cuenta Débito</span>
                          </div>
                        </div>
                      </div>
                      <div className="mobile-tx-right">
                        {pay.currency === 'USD' ? (
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span className="mobile-tx-amount tabular-nums text-success" style={{ whiteSpace: 'nowrap', color: 'var(--accent-success)' }}>+$ {pay.amount.toFixed(2)} USD</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap' }}>
                              +{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}
                            </span>
                          </div>
                        ) : (
                          <span className="mobile-tx-amount tabular-nums text-success" style={{ whiteSpace: 'nowrap', color: 'var(--accent-success)' }}>+{formatSoles(pay.amount)}</span>
                        )}
                        <div className="mobile-tx-actions">
                          <button
                            className="btn-action-icon"
                            onClick={() => navigateToDebtor(pay.debtorName)}
                            title={isPaid ? 'Ver en Historial Cobrados (Préstamo saldado)' : 'Ver saldo pendiente en Préstamos'}
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (m.kind === 'card_payment') {
                const cp = m.data;
                const pm = resolvePaymentMethod({ paymentMethodId: cp.paymentMethodId }, paymentMethods) || paymentMethods.find(p => p.id === cp.paymentMethodId);
                return (
                  <div key={`mob-cp-${cp.id || m.sortDate}`} className="mobile-tx-card" style={{ borderLeft: '3px solid #a78bfa' }}>
                    <div className="mobile-tx-main-row">
                      <div className="mobile-tx-left">
                        <div className="mobile-tx-icon-wrap" style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' }}>
                          <CreditCard size={16} />
                        </div>
                        <div className="mobile-tx-info">
                          <div className="mobile-tx-title-row">
                            <span className="mobile-tx-title">Abono a {pm?.name || 'Tarjeta'}</span>
                            <span className="badge badge-neutral" style={{ fontSize: '0.625rem', color: '#a78bfa', padding: '1px 4px' }}>Abono TC</span>
                          </div>
                          <div className="mobile-tx-meta">
                            <span>{formatDisplayDate(cp.paymentDate)}</span>
                            <span>•</span>
                            <span style={{ color: '#10b981', fontWeight: 500 }}>Cuenta Débito</span>
                          </div>
                        </div>
                      </div>
                      <div className="mobile-tx-right">
                        <span className="mobile-tx-amount tabular-nums text-danger">-{formatSoles(cp.amountPaid)}</span>
                        <div className="mobile-tx-actions">
                          <button className="btn-action-icon" onClick={() => setActiveTab('cards')} title="Ver en Tarjetas">
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (m.kind === 'income') {
                const inc = m.data;
                return (
                  <div key={`mob-inc-${inc.id}`} className="mobile-tx-card" style={{ borderLeft: '3px solid var(--accent-success)' }}>
                    <div className="mobile-tx-main-row">
                      <div className="mobile-tx-left">
                        <div className="mobile-tx-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)' }}>
                          <TrendingUp size={16} />
                        </div>
                        <div className="mobile-tx-info">
                          <div className="mobile-tx-title-row">
                            <span className="mobile-tx-title">{inc.description}</span>
                            <span className="badge badge-success" style={{ fontSize: '0.625rem', padding: '1px 4px' }}>Ingreso</span>
                          </div>
                          <div className="mobile-tx-meta">
                            <span>{formatDisplayDate(inc.date)}</span>
                            <span>•</span>
                            <span style={{ color: '#10b981', fontWeight: 500 }}>Cuenta Débito</span>
                          </div>
                        </div>
                      </div>
                      <div className="mobile-tx-right">
                        <span className="mobile-tx-amount tabular-nums text-success">+{formatSoles(inc.amount)}</span>
                        <div className="mobile-tx-actions">
                          <button className="btn-action-icon" onClick={() => setActiveTab('incomes')} title="Ver en Ingresos">
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>

        {/* Asesor de Tarjetas */}
        <div className="advisor-card clean-card">
          <div className="chart-header">
            <span className="chart-title">Optimización de Ciclos de Crédito</span>
            <span className="badge badge-neutral tabular-nums">
              {isCurrentActiveMonth ? `Hoy ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}` : `${monthNames[currentMonth]} ${currentYear}`}
            </span>
          </div>

          {cardAdvisor.recommendedCard && (
            <div
              className="card-pill-hero"
              style={{
                borderLeft: `4px solid ${cardAdvisor.recommendedCard.color || 'var(--accent-brand)'}`,
                background: 'var(--bg-subtle)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <span className="card-item-title" title={cardAdvisor.recommendedCard.name} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
                  Usa hoy: {cardAdvisor.recommendedCard.name}
                </span>
                <span className="badge badge-success tabular-nums" style={{ flexShrink: 0 }}>
                  {cardAdvisor.creditDays} días libres
                </span>
              </div>
              <p className="card-item-subtitle" style={{ margin: 0, fontSize: '0.835rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {cardAdvisor.reason}
              </p>
              {/* Control de Cobertura de Vencimientos - Estilo Zen sin anidación */}
              {(() => {
                if (cardsLiquidityAssessment.totalDueSoon < 0.01) return null;
                const { hasAnySalaryMismatch, hasAnyDeficit, primarySalaryPayDay } = cardsLiquidityAssessment;

                if (hasAnySalaryMismatch) {
                  return (
                    <div className="advisor-mismatch-banner">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-warning)' }}>
                          Desfase Pre-Nómina
                        </span>
                        <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          Atención
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                        Compromisos antes de nómina (día {primarySalaryPayDay}): <strong>{formatSoles(cardsLiquidityAssessment.totalDueBeforeSalary)}</strong> · Saldo disponible: {formatSoles(cardsLiquidityAssessment.currentAvailableToday)} · Brecha: <strong className="text-danger">-{formatSoles(cardsLiquidityAssessment.shortfallBeforeSalary)}</strong>.
                      </p>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Cierre solvente tras abono de nómina ({formatSoles(debitStats.projectedDebitBalanceMonthEnd)}).
                      </div>
                    </div>
                  );
                }

                if (hasAnyDeficit) {
                  return (
                    <div className="advisor-deficit-banner">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-danger)' }}>
                          Déficit Proyectado
                        </span>
                        <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                          Déficit
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                        Compromisos totales: <strong>{formatSoles(cardsLiquidityAssessment.totalDueSoon)}</strong> · Saldo al cierre: {formatSoles(debitStats.projectedDebitBalanceMonthEnd)}.
                      </p>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Requiere provisión de fondos para cubrir obligaciones del período.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="advisor-covered-callout">
                    <CheckCircle2 size={16} color="var(--accent-success)" style={{ flexShrink: 0 }} />
                    <span>
                      Próximos pagos de tarjeta (<strong>{formatSoles(cardsLiquidityAssessment.totalDueSoon)}</strong>) cubiertos con liquidez proyectada.
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <span className="card-item-caps">
              Otras tarjetas disponibles
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {cardAdvisor.allRanked.slice(1).map(({ card, creditDays, utilization }) => (
                <div
                  key={card.id}
                  className="advisor-other-card-row"
                >
                  <span className="card-item-title" style={{ fontSize: '0.85rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={card.name}>{card.name}</span>
                  <span className="card-item-meta tabular-nums" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    <span>{creditDays} días libres</span>
                    {utilization > 0 && (
                      <span style={{ color: utilization >= 80 ? 'var(--accent-danger)' : utilization > 30 ? 'var(--accent-warning)' : 'var(--text-muted)' }}>
                        • {Math.round(utilization)}% uso
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
