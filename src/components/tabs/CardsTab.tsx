'use client';

import React from 'react';
import {
  Plus,
  Pencil,
  Landmark,
  CreditCard,
  Trash2,
  ShieldCheck,
  AlertTriangle
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
    formatSoles,
    isCurrentActiveMonth,
    isPastMonth,
    isFutureMonth
  } = useFinance();

  // Cálculo de Deuda Consolidada Total en Tarjetas de Crédito (a la fecha de hoy)
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

  // Totales de compromisos a pagar en el ciclo del mes seleccionado
  const totalMonthDue = cardDebtSummary.reduce(
    (acc, c) => acc + (c.netDueInSelectedMonth || 0),
    0
  );
  const totalMonthDuePen = cardDebtSummary.reduce(
    (acc, c) => acc + (c.netDueInSelectedMonthPen ?? c.netDueInSelectedMonth ?? 0),
    0
  );
  const totalMonthDueUsd = cardDebtSummary.reduce(
    (acc, c) => acc + (c.netDueInSelectedMonthUsd || 0),
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
    <div className="tab-page-container">
      {/* Cabecera Principal de Pestaña */}
      <div className="panel-header">
        <div>
          <h2 className="panel-header-title">
            Cuentas y Tarjetas
          </h2>
          <p className="panel-header-subtitle">
            Saldos disponibles, líneas de crédito y próximos vencimientos
          </p>
        </div>
        <div className="action-group">
          <button className="btn-secondary" onClick={() => setIsCardModalOpen(true)}>
            <Plus size={15} />
            <span>Nueva Tarjeta / Cuenta</span>
          </button>
        </div>
      </div>

      {/* Hero Débito (Liquidez en Cuenta) */}
      <div className="debit-hero-card" style={{ borderLeft: '4px solid var(--accent-success)', marginBottom: 0 }}>
        <div className="debit-hero-main">
          <div className="debit-icon-box">
            <Landmark size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Cuenta Débito
              </span>
              <span
                className={`badge ${isCurrentActiveMonth ? 'badge-collected' : isFutureMonth ? 'badge-info' : 'badge-neutral'}`}
                style={{ fontSize: '0.65rem' }}
              >
                {isCurrentActiveMonth ? 'Disponible' : isFutureMonth ? 'Proyectado' : 'Cierre de mes'}
              </span>
              <button
                type="button"
                className="btn-icon-subtle"
                style={{ padding: '3px 7px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setIsAdjustDebitModalOpen(true)}
                title="Ajustar saldo en cuenta"
                aria-label="Ajustar saldo"
              >
                <Pencil size={11} />
                <span style={{ fontSize: '0.7rem' }}>Ajustar</span>
              </button>
            </div>
            <div
              className="debit-balance-val tabular-nums"
              style={{
                color: (isCurrentActiveMonth ? debitStats.currentDebitBalanceToday : debitStats.projectedDebitBalanceMonthEnd) >= 0
                  ? 'var(--accent-success)'
                  : 'var(--accent-danger)'
              }}
            >
              {formatSoles(isCurrentActiveMonth ? debitStats.currentDebitBalanceToday : debitStats.projectedDebitBalanceMonthEnd)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isCurrentActiveMonth
                ? 'Saldo disponible en cuenta bancaria'
                : isFutureMonth
                ? `Saldo estimado al cierre de ${monthNames[currentMonth]}`
                : `Saldo al cierre de ${monthNames[currentMonth]} ${currentYear}`}
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
        </div>
      </div>

      {/* 2. Grid de Tarjetas de Crédito */}
      <div className="cards-section-wrapper">
        <div className="cards-section-header">
          <h3 className="cards-section-title">
            <CreditCard size={17} style={{ color: 'var(--accent-brand)' }} />
            <span>Tarjetas de Crédito ({cardDebtSummary.length})</span>
          </h3>
        <div className="cards-debt-summary-clean">
          {isCurrentActiveMonth ? (
            totalCreditDebtUsd > 0.009 ? (
              <div className="debt-summary-row">
                <span className="debt-summary-chunk">
                  Deuda:{' '}
                  <strong className="tabular-nums" style={{ color: totalCreditDebtPen > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                    {formatSoles(totalCreditDebtPen)}
                  </strong>
                  <span className="debt-summary-sep">•</span>
                  <span className="debt-summary-usd-tag tabular-nums">
                    ${totalCreditDebtUsd.toFixed(2)} USD
                  </span>
                </span>
                <span className="debt-summary-pipe">|</span>
                <span className="debt-summary-total-chunk">
                  <span style={{ color: 'var(--text-muted)' }}>Total est.:</span>{' '}
                  <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatSoles(totalCreditDebt)}
                  </strong>
                </span>
              </div>
            ) : (
              <div className="debt-summary-row">
                <span className="debt-summary-chunk">
                  Deuda total:{' '}
                  <strong className="tabular-nums" style={{ color: totalCreditDebt > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                    {formatSoles(totalCreditDebt)}
                  </strong>
                </span>
              </div>
            )
          ) : isFutureMonth ? (
            totalMonthDueUsd > 0.009 ? (
              <div className="debt-summary-row">
                <span className="debt-summary-chunk">
                  A pagar en {monthNames[currentMonth]}:{' '}
                  <strong className="tabular-nums" style={{ color: totalMonthDuePen > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                    {formatSoles(totalMonthDuePen)}
                  </strong>
                  <span className="debt-summary-sep">•</span>
                  <span className="debt-summary-usd-tag tabular-nums">
                    ${totalMonthDueUsd.toFixed(2)} USD
                  </span>
                </span>
                <span className="debt-summary-pipe">|</span>
                <span className="debt-summary-total-chunk">
                  <span style={{ color: 'var(--text-muted)' }}>Total est.:</span>{' '}
                  <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatSoles(totalMonthDue)}
                  </strong>
                </span>
              </div>
            ) : (
              <div className="debt-summary-row">
                <span className="debt-summary-chunk">
                  A pagar en {monthNames[currentMonth]}:{' '}
                  <strong className="tabular-nums" style={{ color: totalMonthDue > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                    {formatSoles(totalMonthDue)}
                  </strong>
                </span>
              </div>
            )
          ) : (
            <div className="debt-summary-row">
              <span className="debt-summary-chunk">
                Facturado en {monthNames[currentMonth]}:{' '}
                <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {formatSoles(totalMonthDue)}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={`credit-cards-grid ${cardDebtSummary.length === 3 ? 'cols-3' : cardDebtSummary.length === 1 ? 'cols-1' : 'cols-2'}`}>
        {cardDebtSummary.map(card => {
          const pm = paymentMethods.find(p => p.id === card.paymentMethodId);
          const limit = pm?.creditLimit || 5000;
          const usedPercent = card.hasPositiveBalance ? 0 : Math.min(100, (card.totalAccumulatedDebt / limit) * 100);

          // Valores del mes seleccionado (ciclo o compromisos exigibles)
          const cardDueInMonth = card.netDueInSelectedMonth || 0;
          const cardDuePenInMonth = card.netDueInSelectedMonthPen ?? cardDueInMonth;
          const cardDueUsdInMonth = card.netDueInSelectedMonthUsd || 0;
          const hasUsdDueInMonth = cardDueUsdInMonth > 0.009;

          const cardBarPercent = isCurrentActiveMonth
            ? usedPercent
            : limit > 0
            ? Math.min(100, (cardDueInMonth / limit) * 100)
            : 0;

          return (
            <div key={card.paymentMethodId} className="credit-card-zen-balanced" style={{ borderLeft: `4px solid ${card.cardColor}` }}>
              {/* Nivel 1: Cabecera con Nombre y Edición */}
              <div className="card-zen-header">
                <span className="card-zen-title" title={card.cardName}>
                  {card.cardName}
                </span>
                {pm && (
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    style={{ padding: '3px 6px' }}
                    onClick={() => handleOpenEditCard(pm)}
                    title={`Editar ${card.cardName} y límites`}
                    aria-label={`Editar ${card.cardName}`}
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </div>

              {/* Nivel 2: Bloque Central - Monto y Vencimiento */}
              <div className="card-zen-body">
                <div className="card-zen-body-left">
                  <span className="card-zen-stage-label">
                    {isCurrentActiveMonth
                      ? (card.hasPositiveBalance ? 'Saldo a favor' : 'Deuda a la fecha')
                      : isFutureMonth
                      ? `A pagar en ${monthNames[currentMonth]}`
                      : `Facturado en ${monthNames[currentMonth]}`}
                  </span>
                  <div className="card-zen-stage-sub">
                    {isCurrentActiveMonth ? (
                      card.hasPositiveBalance ? (
                        <span className="text-success">A favor en cuenta</span>
                      ) : card.totalAccumulatedDebt > 0 ? (
                        <span className="text-muted">{usedPercent.toFixed(0)}% de línea utilizada</span>
                      ) : (
                        <span className="text-muted">Sin deuda acumulada</span>
                      )
                    ) : isFutureMonth ? (
                      cardDueInMonth > 0.009 ? (
                        <span className="text-muted">Vence el {card.paymentDueDay} de {monthNames[currentMonth]}</span>
                      ) : (
                        <span className="text-muted">Sin pagos pendientes</span>
                      )
                    ) : (
                      <span className="text-muted">{card.paidThisMonth > 0 ? `Abonado: +${formatSoles(card.paidThisMonth)}` : 'Periodo cerrado'}</span>
                    )}
                  </div>
                </div>

                <div className="card-zen-body-right">
                  {isCurrentActiveMonth ? (
                    card.hasPositiveBalance ? (
                      <>
                        <div className="card-zen-amount text-success">+{formatSoles(card.creditBalanceAmount || 0)}</div>
                        <span className="card-zen-status-pill success">● A favor</span>
                      </>
                    ) : card.hasUsdDebt && (card.totalAccumulatedDebtUsd || 0) > 0.009 ? (
                      <>
                        <div className="card-zen-amount-row">
                          <span className="card-zen-amount text-warning">
                            {formatSoles(card.totalAccumulatedDebtPen ?? card.totalAccumulatedDebt)}
                          </span>
                          <span className="card-usd-pill tabular-nums">
                            ${(card.totalAccumulatedDebtUsd || 0).toFixed(2)} USD
                          </span>
                        </div>
                        <div className="card-zen-total-est tabular-nums">
                          Total est.: {formatSoles(card.totalAccumulatedDebt)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="card-zen-amount" style={{ color: card.totalAccumulatedDebt > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                          {formatSoles(card.totalAccumulatedDebt)}
                        </div>
                        <div className="card-zen-status-row">
                          {card.totalAccumulatedDebt > 0 ? (
                            <span className="card-zen-status-pill warning">Por pagar</span>
                          ) : (
                            <span className="card-zen-status-pill success">● Al día</span>
                          )}
                        </div>
                      </>
                    )
                  ) : isFutureMonth ? (
                    cardDueInMonth > 0.009 ? (
                      hasUsdDueInMonth ? (
                        <>
                          <div className="card-zen-amount-row">
                            <span className="card-zen-amount text-warning">
                              {formatSoles(cardDuePenInMonth)}
                            </span>
                            <span className="card-usd-pill tabular-nums">
                              ${cardDueUsdInMonth.toFixed(2)} USD
                            </span>
                          </div>
                          <div className="card-zen-total-est tabular-nums">
                            Total est.: {formatSoles(cardDueInMonth)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="card-zen-amount text-warning">
                            {formatSoles(cardDueInMonth)}
                          </div>
                          <div className="card-zen-status-row">
                            <span className="card-zen-status-pill warning">Por vencer</span>
                          </div>
                        </>
                      )
                    ) : (
                      <>
                        <div className="card-zen-amount text-success">
                          {formatSoles(0)}
                        </div>
                        <div className="card-zen-status-row">
                          <span className="card-zen-status-pill neutral">
                            {card.isPaidThisMonth ? 'Ciclo cubierto' : '● Sin vencimientos'}
                          </span>
                        </div>
                      </>
                    )
                  ) : (
                    cardDueInMonth > 0.009 ? (
                      <>
                        <div className="card-zen-amount text-primary">
                          {formatSoles(cardDueInMonth)}
                        </div>
                        <div className="card-zen-total-est">
                          {card.paidThisMonth > 0 ? `Pagado: +${formatSoles(card.paidThisMonth)}` : 'Facturado'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="card-zen-amount text-muted">
                          {formatSoles(0)}
                        </div>
                        <div className="card-zen-status-row">
                          <span className="card-zen-status-pill neutral">Sin movimientos</span>
                        </div>
                      </>
                    )
                  )}
                </div>
              </div>

              {/* Barra visual de progreso de consumo de la línea de crédito */}
              <div className="card-zen-bar" title={`${cardBarPercent.toFixed(0)}% utilizado de la línea`}>
                <div
                  className="card-zen-bar-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, cardBarPercent))}%`,
                    background: card.cardColor || 'var(--accent-brand)',
                  }}
                />
              </div>

              {/* Nivel 3: Pie Informativo */}
              <div className="card-zen-footer">
                <div className="card-zen-footer-left">
                  <span>Corte: día {card.billingCloseDay}</span>
                  <span className="card-zen-dot">•</span>
                  <span>Pago: día {card.paymentDueDay}</span>
                </div>
                <div className="card-zen-footer-right tabular-nums">
                  {limit > 0 && <span>Límite: {formatSoles(limit)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
              💳 {isFutureMonth ? 'Pagos del Mes' : 'Historial de Pagos'} ({currentMonthCardPayments.length})
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
              <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: '10px' }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0, color: 'var(--text-primary)' }}>
                  {isFutureMonth
                    ? `Sin pagos registrados para ${monthNames[currentMonth]} ${currentYear}`
                    : `No hay pagos a tarjetas registrados ${showAllHistoricalPayments ? 'en el sistema' : `en ${monthNames[currentMonth]} ${currentYear}`}`}
                </p>
                <p style={{ fontSize: '0.78rem', margin: '6px 0 12px 0' }}>
                  {isFutureMonth
                    ? 'Los pagos se registran cuando amortices tus tarjetas en este periodo. Puedes consultar los vencimientos calculados.'
                    : 'Cuando amortices la deuda de tu tarjeta, haz clic en "Registrar Pago". Se descontará de tu Saldo Débito y reducirá la deuda bancaria.'}
                </p>
                {isFutureMonth && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setActiveSubTab('schedule')}
                  >
                    <span>Ver Próximos Vencimientos</span>
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* 1. Vista Escritorio: Tabla ejecutiva compacta y ergonómica */}
                <div className="desktop-only table-responsive" style={{ marginTop: '4px' }}>
                  <table className="tx-table">
                    <thead>
                      <tr>
                        <th style={{ width: '105px' }}>Fecha</th>
                        <th>Tarjeta / Destino</th>
                        <th style={{ width: '150px' }}>Canal de Pago</th>
                        <th className="text-right" style={{ width: '190px' }}>Monto Pagado</th>
                        <th className="text-right" style={{ width: '65px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPayments.map((pay, idx) => {
                        const cardPm = paymentMethods.find(p => p.id === pay.paymentMethodId);
                        const payKey = pay.id || `cp-dt-${idx}-${pay.paymentMethodId}`;
                        const cardColor = cardPm?.color || 'var(--accent-brand)';

                        const sourceBadge =
                          pay.sourceType === 'USD_SAVINGS_ACCOUNT'
                            ? { label: '💵 Fondos USD', cls: 'badge-warning' }
                            : pay.sourceType === 'MERCHANT_REFUND'
                            ? { label: 'Reembolso', cls: 'badge-info' }
                            : pay.sourceType === 'BANK_CREDIT'
                            ? { label: 'Abono Banco', cls: 'badge-neutral' }
                            : { label: '✓ Débito', cls: 'badge-collected' };

                        const hasTargetCycle = Boolean(pay.targetMonth && pay.targetMonth !== 'EXTRAORDINARY');

                        return (
                          <tr key={payKey}>
                            <td className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {formatDisplayDate(pay.paymentDate)}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '7px',
                                    background: `${cardColor}18`,
                                    color: cardColor,
                                    flexShrink: 0
                                  }}
                                >
                                  <CreditCard size={14} />
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                    Pago a {cardPm?.name || 'Tarjeta de Crédito'}
                                  </span>
                                  {hasTargetCycle && (
                                    <span style={{ fontSize: '0.725rem', color: 'var(--accent-success)', fontWeight: 600 }}>
                                      • Para ciclo de {formatPaymentTargetMonth(pay.targetMonth!)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${sourceBadge.cls}`} style={{ fontSize: '0.675rem', padding: '2px 8px' }}>
                                {sourceBadge.label}
                              </span>
                            </td>
                            <td className="tx-amount-cell">
                              <span style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--text-primary)' }}>
                                {pay.currency === 'USD'
                                  ? `$${(pay.originalAmount !== undefined ? pay.originalAmount : pay.amountPaid).toFixed(2)} USD`
                                  : formatSoles(pay.amountPaid)}
                              </span>
                              {pay.currency === 'USD' && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                  ≈ {formatSoles(pay.amountPen !== undefined ? pay.amountPen : pay.amountPaid)} · T.C. {(pay.exchangeRate || 1).toFixed(4)}
                                </div>
                              )}
                              {Boolean(pay.itfAmount && pay.itfAmount > 0) && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                  ITF: +{formatSoles(pay.itfAmount || 0)}
                                </div>
                              )}
                            </td>
                            <td className="text-right">
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => handleOpenEditCardPayment(pay, idx)}
                                  title="Modificar este abono a tarjeta"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-action-icon"
                                  onClick={() => handleDeleteCardPayment(pay.id, idx)}
                                  title="Eliminar este pago y revertir el descuento en saldo débito"
                                  style={{ color: 'var(--accent-danger)' }}
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

                {/* 2. Vista Móvil: Feed táctil estructurado */}
                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {displayedPayments.map((pay, idx) => {
                    const cardPm = paymentMethods.find(p => p.id === pay.paymentMethodId);
                    const payKey = pay.id || `cp-mob-${idx}-${pay.paymentMethodId}`;
                    const cardColor = cardPm?.color || 'var(--accent-brand)';

                    const sourceBadge =
                      pay.sourceType === 'USD_SAVINGS_ACCOUNT'
                        ? { label: '💵 Fondos USD', cls: 'badge-warning' }
                        : pay.sourceType === 'MERCHANT_REFUND'
                        ? { label: 'Reembolso', cls: 'badge-info' }
                        : pay.sourceType === 'BANK_CREDIT'
                        ? { label: 'Abono Banco', cls: 'badge-neutral' }
                        : { label: '✓ Débito', cls: 'badge-collected' };

                    const hasTargetCycle = Boolean(pay.targetMonth && pay.targetMonth !== 'EXTRAORDINARY');
                    const hasUsdInfo = pay.currency === 'USD';
                    const hasItf = Boolean(pay.itfAmount && pay.itfAmount > 0);
                    const hasFooter = hasTargetCycle || hasUsdInfo || hasItf;

                    return (
                      <div
                        key={payKey}
                        className="mobile-tx-card"
                        style={{ borderLeft: `3px solid ${cardColor}` }}
                      >
                        <div className="mobile-tx-main-row">
                          <div className="mobile-tx-left">
                            <div
                              className="mobile-tx-icon-wrap"
                              style={{
                                background: `${cardColor}18`,
                                color: cardColor
                              }}
                            >
                              <CreditCard size={16} />
                            </div>
                            <div className="mobile-tx-info">
                              <div className="mobile-tx-title" title={`Pago a ${cardPm?.name || 'Tarjeta de Crédito'}`}>
                                Pago a {cardPm?.name || 'Tarjeta de Crédito'}
                              </div>
                              <div className="mobile-tx-meta">
                                <span>{formatDisplayDate(pay.paymentDate)}</span>
                                {hasTargetCycle ? (
                                  <>
                                    <span>•</span>
                                    <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>
                                      Para ciclo {formatPaymentTargetMonth(pay.targetMonth!)}
                                    </span>
                                  </>
                                ) : (
                                  pay.sourceType === 'USD_SAVINGS_ACCOUNT' && (
                                    <>
                                      <span>•</span>
                                      <span style={{ color: 'var(--accent-warning)', fontWeight: 500 }}>
                                        Fondos propios USD
                                      </span>
                                    </>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mobile-tx-right">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                className={`badge ${sourceBadge.cls}`}
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '2px 6px',
                                  flexShrink: 0
                                }}
                              >
                                {sourceBadge.label}
                              </span>
                              <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {pay.currency === 'USD'
                                  ? `$${(pay.originalAmount !== undefined ? pay.originalAmount : pay.amountPaid).toFixed(2)} USD`
                                  : formatSoles(pay.amountPaid)}
                              </span>
                            </div>
                            <div className="mobile-tx-actions">
                              <button
                                type="button"
                                className="btn-action-icon"
                                onClick={() => handleOpenEditCardPayment(pay, idx)}
                                title="Modificar este abono a tarjeta"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-action-icon"
                                onClick={() => handleDeleteCardPayment(pay.id, idx)}
                                title="Eliminar este pago y revertir el descuento en saldo débito"
                                style={{ color: 'var(--accent-danger)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {hasFooter ? (
                          <div className="mobile-tx-footer-row">
                            {hasTargetCycle ? (
                              <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>
                                Para ciclo de {formatPaymentTargetMonth(pay.targetMonth!)}
                              </span>
                            ) : (
                              <span />
                            )}
                            {hasItf ? (
                              <span className="tabular-nums">
                                Débito: {formatSoles((pay.amountPen !== undefined ? pay.amountPen : pay.amountPaid) + (pay.itfAmount || 0))} (ITF +{formatSoles(pay.itfAmount || 0)})
                              </span>
                            ) : hasUsdInfo ? (
                              <span className="tabular-nums">
                                ≈ {formatSoles(pay.amountPen !== undefined ? pay.amountPen : pay.amountPaid)} · T.C. {(pay.exchangeRate || 1).toFixed(4)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
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
                    Control de Pagos del Mes
                  </span>
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                    Desfase pre-nómina
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: '0.82rem' }}>
                  Compromisos antes de nómina: <strong className="tabular-nums text-danger">{formatSoles(cardsLiquidityAssessment.totalDueBeforeSalary)}</strong> · Saldo disponible hoy: <span className="tabular-nums">{formatSoles(cardsLiquidityAssessment.currentAvailableToday)}</span> · Brecha temporal: <strong className="tabular-nums text-danger">-{formatSoles(cardsLiquidityAssessment.shortfallBeforeSalary)}</strong>.
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: '6px' }}>
                  Liquidez cubierta al cierre del ciclo tras el abono de nómina (día {cardsLiquidityAssessment.primarySalaryPayDay}).
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cardPaymentPlan.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                  Aún no tienes tarjetas de crédito registradas.
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
                    ? { cls: 'badge-warning', txt: `Pre-sueldo (-${formatSoles(coverage?.shortfallAmount || 0)})` }
                    : overdue
                    ? { cls: 'badge-danger', txt: 'Vencido' }
                    : { cls: 'badge-warning', txt: 'Por pagar' };

                  return r.hasDue ? (
                    <div
                      key={plan.cardId}
                      className="due-plan-card"
                      style={{ borderLeft: `4px solid ${plan.cardColor}` }}
                    >
                      {/* Fila Principal: Izquierda (Identidad y Vencimiento) - Derecha (Monto y Acción) */}
                      <div className="due-plan-main">
                        <div className="due-plan-left">
                          <div className="due-plan-title-row">
                            <div className="due-plan-card-identity">
                              <CreditCard size={17} style={{ color: plan.cardColor, flexShrink: 0 }} />
                              <span className="due-plan-card-name">{plan.cardName}</span>
                            </div>
                            <span className={`badge ${statusBadge.cls} nowrap tabular-nums`} style={{ fontSize: '0.72rem' }}>
                              {statusBadge.txt}
                            </span>
                          </div>

                          <div className="due-plan-meta-row">
                            <span>
                              Vence <strong style={{ color: 'var(--text-primary)' }}>{r.weekday} {formatDisplayDate(plan.nextDueDate!)}</strong>
                            </span>
                            <span className="due-plan-dot">•</span>
                            <span className="tabular-nums" style={{ color: countdownColor, fontWeight: 600 }}>
                              {countdownLabel}
                            </span>
                          </div>
                        </div>

                        <div className="due-plan-right">
                          <div className="due-plan-amount-box">
                            <span
                              className="due-plan-amount tabular-nums"
                              style={{ color: overdue ? 'var(--accent-danger)' : 'var(--accent-warning)' }}
                            >
                              {formatSoles(plan.nextDueAmount)}
                            </span>
                            {plan.nextDueUsd && plan.nextDueUsd > 0.009 ? (
                              <span className="due-plan-amount-sub tabular-nums">
                                ({formatSoles(plan.nextDuePen || 0)} • ${plan.nextDueUsd.toFixed(2)} USD)
                              </span>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            className="btn-pay-contextual"
                            onClick={() => handleOpenCreateCardPayment(r.plan.cardId)}
                            title={`Pagar ${plan.cardName}`}
                          >
                            <CreditCard size={13} style={{ color: 'var(--accent-brand)' }} />
                            <span>Pagar</span>
                          </button>
                        </div>
                      </div>

                      {/* Parámetros del ciclo en barra limpia */}
                      <div className="due-plan-params-bar">
                        <div className="due-plan-param-item">
                          <span>Corte:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            Día {plan.billingCloseDay}
                            {plan.nextCloseDate ? ` (${formatDisplayDate(plan.nextCloseDate)})` : ''}
                          </strong>
                        </div>
                        <div className="due-plan-param-item">
                          <span>Pago:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            Día {plan.paymentDueDay}
                          </strong>
                        </div>
                        <div className="due-plan-param-item">
                          <span>Línea:</span>
                          <strong style={{ color: overUtil ? 'var(--accent-warning)' : 'var(--text-primary)' }}>
                            {r.util.toFixed(0)}%
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                              {overUtil ? '(Objetivo: < 30%)' : 'Óptimo'}
                            </span>
                          </strong>
                        </div>
                      </div>

                      {/* Diagnóstico de liquidez: Cinta sutil si está cubierta, o Caja de alerta si hay desfase */}
                      {coverage && coverage.status !== 'PAID' && (
                        coverage.status === 'COVERED' ? (
                          <div
                            className="due-plan-reassurance-ribbon"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldCheck size={14} style={{ color: 'var(--accent-success)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--accent-success)' }}>Cubierto</strong> · {coverage.message}
                              </span>
                            </div>
                            {coverage.includedExtraIncomes && coverage.includedExtraIncomes > 0.01 ? (
                              <span
                                className="badge badge-subtle tabular-nums"
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 6px',
                                  color: 'var(--text-muted)',
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '4px'
                                }}
                              >
                                +{formatSoles(coverage.includedExtraIncomes)} programados
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className={`due-plan-alert-box ${isMismatch ? 'alert-mismatch' : 'alert-deficit'}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={15} style={{ color: isMismatch ? 'var(--accent-warning)' : 'var(--accent-danger)', flexShrink: 0 }} />
                                <strong style={{ color: isMismatch ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>
                                  {coverage.headline || (isMismatch ? 'Desfase Pre-Sueldo' : 'Déficit de Ciclo')}
                                </strong>
                              </div>
                              {isMismatch && (
                                <span className="tabular-nums text-danger" style={{ fontWeight: 700, fontSize: '0.74rem' }}>
                                  Brecha: -{formatSoles(coverage.shortfallAmount)}
                                </span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px', fontSize: '0.78rem' }}>
                              {coverage.message}
                            </div>
                            {coverage.actionTip && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-subtle)', paddingTop: '4px', marginTop: '3px' }}>
                                {coverage.actionTip}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div
                      key={plan.cardId}
                      className="due-plan-card"
                      style={{ borderLeft: `4px solid ${plan.cardColor}` }}
                    >
                      <div className="due-plan-main">
                        <div className="due-plan-left">
                          <div className="due-plan-title-row">
                            <div className="due-plan-card-identity">
                              <CreditCard size={17} style={{ color: plan.cardColor, flexShrink: 0 }} />
                              <span className="due-plan-card-name">{plan.cardName}</span>
                            </div>
                            <span className={`badge ${statusBadge.cls} nowrap tabular-nums`} style={{ fontSize: '0.72rem' }}>
                              {statusBadge.txt}
                            </span>
                          </div>

                          <div className="due-plan-meta-row">
                            <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>
                              Sin pagos pendientes · Al día
                            </span>
                          </div>
                        </div>

                        <div className="due-plan-right">
                          <div className="due-plan-paid-badge">
                            <ShieldCheck size={14} />
                            <span>Cubierto</span>
                          </div>
                        </div>
                      </div>

                      <div className="due-plan-params-bar">
                        <div className="due-plan-param-item">
                          <span>Corte:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            Día {plan.billingCloseDay}
                            {plan.nextCloseDate ? ` (${formatDisplayDate(plan.nextCloseDate)})` : ''}
                          </strong>
                        </div>
                        <div className="due-plan-param-item">
                          <span>Pago:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            Día {plan.paymentDueDay}
                          </strong>
                        </div>
                        <div className="due-plan-param-item">
                          <span>Línea:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {r.util.toFixed(0)}%
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                              Óptimo
                            </span>
                          </strong>
                        </div>
                      </div>
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
