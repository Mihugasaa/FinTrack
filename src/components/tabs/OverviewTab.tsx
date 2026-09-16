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
  X
} from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';

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
    categoryBreakdown,
    monthlyComparison,
    setActiveTab,
    setCardsSubTab,
    aiAnomalies,
    handleDismissAnomaly,
    paymentMethods,
    categories,
    cardPaymentPlan,
    resolvePaymentMethod,
    handleOpenEditTransaction,
    promptDeleteTransaction,
    cardAdvisor,
    formatDisplayDate,
    formatSoles
  } = useFinance();

  // Distribución por categoría: mostramos 6 por defecto y el resto tras "Ver más"
  // (evita saturar sin ocultar información: el badge indica el total real).
  const [showAllCats, setShowAllCats] = React.useState(false);

  // Últimos movimientos "a la fecha": en el mes en curso solo mostramos gastos con
  // fecha hasta hoy (no los programados a futuro dentro del mismo mes). En meses
  // pasados/futuros se muestra el mes completo. Ya vienen ordenados por fecha desc.
  const recentTransactions = React.useMemo(() => {
    const list = isCurrentActiveMonth
      ? currentMonthTransactions.filter(t => t.date <= currentDateStr)
      : currentMonthTransactions;
    return list.slice(0, 5);
  }, [currentMonthTransactions, isCurrentActiveMonth, currentDateStr]);

  // Flujo del mes visible (para las tarjetas Entradas/Salidas, según el mes sea en
  // curso, pasado o futuro). Los "previstos" incluyen sueldo + ingresos extra del mes.
  const monthIncome = totalSalaryAmount + debitStats.otherIncomesTotalMonth;
  const expectedInflow = monthIncome + debitStats.collectedFromDebtors;
  const realizedInflow = debitStats.salariesReceivedToday + debitStats.otherIncomesReceivedToday + debitStats.collectedFromDebtors;
  const realizedOutflow = debitStats.debitExpensesPaidToday + debitStats.cardPaymentsPaidMonth;
  const pastOutflow = debitStats.debitExpensesTotalMonth + debitStats.cardPaymentsPaidMonth;
  // Salida programada del mes futuro: gastos débito registrados + cuotas de tarjeta
  // por vencer + deudas propias programadas de ese mes.
  const scheduledOutflow = debitStats.debitExpensesTotalMonth + debitStats.cardBillsDueThisMonth + debitStats.scheduledDebtDueThisMonth;
  // Lo que aún falta pagar en el mes en curso (para no quedar solo con lo "efectuado").
  const pendingThisMonth = debitStats.unpaidCardBillsDueThisMonth + debitStats.scheduledDebtDueThisMonth;

  return (
    <div>
      {/* TIRA DE ALERTAS PROACTIVAS: auditoría IA resumida y descartable. El
          detalle completo vive en el tab Análisis (Mes actual). Solo aparece si
          hay anomalías activas. */}
      {aiAnomalies.length > 0 && (
        <section className="overview-alert-strip clean-card">
          <div className="alert-strip-head">
            <span className="alert-strip-title">
              <AlertTriangle size={16} color="var(--accent-warning)" />
              Auditoría: {aiAnomalies.length} {aiAnomalies.length === 1 ? 'alerta por revisar' : 'alertas por revisar'}
            </span>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setActiveTab('analysis')}
            >
              Ver detalle
            </button>
          </div>
          <div className="alert-strip-list">
            {aiAnomalies.slice(0, 3).map(anom => (
              <div key={anom.id} className="alert-strip-item">
                <span className="alert-strip-dot" data-sev={anom.severity} />
                <span className="alert-strip-text" title={anom.description}>{anom.title}</span>
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
            ))}
            {aiAnomalies.length > 3 && (
              <button
                type="button"
                className="alert-strip-more"
                onClick={() => setActiveTab('analysis')}
              >
                +{aiAnomalies.length - 3} más en Análisis
              </button>
            )}
          </div>
        </section>
      )}

      {/* 3. HERO MASTER: MI DINERO EN DÉBITO (ARMONÍA ZEN Y FOCO EN LIQUIDEZ) */}
      <section className="zen-hero clean-card">
        <div className="zen-hero-left">
          <div className="zen-tag-row">
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

          <div className="zen-amount tabular-nums">
            <span>
              {formatSoles(isCurrentActiveMonth ? debitStats.currentDebitBalanceToday : debitStats.projectedDebitBalanceMonthEnd)}
            </span>
          </div>

          <div className="zen-context-row">
            <span className="zen-context-item">
              Saldo base: <strong>{formatSoles(initialDebitForMonth)}</strong>
              {isInitialDebitAuto && (
                <span
                  style={{ marginLeft: '5px', fontSize: '0.72rem', color: 'var(--accent-info)', fontWeight: 600 }}
                  title="Arrastrado automáticamente del cierre del mes anterior"
                >
                  ↳ arrastrado
                </span>
              )}
            </span>
            <span>•</span>
            {isCurrentActiveMonth && !debitStats.isSalaryCreditedToday && (
              <>
                <span className="zen-context-item">
                  ⏳ Sueldo por cobrar: <strong>{formatSoles(debitStats.salariesPending)}</strong> ({debitStats.salaryPayDay}/{currentMonth.toString().padStart(2, '0')})
                </span>
                <span>•</span>
              </>
            )}
            {isPastMonth && (
              <>
                <span className="zen-context-item">
                  Ingresos del mes: <strong>{formatSoles(monthIncome)}</strong>
                </span>
                <span>•</span>
              </>
            )}
            {isFutureMonth && (
              <>
                <span className="zen-context-item">
                  Ingresos previstos: <strong>{formatSoles(monthIncome)}</strong>
                  {debitStats.otherIncomesTotalMonth > 0 && (
                    <span style={{ marginLeft: '5px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      (sueldo {formatSoles(totalSalaryAmount)} + extras {formatSoles(debitStats.otherIncomesTotalMonth)})
                    </span>
                  )}
                </span>
                <span>•</span>
              </>
            )}
            <span
              className="zen-context-item"
              style={{ color: diagnostic.isPositive ? 'var(--accent-success)' : 'var(--accent-danger)' }}
            >
              Margen:{' '}
              <strong>
                {diagnostic.isPositive
                  ? `Alcanza ${formatSoles(diagnostic.liquidityMargin)} ✅`
                  : `Déficit ${formatSoles(Math.abs(diagnostic.liquidityMargin))} ⚠️`}
              </strong>
            </span>
            <button
              className="btn-adjust-link"
              onClick={() => setIsAdjustDebitModalOpen(true)}
              title="Ajustar o fijar manualmente el saldo inicial de este mes"
              style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Pencil size={12} color="var(--text-muted)" />
              <span>Ajustar Saldo</span>
            </button>
          </div>
        </div>

        {/* Flujo del mes: en curso muestra lo acreditado/efectuado; en meses
            futuros muestra lo previsto/programado (para que no salga todo en S/0). */}
        <div className="zen-hero-right">
          <div className="zen-flow-card">
            <span className="zen-flow-title flex items-center gap-xs">
              <ArrowDownLeft size={13} color="var(--accent-success)" />{' '}
              {isCurrentActiveMonth ? 'Entradas Acreditadas' : isFutureMonth ? 'Ingresos Previstos' : 'Entradas del Mes'}
            </span>
            <span className="zen-flow-amount tabular-nums text-success">
              +{formatSoles(isCurrentActiveMonth ? realizedInflow : expectedInflow)}
            </span>
            <span className="zen-flow-sub">
              {isCurrentActiveMonth
                ? (debitStats.isSalaryCreditedToday
                    ? 'Sueldo acreditado'
                    : currentOtherIncomes.length > 0
                    ? `${currentOtherIncomes[0].description} S/ ${debitStats.otherIncomesReceivedToday.toFixed(2)}`
                    : 'Sin extras aún')
                : `Sueldo ${formatSoles(totalSalaryAmount)}${debitStats.otherIncomesTotalMonth > 0 ? ` • Extras ${formatSoles(debitStats.otherIncomesTotalMonth)}` : ''}${debitStats.collectedFromDebtors > 0 ? ` • Cobros ${formatSoles(debitStats.collectedFromDebtors)}` : ''}`}
            </span>
          </div>

          <div className="zen-flow-card">
            <span className="zen-flow-title flex items-center gap-xs">
              <ArrowUpRight size={13} color="var(--accent-danger)" />{' '}
              {isCurrentActiveMonth ? 'Salidas Efectuadas' : isFutureMonth ? 'Salidas Programadas' : 'Salidas del Mes'}
            </span>
            <span className="zen-flow-amount tabular-nums text-danger">
              -{formatSoles(isCurrentActiveMonth ? realizedOutflow : isFutureMonth ? scheduledOutflow : pastOutflow)}
            </span>
            <span className="zen-flow-sub">
              {isCurrentActiveMonth
                ? `Débito ${formatSoles(debitStats.debitExpensesPaidToday)} • Tarjetas ${formatSoles(debitStats.cardPaymentsPaidMonth)}${pendingThisMonth > 0 ? ` • Por pagar ${formatSoles(pendingThisMonth)}` : ''}`
                : isFutureMonth
                ? `Tarjetas ${formatSoles(debitStats.cardBillsDueThisMonth)} • Deudas ${formatSoles(debitStats.scheduledDebtDueThisMonth)}${debitStats.debitExpensesTotalMonth > 0 ? ` • Débito ${formatSoles(debitStats.debitExpensesTotalMonth)}` : ''}`
                : `Débito ${formatSoles(debitStats.debitExpensesTotalMonth)} • Tarjetas ${formatSoles(debitStats.cardPaymentsPaidMonth)}`}
            </span>
          </div>
        </div>
      </section>

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
          <section className="clean-card" style={{ marginBottom: '16px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💳</span> Próximos Vencimientos de Tarjetas
              </span>
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => { setCardsSubTab('schedule'); setActiveTab('cards'); }}
              >
                Ver planificador
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {dues.slice(0, 4).map(d => {
                const color = d.days < 0 ? 'var(--accent-danger)' : d.days <= 3 ? 'var(--accent-warning)' : 'var(--accent-info)';
                const label = d.days < 0 ? `venció hace ${Math.abs(d.days)} d` : d.days === 0 ? 'vence hoy' : `en ${d.days} d`;
                return (
                  <div key={d.p.cardId} style={{ flex: '1 1 180px', minWidth: '160px', border: '1px solid var(--border-subtle)', borderLeft: `4px solid ${d.p.cardColor}`, borderRadius: '10px', padding: '8px 12px', background: 'var(--bg-subtle)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{d.p.cardName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {d.weekday} {formatDisplayDate(d.p.nextDueDate!)} <span style={{ color: 'var(--border-medium)', fontWeight: 400 }}>|</span> <span style={{ color, fontWeight: 700 }}>{label}</span>
                    </div>
                    <div className="tabular-nums" style={{ fontWeight: 800, color: 'var(--accent-danger)', marginTop: '2px' }}>{formatSoles(d.p.nextDueAmount)}</div>
                  </div>
                );
              })}
            </div>
          </section>
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
                <div className="card-item-caps">Variación Gasto</div>
                <div className={`card-amount-md tabular-nums ${monthlyComparison.isReduction ? 'text-success' : 'text-danger'}`} style={{ marginTop: '2px' }}>
                  {monthlyComparison.variationStr}
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div className="card-item-caps">Diferencial Consumo</div>
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
              Ver todos ({currentMonthTransactions.length})
            </button>
          </div>

          {/* Vista Escritorio: Tabla compacta */}
          <div className="desktop-only table-responsive">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Medio</th>
                  <th className="text-right">Monto (S/)</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(t => {
                  const pm = resolvePaymentMethod(t, paymentMethods);
                  return (
                    <tr key={t.id} className={t.isFixedSubscription ? 'row-fixed-expense' : ''}>
                      <td className="card-item-meta tabular-nums">
                        {formatDisplayDate(t.date)}
                      </td>
                      <td className="font-semibold text-primary">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                            title={t.description}
                          >
                            {t.description}
                          </span>
                          {t.isFixedSubscription && (
                            <span className="badge-fixed-tag" title="Gasto Fijo Recurrente">
                              <Repeat size={10} />
                              <span>Fijo</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td title={pm?.name || 'Débito / Efectivo'}>
                        <span
                          className="badge badge-neutral"
                          style={{ color: pm?.color || 'var(--text-secondary)', display: 'inline-block', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={pm?.name || 'Débito / Efectivo'}
                        >
                          {pm?.name || 'Débito / Efectivo'}
                        </span>
                      </td>
                      <td className="tabular-nums text-right font-semibold">
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
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Feed de Tarjetas Táctiles */}
          <div className="mobile-only mobile-tx-feed" style={{ marginTop: '8px' }}>
            {recentTransactions.map(t => {
              const cat = categories.find(c => c.id === t.categoryId);
              const pm = resolvePaymentMethod(t, paymentMethods);
              const isDeferred = pm?.type === 'credit';
              return (
                <div key={t.id} className={`mobile-tx-card ${t.isFixedSubscription ? 'mobile-tx-card-fixed' : ''}`}>
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
            <div className="card-pill-hero">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="card-item-title" title={cardAdvisor.recommendedCard.name}>
                  Usa hoy: {cardAdvisor.recommendedCard.name}
                </span>
                <span className="badge badge-success tabular-nums">
                  {cardAdvisor.creditDays} días libres
                </span>
              </div>
              <p className="card-item-subtitle" style={{ margin: 0 }}>
                {cardAdvisor.reason}
              </p>
              {/* Nota de "¿podré pagarlo?": compara lo que vence pronto en tarjetas con
                  tu saldo proyectado a fin de mes. */}
              {(() => {
                const totalCardDue = cardPaymentPlan.reduce((a, c) => a + c.nextDueAmount, 0);
                if (totalCardDue < 0.01) return null;
                const projected = debitStats.projectedDebitBalanceMonthEnd;
                const ok = projected >= totalCardDue;
                return (
                  <div
                    style={{
                      marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-subtle)',
                      fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'flex-start'
                    }}
                  >
                    <span>{ok ? '✅' : '⚠️'}</span>
                    <span>
                      Vencen pronto <strong className="tabular-nums">{formatSoles(totalCardDue)}</strong> en tarjetas.
                      Tu proyección a fin de mes es <strong className="tabular-nums" style={{ color: ok ? 'var(--accent-success)' : 'var(--accent-danger)' }}>{formatSoles(projected)}</strong>
                      {ok ? ', alcanza para cubrirlas.' : ', quedarías corto: abona lo que puedas antes del corte.'}
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
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <span className="card-item-title" style={{ fontSize: '0.85rem' }} title={card.name}>{card.name}</span>
                  <span className="card-item-meta tabular-nums" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span>{creditDays} días libres</span>
                    {utilization > 0 && (
                      <span style={{ color: utilization >= 80 ? 'var(--accent-danger)' : utilization > 30 ? 'var(--accent-warning)' : 'var(--text-muted)' }}>
                        {Math.round(utilization)}% uso
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
