'use client';

import React from 'react';
import {
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Repeat,
  Pencil,
  Trash2,
  Tag
} from 'lucide-react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { Transaction, PaymentMethod, Category, OtherIncome } from '@/types';
import { ActiveTab } from '@/hooks/useTabNavigation';

interface OverviewTabProps {
  isCurrentActiveMonth: boolean;
  isPastMonth: boolean;
  isFutureMonth: boolean;
  monthNames: string[];
  currentMonth: number;
  currentYear: number;
  monthKey: string;
  now: Date;
  debitStats: {
    currentDebitBalanceToday: number;
    projectedDebitBalanceMonthEnd: number;
    isSalaryCreditedToday: boolean;
    salariesPending: number;
    salaryPayDay: number;
    salariesReceivedToday: number;
    otherIncomesReceivedToday: number;
    collectedFromDebtors: number;
    debitExpensesPaidToday: number;
    cardPaymentsPaidMonth: number;
  };
  initialDebitForMonth: number;
  totalSalaryAmount: number;
  currentOtherIncomes: OtherIncome[];
  setTempDebitBalance: (v: string) => void;
  setIsAdjustDebitModalOpen: (open: boolean) => void;
  prevMonthClosingBalance: { monthName: string; amount: number } | null;
  setInitialDebitBalances: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  diagnostic: {
    isPositive: boolean;
    liquidityMargin: number;
    totalAvailable: number;
    realCashOutflow: number;
    totalExpensesConsumed: number;
    savingsRatePercentage: number;
  };
  fixedExpensesTotal: number;
  currentMonthTransactions: Transaction[];
  categoryBreakdown: Array<{
    category: { id: string; name: string; color: string };
    total: number;
    percentage: number;
  }>;
  monthlyComparison: {
    prevMonthLabel: string;
    currMonthLabel: string;
    prevExpense: number;
    currExpense: number;
    prevPercent: number;
    currPercent: number;
    isReduction: boolean;
    variationStr: string;
    differential: number;
  };
  setActiveTab: (tab: ActiveTab) => void;
  paymentMethods: PaymentMethod[];
  categories: Category[];
  resolvePaymentMethod: (tx: any, pms: PaymentMethod[]) => PaymentMethod | undefined;
  handleOpenEditTransaction: (t: Transaction) => void;
  promptDeleteTransaction: (t: Transaction) => void;
  cardAdvisor: {
    recommendedCard?: PaymentMethod;
    creditDays: number;
    allRanked: Array<{
      card: { id: string; name: string };
      creditDays: number;
    }>;
  };
  formatDisplayDate: (d?: string) => string;
  formatSoles: (v: number) => string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  isCurrentActiveMonth,
  isPastMonth,
  isFutureMonth,
  monthNames,
  currentMonth,
  currentYear,
  monthKey,
  now,
  debitStats,
  initialDebitForMonth,
  totalSalaryAmount,
  currentOtherIncomes,
  setTempDebitBalance,
  setIsAdjustDebitModalOpen,
  prevMonthClosingBalance,
  setInitialDebitBalances,
  diagnostic,
  fixedExpensesTotal,
  currentMonthTransactions,
  categoryBreakdown,
  monthlyComparison,
  setActiveTab,
  paymentMethods,
  categories,
  resolvePaymentMethod,
  handleOpenEditTransaction,
  promptDeleteTransaction,
  cardAdvisor,
  formatDisplayDate,
  formatSoles
}) => {
  return (
    <div>
      {/* 3. HERO MASTER: MI DINERO EN DÉBITO (ARMONÍA ZEN Y FOCO EN LIQUIDEZ) */}
      <section className="zen-hero clean-card">
        <div className="zen-hero-left">
          <div className="zen-tag-row">
            <span className="zen-tag-pill">
              {isCurrentActiveMonth
                ? 'Dinero Real Disponible'
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
                  Sueldo completado: <strong>{formatSoles(totalSalaryAmount)}</strong>
                </span>
                <span>•</span>
              </>
            )}
            {isFutureMonth && (
              <>
                <span className="zen-context-item">
                  Sueldo previsto: <strong>{formatSoles(totalSalaryAmount)}</strong>
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
              onClick={() => {
                setTempDebitBalance(initialDebitForMonth.toString());
                setIsAdjustDebitModalOpen(true);
              }}
              title="Ajustar saldo inicial de este mes"
              style={{ marginLeft: '4px' }}
            >
              ✏️ Ajustar Saldo
            </button>
            {initialDebitForMonth === 0 && prevMonthClosingBalance && prevMonthClosingBalance.amount > 0 && (
              <button
                className="btn-adjust-link"
                onClick={() => {
                  const newBal = prevMonthClosingBalance.amount;
                  setInitialDebitBalances(prev => ({
                    ...prev,
                    [monthKey]: newBal
                  }));
                  SupabaseDataService.updateInitialDebitBalance(currentYear, currentMonth, newBal);
                }}
                title={`Adoptar saldo de cierre de ${prevMonthClosingBalance.monthName} (${formatSoles(prevMonthClosingBalance.amount)})`}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: 'var(--accent-info)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={11} /> Traer cierre de {prevMonthClosingBalance.monthName} ({formatSoles(prevMonthClosingBalance.amount)})
              </button>
            )}
          </div>
        </div>

        {/* Flujo Real de Débito */}
        <div className="zen-hero-right">
          <div className="zen-flow-card">
            <span className="zen-flow-title flex items-center gap-xs">
              <ArrowDownLeft size={13} color="var(--accent-success)" /> Entradas Acreditadas
            </span>
            <span className="zen-flow-amount tabular-nums text-success">
              +{formatSoles(debitStats.salariesReceivedToday + debitStats.otherIncomesReceivedToday + debitStats.collectedFromDebtors)}
            </span>
            <span className="zen-flow-sub">
              {debitStats.isSalaryCreditedToday
                ? 'Sueldo acreditado'
                : currentOtherIncomes.length > 0
                ? `${currentOtherIncomes[0].description} S/ ${debitStats.otherIncomesReceivedToday.toFixed(2)}`
                : 'Sin extras aún'}
            </span>
          </div>

          <div className="zen-flow-card">
            <span className="zen-flow-title flex items-center gap-xs">
              <ArrowUpRight size={13} color="var(--accent-danger)" /> Salidas Efectuadas
            </span>
            <span className="zen-flow-amount tabular-nums text-danger">
              -{formatSoles(debitStats.debitExpensesPaidToday + debitStats.cardPaymentsPaidMonth)}
            </span>
            <span className="zen-flow-sub">
              Débito S/ {debitStats.debitExpensesPaidToday.toFixed(2)} • Tarjetas S/ {debitStats.cardPaymentsPaidMonth.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

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
            {categoryBreakdown.slice(0, 6).map(item => (
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
                {currentMonthTransactions.slice(0, 5).map(t => {
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
            {currentMonthTransactions.slice(0, 5).map(t => {
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
                <span className="card-item-title" title={cardAdvisor.recommendedCard.name}>{cardAdvisor.recommendedCard.name}</span>
                <span className="badge badge-success tabular-nums">
                  {cardAdvisor.creditDays} días libres
                </span>
              </div>
              <p className="card-item-subtitle" style={{ margin: 0 }}>
                Cierra el día {cardAdvisor.recommendedCard.billingCloseDay}. Al comprar hoy, pagarás recién el día {cardAdvisor.recommendedCard.paymentDueDay} del siguiente mes.
              </p>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <span className="card-item-caps">
              Otras tarjetas disponibles
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {cardAdvisor.allRanked.slice(1).map(({ card, creditDays }) => (
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
                  <span className="card-item-meta tabular-nums">{creditDays} días libres</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
