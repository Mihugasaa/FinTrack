'use client';

import React, { useState } from 'react';
import {
  Plus,
  Pencil,
  Landmark,
  CreditCard,
  Trash2,
  Calendar
} from 'lucide-react';
import { PaymentMethod, CardPayment } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';

interface CardsTabProps {
  handleOpenCreateCardPayment: () => void;
  setIsCardModalOpen: (open: boolean) => void;
  setTempDebitBalance: (v: string) => void;
  initialDebitForMonth: number;
  setIsAdjustDebitModalOpen: (open: boolean) => void;
  debitStats: {
    currentDebitBalanceToday: number;
    debitExpenses: number;
  };
  cardDebtSummary: Array<{
    paymentMethodId: string;
    cardName: string;
    cardColor: string;
    billingCloseDay: number;
    paymentDueDay: number;
    totalAccumulatedDebt: number;
    hasPositiveBalance?: boolean;
    creditBalanceAmount?: number;
    initialDebt?: number;
    consumedThisMonth: number;
    paidThisMonth: number;
    paidInSelectedMonth: number;
    isPaidThisMonth?: boolean;
    netDueInSelectedMonth: number;
    dueInSelectedMonth: number;
  }>;
  paymentMethods: PaymentMethod[];
  handleOpenEditCard: (pm: PaymentMethod) => void;
  showAllHistoricalPayments: boolean;
  setShowAllHistoricalPayments: (show: boolean | ((p: boolean) => boolean)) => void;
  monthNames: string[];
  currentMonth: number;
  currentYear: number;
  cardPayments: CardPayment[];
  currentMonthCardPayments: CardPayment[];
  handleOpenEditCardPayment: (pay: CardPayment, idx: number) => void;
  handleDeleteCardPayment: (id?: string, idx?: number) => void;
  formatDisplayDate: (d: string) => string;
  formatSoles: (v: number) => string;
}

export const CardsTab: React.FC = () => {
  const {
    handleOpenCreateCardPayment,
    setIsCardModalOpen,
    setTempDebitBalance,
    initialDebitForMonth,
    setIsAdjustDebitModalOpen,
    debitStats,
    cardDebtSummary,
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
    formatDisplayDate,
    formatSoles
  } = useFinance();
  const [activeSubTab, setActiveSubTab] = useState<'payments' | 'schedule'>('payments');

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
            onClick={() => {
              setTempDebitBalance(initialDebitForMonth.toString());
              setIsAdjustDebitModalOpen(true);
            }}
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
              📅 Cronograma de Vencimientos
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
                Fechas bancarias de pago y cierre exigibles en {monthNames[currentMonth]} para mantener 0% de intereses
              </p>
              <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '5px 10px' }}>
                Total a Pagar en {monthNames[currentMonth]}:{' '}
                <strong className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                  {formatSoles(cardDebtSummary.reduce((acc, c) => acc + (c.hasPositiveBalance ? 0 : c.netDueInSelectedMonth), 0))}
                </strong>
              </span>
            </div>

            <div className="schedule-list">
              {(() => {
                interface ScheduleEvent {
                  id: string;
                  type: 'due' | 'close';
                  day: number;
                  card: typeof cardDebtSummary[0];
                }
                const events: ScheduleEvent[] = [];
                cardDebtSummary.forEach(card => {
                  if (card.paymentDueDay) {
                    events.push({
                      id: `${card.paymentMethodId}-due`,
                      type: 'due',
                      day: card.paymentDueDay,
                      card
                    });
                  }
                  if (card.billingCloseDay) {
                    events.push({
                      id: `${card.paymentMethodId}-close`,
                      type: 'close',
                      day: card.billingCloseDay,
                      card
                    });
                  }
                });

                events.sort((a, b) => {
                  if (a.day !== b.day) return a.day - b.day;
                  return a.type === 'due' ? -1 : 1;
                });

                return events.map(evt => {
                  const card = evt.card;
                  if (evt.type === 'due') {
                    const hasPositive = card.hasPositiveBalance;
                    const isPaid = card.isPaidThisMonth;
                    const hasPendingDue = !hasPositive && !isPaid && card.netDueInSelectedMonth > 0;

                    return (
                      <div key={evt.id} className="schedule-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span
                            className="schedule-date-badge"
                            style={{ color: card.cardColor, background: `${card.cardColor}18` }}
                          >
                            Día {evt.day}
                          </span>
                          <div>
                            <div className="font-semibold text-primary">{card.cardName} — Vencimiento de Pago</div>
                            <div className="text-body-sm text-muted">
                              {hasPositive
                                ? '🟢 Saldo a favor en tarjeta: no requiere pago este ciclo'
                                : isPaid
                                ? `✅ Pagado este mes (Abonado: ${formatSoles(card.paidInSelectedMonth)})`
                                : hasPendingDue
                                ? `Pago sugerido para 0% interés: abonar antes de las 8:00 PM ${card.paidInSelectedMonth > 0 ? `(Abonado ${formatSoles(card.paidInSelectedMonth)} - Resta ${formatSoles(card.netDueInSelectedMonth)})` : ''}`
                                : `Sin compras facturadas para pagar en ${monthNames[currentMonth]}`}
                            </div>
                          </div>
                        </div>
                        <div
                          className="tabular-nums text-right font-bold"
                          style={{
                            fontSize: '1rem',
                            whiteSpace: 'nowrap',
                            color: hasPositive
                              ? 'var(--accent-success)'
                              : isPaid
                              ? 'var(--accent-success)'
                              : hasPendingDue
                              ? 'var(--accent-danger)'
                              : 'var(--text-muted)'
                          }}
                        >
                          {hasPositive
                            ? `+${formatSoles(card.creditBalanceAmount || 0)}`
                            : isPaid
                            ? formatSoles(0)
                            : hasPendingDue
                            ? formatSoles(card.netDueInSelectedMonth)
                            : formatSoles(0)}
                        </div>
                      </div>
                    );
                  }

                  // Corte de Ciclo
                  return (
                    <div key={evt.id} className="schedule-item" style={{ background: 'var(--bg-app)', borderStyle: 'dashed' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          className="schedule-date-badge"
                          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                        >
                          Día {evt.day}
                        </span>
                        <div>
                          <div className="font-semibold text-secondary">{card.cardName} — Cierre de Facturación</div>
                          <div className="text-body-sm text-muted">
                            Compras posteriores al día {evt.day} de {monthNames[currentMonth]} se pagarán recién en el mes siguiente
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-neutral">Corte de Ciclo</span>
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
