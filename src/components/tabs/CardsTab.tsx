'use client';

import React from 'react';
import {
  Plus,
  Pencil,
  Landmark,
  CreditCard,
  Trash2
} from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';

export const CardsTab: React.FC = () => {
  const {
    handleOpenCreateCardPayment,
    setIsCardModalOpen,
    setIsAdjustDebitModalOpen,
    debitStats,
    cardDebtSummary,
    cardPaymentPlan,
    cardsLiquidityAssessment,
    paymentMethods,
    handleOpenEditCard,
    showAllHistoricalPayments,
    setShowAllHistoricalPayments,
    monthNames,
    currentMonth,
    currentYear,
    cardPayments,
    currentMonthCardPayments,
    handleOpenEditCardPayment,
    handleDeleteCardPayment,
    cardsSubTab: activeSubTab,
    setCardsSubTab: setActiveSubTab,
    formatDisplayDate,
    formatSoles
  } = useFinance();

  // Cálculo de Deuda Consolidada Total en Tarjetas de Crédito
  const totalCreditDebt = cardDebtSummary.reduce(
    (acc, c) => acc + (c.hasPositiveBalance ? 0 : c.totalAccumulatedDebt),
    0
  );
  const totalCreditDebtPen = cardDebtSummary.reduce(
    (acc, c) => acc + (c.hasPositiveBalance ? 0 : (c.totalAccumulatedDebtPen ?? c.totalAccumulatedDebt)),
    0
  );
  const totalCreditDebtUsd = cardDebtSummary.reduce(
    (acc, c) => acc + (c.hasPositiveBalance ? 0 : (c.totalAccumulatedDebtUsd || 0)),
    0
  );

  // Total pagado a tarjetas en el mes seleccionado
  const totalPaidToCardsThisMonth = currentMonthCardPayments.reduce(
    (acc, p) => acc + (p.amountPen !== undefined ? p.amountPen : p.amountPaid),
    0
  );

  const displayedPayments = showAllHistoricalPayments
    ? [...cardPayments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    : currentMonthCardPayments;

  const formatPaymentTargetMonth = (ym: string) => {
    const parts = ym.split('-');
    if (parts.length !== 2) return ym;
    const [y, m] = parts;
    const idx = parseInt(m, 10);
    const name = monthNames[idx] || ym;
    return `${name} ${y}`;
  };

  return (
    <div>
      {/* Cabecera Principal de Pestaña */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="panel-header-title">
            Cuentas y Tarjetas
          </h2>
          <p className="panel-header-subtitle">
            Saldos disponibles, líneas de crédito y próximos vencimientos
          </p>
        </div>
        <div className="action-group">
          <button className="btn-primary" onClick={() => setIsCardModalOpen(true)}>
            <Plus size={15} />
            <span>Nueva Tarjeta / Cuenta</span>
          </button>
        </div>
      </div>

      {/* Hero Débito (Liquidez en Cuenta) */}
      <div className="debit-hero-card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
        <div className="debit-hero-main">
          <div className="debit-icon-box">
            <Landmark size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Cuenta Débito
              </span>
              <span className="badge badge-collected" style={{ fontSize: '0.65rem' }}>
                Disponible
              </span>
            </div>
            <div
              className="debit-balance-val tabular-nums"
              style={{
                color: debitStats.currentDebitBalanceToday >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'
              }}
            >
              {formatSoles(debitStats.currentDebitBalanceToday)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Saldo disponible en cuenta bancaria
            </div>
          </div>
        </div>

        <div className="debit-hero-stats">
          <div className="debit-stat-item">
            <span className="debit-stat-label">Gastos del mes</span>
            <span className="debit-stat-val tabular-nums">
              {formatSoles(debitStats.debitExpenses)}
            </span>
          </div>

          <div className="debit-stat-item">
            <span className="debit-stat-label">Pagos de tarjeta</span>
            <span className="debit-stat-val tabular-nums" style={{ color: 'var(--accent-brand)' }}>
              {formatSoles(totalPaidToCardsThisMonth)}
            </span>
          </div>

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setIsAdjustDebitModalOpen(true)}
            title="Ajustar saldo inicial de cuenta débito"
          >
            <Pencil size={12} />
            <span>Ajustar Saldo</span>
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Crédito */}
      <div style={{ margin: '24px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={17} style={{ color: 'var(--accent-brand)' }} />
          <span>Tarjetas de Crédito ({cardDebtSummary.length})</span>
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Deuda total:{' '}
          <strong className="tabular-nums" style={{ color: totalCreditDebt > 0 ? 'var(--accent-warning)' : 'var(--accent-success)', fontSize: '0.875rem' }}>
            {formatSoles(totalCreditDebt)}
          </strong>
          {totalCreditDebtUsd > 0.009 && (
            <span className="tabular-nums" style={{ color: 'var(--text-secondary)', marginLeft: '6px', fontSize: '0.76rem', fontWeight: 500 }}>
              (incl. ${totalCreditDebtUsd.toFixed(2)} USD)
            </span>
          )}
        </span>
      </div>

      <div className="credit-cards-grid-2x2">
        {cardDebtSummary.map(card => {
          const pm = paymentMethods.find(p => p.id === card.paymentMethodId);
          const limit = pm?.creditLimit || 5000;
          const usedPercent = card.hasPositiveBalance ? 0 : Math.min(100, (card.totalAccumulatedDebt / limit) * 100);

          return (
            <div key={card.paymentMethodId} className="credit-card-zen" style={{ borderLeft: `4px solid ${card.cardColor}` }}>
              <div>
                <div className="card-zen-top">
                  <div>
                    <div className="card-zen-title" title={card.cardName}>
                      {card.cardName}
                    </div>
                    <div className="card-zen-limit">
                      Límite: {formatSoles(limit)} • Uso: {card.hasPositiveBalance ? '0%' : `${usedPercent.toFixed(0)}%`}
                    </div>
                  </div>
                  {pm && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 9px', fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleOpenEditCard(pm)}
                      title="Editar tarjeta y límites"
                    >
                      <Pencil size={11} />
                      <span>Editar</span>
                    </button>
                  )}
                </div>

                <div className="card-zen-debt-row" style={{ alignItems: 'flex-start', minHeight: '44px', marginBottom: '8px' }}>
                  <span className="card-zen-debt-label">
                    {card.hasPositiveBalance ? 'Saldo a favor' : 'Deuda actual'}
                  </span>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    {card.hasPositiveBalance ? (
                      <div className="card-zen-debt-val tabular-nums" style={{ color: 'var(--accent-success)', lineHeight: 1.1 }}>
                        +{formatSoles(card.creditBalanceAmount || 0)}
                      </div>
                    ) : card.hasUsdDebt && (card.totalAccumulatedDebtUsd || 0) > 0.009 ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <span className="card-zen-debt-val tabular-nums" style={{ color: 'var(--accent-warning)', lineHeight: 1.1 }}>
                            {formatSoles(card.totalAccumulatedDebtPen ?? card.totalAccumulatedDebt)}
                          </span>
                          <span className="tabular-nums" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-info)' }}>
                            ${(card.totalAccumulatedDebtUsd || 0).toFixed(2)} <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>USD</span>
                          </span>
                        </div>
                        <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Total estimado: {formatSoles(card.totalAccumulatedDebt)}
                        </div>
                      </>
                    ) : (
                      <div className="card-zen-debt-val tabular-nums" style={{ color: card.totalAccumulatedDebt > 0 ? 'var(--accent-warning)' : 'var(--accent-success)', lineHeight: 1.1 }}>
                        {formatSoles(card.totalAccumulatedDebt)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-zen-bar">
                  <div
                    className="card-zen-bar-fill"
                    style={{ width: `${usedPercent}%`, background: card.cardColor }}
                  />
                </div>
              </div>

              <div className="card-zen-meta-grid">
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.725rem' }}>
                    Facturación:
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Cierre d. {card.billingCloseDay} • Pago d. {card.paymentDueDay}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.725rem' }}>
                    {card.paidThisMonth > 0 ? 'Abonos del mes:' : (card.paidInAdvanceForSelectedMonth || 0) > 0 ? 'Abono anticipado:' : 'Abonos del mes:'}
                  </span>
                  <strong
                    className="tabular-nums"
                    style={{
                      color: (card.paidThisMonth > 0 || (card.paidInAdvanceForSelectedMonth || 0) > 0) ? 'var(--accent-success)' : 'var(--text-muted)'
                    }}
                  >
                    {card.paidThisMonth > 0
                      ? `+${formatSoles(card.paidThisMonth)}`
                      : (card.paidInAdvanceForSelectedMonth || 0) > 0
                      ? `+${formatSoles(card.paidInAdvanceForSelectedMonth!)}`
                      : formatSoles(0)}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Contenedor Píldora Unificado: Historial de Pagos & Cronograma */}
      <div className="tabs-unified-container">
        <div className="tabs-pills-header">
          <div className="tabs-pill-group">
            <button
              type="button"
              className={`tab-pill ${activeSubTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('payments')}
            >
              💳 Historial de Pagos ({currentMonthCardPayments.length})
            </button>
            <button
              type="button"
              className={`tab-pill ${activeSubTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('schedule')}
            >
              📅 Próximos Vencimientos
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {activeSubTab === 'payments' && cardPayments.length > currentMonthCardPayments.length && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                onClick={() => setShowAllHistoricalPayments(prev => !prev)}
              >
                {showAllHistoricalPayments ? `Ver solo ${monthNames[currentMonth]}` : `Ver histórico (${cardPayments.length})`}
              </button>
            )}

            <button
              type="button"
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => handleOpenCreateCardPayment()}
            >
              <Plus size={14} />
              <span>Registrar Pago</span>
            </button>
          </div>
        </div>

        {/* CONTENIDO 1: HISTORIAL DE PAGOS */}
        {activeSubTab === 'payments' && (
          <div>
            {displayedPayments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
                  No hay pagos a tarjetas registrados {showAllHistoricalPayments ? 'en el sistema' : `en ${monthNames[currentMonth]} ${currentYear}`}
                </p>
                <p style={{ fontSize: '0.78rem', margin: '4px 0 0 0' }}>
                  Cuando amortices la deuda de tu tarjeta, haz clic en &quot;Registrar Pago de Tarjeta&quot;. Se descontará de tu Saldo Débito y reducirá la deuda bancaria.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayedPayments.map((pay, idx) => {
                  const cardPm = paymentMethods.find(p => p.id === pay.paymentMethodId);
                  const payKey = pay.id || `cp-row-${idx}-${pay.paymentMethodId}`;
                  return (
                    <div
                      key={payKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-subtle)',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: cardPm ? `${cardPm.color}20` : 'rgba(99,102,241,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: cardPm?.color || 'var(--accent-brand)'
                          }}
                        >
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            Pago a {cardPm?.name || 'Tarjeta de Crédito'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span>Fecha: {formatDisplayDate(pay.paymentDate)}</span>
                            <span>•</span>
                            <span style={{ color: 'var(--accent-brand)', fontWeight: 500 }}>
                              Origen: {
                                pay.sourceType === 'MERCHANT_REFUND' ? 'Reembolso de Comercio' :
                                pay.sourceType === 'BANK_CREDIT' ? 'Abono / Cashback de Banco' :
                                pay.sourceType === 'USD_SAVINGS_ACCOUNT' ? 'Ahorros Propios en Dólares' :
                                'Cuenta Bancaria (Débito)'
                              }
                            </span>
                            {pay.targetMonth && pay.targetMonth !== 'EXTRAORDINARY' && (
                              <>
                                <span>•</span>
                                <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>
                                  Para: {formatPaymentTargetMonth(pay.targetMonth)}
                                </span>
                              </>
                            )}
                            {pay.currency === 'USD' && (
                              <>
                                <span>•</span>
                                <span style={{ color: 'var(--accent-info)', fontWeight: 600 }}>
                                  T.C. {(pay.exchangeRate || 1).toFixed(4)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right', marginRight: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                            {pay.currency === 'USD' ? 'Monto en USD' : 'Monto Pagado'}
                          </span>
                          <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent-danger)', whiteSpace: 'nowrap' }}>
                            {pay.currency === 'USD'
                              ? `-$${(pay.originalAmount !== undefined ? pay.originalAmount : pay.amountPaid).toFixed(2)} USD`
                              : `-${formatSoles(pay.amountPaid)}`}
                          </span>
                          {pay.itfAmount ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                              Débito: {formatSoles((pay.amountPen !== undefined ? pay.amountPen : pay.amountPaid) + pay.itfAmount)} (ITF +{formatSoles(pay.itfAmount)})
                            </span>
                          ) : (pay.currency === 'USD' && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                              ≈ {formatSoles(pay.amountPen !== undefined ? pay.amountPen : pay.amountPaid)}
                            </span>
                          ))}
                        </div>
                        <span
                          className={`badge ${pay.sourceType === 'USD_SAVINGS_ACCOUNT' || pay.sourceType === 'MERCHANT_REFUND' || pay.sourceType === 'BANK_CREDIT' ? 'badge-warning' : 'badge-collected'}`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {pay.sourceType === 'USD_SAVINGS_ACCOUNT' ? '💵 Fondos USD' :
                           pay.sourceType === 'MERCHANT_REFUND' ? 'Devolución' :
                           pay.sourceType === 'BANK_CREDIT' ? 'Abono Banco' :
                           '✓ Descontado de Débito'}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            onClick={() => handleOpenEditCardPayment(pay, idx)}
                            title="Modificar este abono a tarjeta"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-action-icon"
                            onClick={() => handleDeleteCardPayment(pay.id, idx)}
                            title="Eliminar este pago y revertir el descuento en saldo débito"
                            style={{ color: 'var(--accent-danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO 2: CRONOGRAMA DE VENCIMIENTOS Y CIERRES */}
        {activeSubTab === 'schedule' && (
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Fechas de pago y montos según el ciclo de facturación de cada tarjeta.
              </p>
              <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '5px 10px' }}>
                Total por vencer:{' '}
                <strong className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                  {formatSoles(cardPaymentPlan.reduce((acc, c) => acc + c.nextDueAmount, 0))}
                </strong>
              </span>
            </div>

            {/* Control de flujo y sincronización de haberes */}
            {cardsLiquidityAssessment.hasAnySalaryMismatch && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderLeft: '4px solid var(--accent-warning)',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                    Control de Flujo de Pagos · Ciclo en Curso
                  </span>
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                    Desfase Pre-Abono
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Existen compromisos por <strong className="tabular-nums text-danger">{formatSoles(cardsLiquidityAssessment.totalDueBeforeSalary)}</strong> con fecha límite previa al abono de haberes (Día {cardsLiquidityAssessment.primarySalaryPayDay}). Con la caja disponible actual ({formatSoles(cardsLiquidityAssessment.currentAvailableToday)}), la brecha puntual es de <strong className="tabular-nums text-danger">-{formatSoles(cardsLiquidityAssessment.shortfallBeforeSalary)}</strong>. El cierre de mes proyecta solvencia tras la acreditación del sueldo.
                </div>
                {cardsLiquidityAssessment.recommendedAction && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: '6px' }}>
                    <strong>Alineación sugerida:</strong> {cardsLiquidityAssessment.recommendedAction}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cardPaymentPlan.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                  Sin tarjetas de crédito registradas en el sistema.
                </p>
              )}
              {(() => {
                const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                const now = new Date();
                const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
                const rows = cardPaymentPlan.map(plan => {
                  const summary = cardDebtSummary.find(c => c.paymentMethodId === plan.cardId);
                  const util = (summary && summary.hasPositiveBalance) || plan.limit <= 0
                    ? 0
                    : plan.limit > 0 && summary
                    ? Math.min(100, (summary.totalAccumulatedDebt / plan.limit) * 100)
                    : plan.utilizationPct;
                  const days = plan.nextDueDate ? Math.ceil((new Date(`${plan.nextDueDate}T12:00:00`).getTime() - todayMs) / 86400000) : null;
                  const weekday = plan.nextDueDate ? WEEKDAYS[new Date(`${plan.nextDueDate}T12:00:00`).getDay()] : '';
                  const hasDue = plan.nextDueAmount > 0.005;
                  const urgency = hasDue ? (days ?? 999) : 9999;
                  return { plan, summary, util, days, weekday, hasDue, urgency };
                }).sort((a, b) => a.urgency - b.urgency);

                return rows.map(r => {
                  const { plan } = r;
                  const overUtil = r.util > 30;
                  const overdue = r.hasDue && r.days != null && r.days < 0;
                  const countdownLabel = r.days == null ? '' : r.days < 0 ? `venció hace ${Math.abs(r.days)} d` : r.days === 0 ? 'vence hoy' : `en ${r.days} d`;
                  const countdownColor = overdue ? 'var(--accent-danger)' : r.days != null && r.days <= 3 ? 'var(--accent-warning)' : 'var(--accent-info)';
                  const coverage = plan.liquidityCoverage;
                  const isMismatch = coverage?.status === 'SALARY_MISMATCH';

                  const statusBadge = !r.hasDue
                    ? { cls: 'badge-success', txt: 'Al día' }
                    : isMismatch
                    ? { cls: 'badge-warning', txt: `Pre-abono (-${formatSoles(coverage?.shortfallAmount || 0)})` }
                    : overdue
                    ? { cls: 'badge-danger', txt: 'Vencido' }
                    : { cls: 'badge-warning', txt: 'Por pagar' };

                  return (
                    <div key={plan.cardId} className="clean-card" style={{ borderLeft: `4px solid ${plan.cardColor}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Cabecera: tarjeta + estado */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CreditCard size={16} style={{ color: plan.cardColor }} />
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{plan.cardName}</span>
                        </div>
                        <span className={`badge ${statusBadge.cls} nowrap tabular-nums`} style={{ fontSize: '0.72rem' }}>{statusBadge.txt}</span>
                      </div>

                      {/* Próximo pago REAL (forward-looking, cruza meses) */}
                      {r.hasDue ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                          <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.15rem', color: overdue ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>
                            {formatSoles(plan.nextDueAmount)}
                          </span>
                          {plan.nextDueUsd && plan.nextDueUsd > 0.009 ? (
                            <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              ({formatSoles(plan.nextDuePen || 0)} • ${plan.nextDueUsd.toFixed(2)} USD)
                            </span>
                          ) : null}
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            vence <strong style={{ color: 'var(--text-primary)' }}>{r.weekday} {formatDisplayDate(plan.nextDueDate!)}</strong>
                          </span>
                          <span aria-hidden style={{ color: 'var(--border-medium)', fontWeight: 400, fontSize: '0.82rem' }}>•</span>
                          <span className="tabular-nums" style={{ color: countdownColor, fontWeight: 600, fontSize: '0.82rem' }}>{countdownLabel}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: 600 }}>
                          Sin pagos pendientes · Al día
                        </div>
                      )}

                      {/* Diagnóstico de liquidez al vencimiento */}
                      {r.hasDue && coverage && coverage.status !== 'PAID' && (
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-subtle)',
                            border: `1px solid ${
                              isMismatch
                                ? 'rgba(234, 179, 8, 0.35)'
                                : coverage.status === 'COVERED'
                                ? 'rgba(16, 185, 129, 0.3)'
                                : 'rgba(239, 68, 68, 0.35)'
                            }`,
                            borderLeft: `4px solid ${
                              isMismatch
                                ? 'var(--accent-warning)'
                                : coverage.status === 'COVERED'
                                ? 'var(--accent-success)'
                                : 'var(--accent-danger)'
                            }`,
                            fontSize: '0.76rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{
                              fontWeight: 700,
                              color: isMismatch
                                ? 'var(--accent-warning)'
                                : coverage.status === 'COVERED'
                                ? 'var(--accent-success)'
                                : 'var(--accent-danger)'
                            }}>
                              {coverage.headline || (isMismatch ? 'Desfase Pre-Abono' : coverage.status === 'COVERED' ? 'Cobertura Confirmada' : 'Déficit de Ciclo')}
                            </span>
                            {isMismatch && (
                              <span className="tabular-nums text-danger" style={{ fontWeight: 700, fontSize: '0.74rem' }}>
                                Brecha al corte: -{formatSoles(coverage.shortfallAmount)}
                              </span>
                            )}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {coverage.message}
                          </div>
                          {coverage.actionTip && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: '5px', marginTop: '2px' }}>
                              <strong>Acción sugerida:</strong> {coverage.actionTip}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Parámetros de ciclo de facturación y línea */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                        gap: '10px',
                        background: 'var(--bg-subtle)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        fontSize: '0.78rem'
                      }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Cierre de facturación:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            Día {plan.billingCloseDay}
                            {plan.nextCloseDate ? ` (${formatDisplayDate(plan.nextCloseDate)})` : ''}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Fecha límite de pago:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            Día {plan.paymentDueDay}
                            {plan.nextDueDate ? ` (${formatDisplayDate(plan.nextDueDate)})` : ''}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Uso de línea:</span>
                          <strong style={{ color: overUtil ? 'var(--accent-warning)' : 'var(--text-primary)' }}>
                            {r.util.toFixed(0)}%
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                              {overUtil ? '(Objetivo: < 30%)' : 'Óptimo'}
                            </span>
                          </strong>
                        </div>
                      </div>

                      {/* Acción */}
                      {r.hasDue && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: '0.8rem' }}
                          onClick={() => handleOpenCreateCardPayment(r.plan.cardId)}
                        >
                          <Plus size={13} />
                          <span>Registrar Pago</span>
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
