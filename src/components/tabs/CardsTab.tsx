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

  // Total pagado a tarjetas en el mes seleccionado
  const totalPaidToCardsThisMonth = currentMonthCardPayments.reduce(
    (acc, p) => acc + p.amountPaid,
    0
  );

  const displayedPayments = showAllHistoricalPayments
    ? [...cardPayments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    : currentMonthCardPayments;

  return (
    <div>
      {/* Cabecera Principal de Pestaña */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Mis Cuentas de Débito y Tarjetas de Crédito
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Gestiona tus fondos líquidos y líneas de crédito con balance simétrico
          </p>
        </div>
        <div className="action-group">
          <button className="btn-primary" onClick={() => setIsCardModalOpen(true)}>
            <Plus size={15} />
            <span>Nueva Tarjeta / Cuenta</span>
          </button>
        </div>
      </div>

      {/* 1. Hero Débito (Liquidez en Cuenta y Fondos Disponibles) */}
      <div className="debit-hero-card">
        <div className="card-color-stripe" style={{ background: 'var(--accent-success)' }} />
        <div className="debit-hero-main">
          <div className="debit-icon-box">
            <Landmark size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Cuenta Débito / Efectivo
              </span>
              <span className="badge badge-collected" style={{ fontSize: '0.65rem' }}>
                Dinero Disponible
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
              Saldo real tras descontar gastos pagados y amortizaciones a tarjetas
            </div>
          </div>
        </div>

        <div className="debit-hero-stats">
          <div className="debit-stat-item">
            <span className="debit-stat-label">Gastado en Débito</span>
            <span className="debit-stat-val tabular-nums">
              {formatSoles(debitStats.debitExpenses)}
            </span>
          </div>

          <div className="debit-stat-item">
            <span className="debit-stat-label">Pagos a Tarjetas</span>
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

      {/* 2. Grid Simétrico 2x2 de Tarjetas de Crédito (Cero tarjetas huérfanas) */}
      <div style={{ margin: '24px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={17} style={{ color: 'var(--accent-brand)' }} />
          <span>Mis Líneas de Crédito Activas ({cardDebtSummary.length})</span>
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Deuda acumulada total:{' '}
          <strong className="tabular-nums" style={{ color: totalCreditDebt > 0 ? 'var(--accent-warning)' : 'var(--accent-success)', fontSize: '0.875rem' }}>
            {formatSoles(totalCreditDebt)}
          </strong>
        </span>
      </div>

      <div className="credit-cards-grid-2x2">
        {cardDebtSummary.map(card => {
          const pm = paymentMethods.find(p => p.id === card.paymentMethodId);
          const limit = pm?.creditLimit || 5000;
          const usedPercent = card.hasPositiveBalance ? 0 : Math.min(100, (card.totalAccumulatedDebt / limit) * 100);

          return (
            <div key={card.paymentMethodId} className="credit-card-zen">
              <div className="card-color-stripe" style={{ background: card.cardColor }} />
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

                <div className="card-zen-debt-row">
                  <span className="card-zen-debt-label">
                    {card.hasPositiveBalance ? 'Saldo a Favor' : 'Deuda a la Fecha'}
                  </span>
                  <div
                    className="card-zen-debt-val tabular-nums"
                    style={{
                      color: card.hasPositiveBalance
                        ? 'var(--accent-success)'
                        : card.totalAccumulatedDebt > 0
                        ? 'var(--accent-warning)'
                        : 'var(--accent-success)'
                    }}
                  >
                    {card.hasPositiveBalance ? `+${formatSoles(card.creditBalanceAmount || 0)}` : formatSoles(card.totalAccumulatedDebt)}
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
                    Ciclo facturación:
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Corte {card.billingCloseDay} / Pago {card.paymentDueDay}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.725rem' }}>
                    Abonado este mes:
                  </span>
                  <strong
                    className="tabular-nums"
                    style={{
                      color: card.paidThisMonth > 0 ? 'var(--accent-success)' : 'var(--text-muted)'
                    }}
                  >
                    {card.paidThisMonth > 0 ? `+${formatSoles(card.paidThisMonth)}` : formatSoles(0)}
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
              💳 Pagos a Tarjetas ({currentMonthCardPayments.length})
            </button>
            <button
              type="button"
              className={`tab-pill ${activeSubTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('schedule')}
            >
              📅 Planificador de Pagos
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
              onClick={handleOpenCreateCardPayment}
            >
              <Plus size={14} />
              <span>Registrar Pago de Tarjeta</span>
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
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                            <span>Fecha: {formatDisplayDate(pay.paymentDate)}</span>
                            <span>•</span>
                            <span style={{ color: 'var(--accent-brand)', fontWeight: 500 }}>
                              Origen: Cuenta Bancaria (Débito)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right', marginRight: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                            Monto Pagado
                          </span>
                          <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent-danger)', whiteSpace: 'nowrap' }}>
                            -{formatSoles(pay.amountPaid)}
                          </span>
                        </div>
                        <span className="badge badge-collected" style={{ fontSize: '0.72rem' }}>
                          ✓ Descontado de Débito
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
                Cuánto y cuándo pagar cada tarjeta. El próximo pago aparece aunque estés viendo otro mes.
              </p>
              <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '5px 10px' }}>
                Total a pagar pronto:{' '}
                <strong className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                  {formatSoles(cardPaymentPlan.reduce((acc, c) => acc + c.nextDueAmount, 0))}
                </strong>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cardPaymentPlan.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                  No tienes tarjetas de crédito registradas.
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
                  const statusBadge = !r.hasDue
                    ? { cls: 'badge-success', txt: '✅ Al día' }
                    : overdue
                    ? { cls: 'badge-danger', txt: '⚠️ Vencido' }
                    : { cls: 'badge-warning', txt: '⏳ Por pagar' };

                  return (
                    <div key={plan.cardId} className="clean-card" style={{ borderLeft: `4px solid ${plan.cardColor}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Cabecera: tarjeta + estado */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CreditCard size={16} style={{ color: plan.cardColor }} />
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{plan.cardName}</span>
                        </div>
                        <span className={`badge ${statusBadge.cls} nowrap`} style={{ fontSize: '0.72rem' }}>{statusBadge.txt}</span>
                      </div>

                      {/* Próximo pago REAL (forward-looking, cruza meses) */}
                      {r.hasDue ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                          <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.15rem', color: overdue ? 'var(--accent-danger)' : 'var(--accent-warning)' }}>
                            {formatSoles(plan.nextDueAmount)}
                          </span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            vence <strong style={{ color: 'var(--text-primary)' }}>{r.weekday} {formatDisplayDate(plan.nextDueDate!)}</strong>
                          </span>
                          <span aria-hidden style={{ color: 'var(--border-medium)', fontWeight: 400, fontSize: '0.82rem' }}>|</span>
                          <span className="tabular-nums" style={{ color: countdownColor, fontWeight: 700, fontSize: '0.82rem' }}>{countdownLabel}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: 600 }}>
                          Sin pagos pendientes · estás al día.
                        </div>
                      )}

                      {/* Coaching de historial crediticio con fechas concretas */}
                      <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div>
                          🗓️ Tu corte es el día {plan.billingCloseDay} y el pago vence el día {plan.paymentDueDay}.
                        </div>
                        <div>💳 Si pagas el total facturado antes del vencimiento, no generas intereses.</div>
                        <div>
                          📉 Como el banco reporta la deuda que tengas el día del corte, pagar antes del{' '}
                          <strong>{plan.scorePayByDate ? formatDisplayDate(plan.scorePayByDate) : (plan.nextCloseDate ? formatDisplayDate(plan.nextCloseDate) : `día ${plan.billingCloseDay}`)}</strong> la deja más baja y ayuda a tu historial crediticio.
                        </div>
                        {overUtil && (
                          <div style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>
                            ⚠️ Estás usando {r.util.toFixed(0)}% de tu línea. Trata de dejarlo bajo 30% para el día del corte.
                          </div>
                        )}
                      </div>

                      {/* Acción */}
                      {r.hasDue && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: '0.8rem' }}
                          onClick={handleOpenCreateCardPayment}
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
