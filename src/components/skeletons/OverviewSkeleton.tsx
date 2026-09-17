'use client';

import React from 'react';

/**
 * Esqueleto estructural completo para Visión General (OverviewTab).
 * Replica pixel por pixel la disposición de cards, subcards, montos,
 * gráficos y transacciones para evitar Layout Shift en carga inicial o redes lentas.
 */
export const OverviewSkeleton: React.FC = () => {
  return (
    <div className="overview-skeleton-container" aria-busy="true" aria-label="Cargando información financiera...">
      {/* 1. HERO MASTER: MI DINERO EN DÉBITO */}
      <section className="zen-hero clean-card skeleton-card">
        <div className="zen-hero-left">
          {/* Fila de etiquetas */}
          <div className="zen-tag-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <span className="skeleton-shimmer sk-pill" style={{ width: '135px', height: '22px' }} />
            <span className="skeleton-shimmer sk-pill" style={{ width: '115px', height: '20px' }} />
          </div>

          {/* Monto Principal */}
          <div className="zen-amount" style={{ margin: '8px 0 12px 0' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '230px', height: '44px', borderRadius: '10px' }} />
          </div>

          {/* Fila de Contexto / Chips */}
          <div className="zen-context-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="skeleton-shimmer sk-pill" style={{ width: '110px', height: '18px' }} />
            <span className="skeleton-shimmer sk-pill" style={{ width: '140px', height: '18px' }} />
            <span className="skeleton-shimmer sk-pill" style={{ width: '95px', height: '18px' }} />
          </div>
        </div>

        {/* Flujo del Mes (2 Subcards) */}
        <div className="zen-hero-right">
          <div className="zen-flow-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '110px', height: '13px' }} />
            <span className="skeleton-shimmer sk-box" style={{ width: '125px', height: '24px', borderRadius: '6px' }} />
            <span className="skeleton-shimmer sk-box" style={{ width: '140px', height: '12px' }} />
          </div>

          <div className="zen-flow-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '105px', height: '13px' }} />
            <span className="skeleton-shimmer sk-box" style={{ width: '120px', height: '24px', borderRadius: '6px' }} />
            <span className="skeleton-shimmer sk-box" style={{ width: '135px', height: '12px' }} />
          </div>
        </div>
      </section>

      {/* 2. PRÓXIMOS VENCIMIENTOS DE TARJETAS */}
      <section className="clean-card skeleton-card" style={{ marginBottom: '16px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="skeleton-shimmer sk-box" style={{ width: '170px', height: '18px', borderRadius: '6px' }} />
          <span className="skeleton-shimmer sk-pill" style={{ width: '95px', height: '24px' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                flex: '1 1 180px',
                minWidth: '160px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '10px 12px',
                background: 'var(--bg-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span className="skeleton-shimmer sk-box" style={{ width: '90px', height: '14px' }} />
              <span className="skeleton-shimmer sk-box" style={{ width: '120px', height: '11px' }} />
              <span className="skeleton-shimmer sk-box" style={{ width: '75px', height: '18px', marginTop: '2px' }} />
            </div>
          ))}
        </div>
      </section>

      {/* 3. FILA 2: ANÁLISIS DE GASTO Y COMPARATIVA (50% / 50%) */}
      <div className="overview-grid-balanced">
        {/* Gráfico 1: Categorías */}
        <div className="chart-panel clean-card skeleton-card" style={{ marginBottom: 0 }}>
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '180px', height: '16px' }} />
            <span className="skeleton-shimmer sk-pill" style={{ width: '100px', height: '20px' }} />
          </div>

          <div className="skeleton-shimmer sk-box" style={{ width: '100%', height: '14px', borderRadius: '8px', marginBottom: '18px' }} />

          <div className="category-legend-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="legend-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="skeleton-shimmer sk-circle" style={{ width: '10px', height: '10px' }} />
                  <span className="skeleton-shimmer sk-box" style={{ width: '70px', height: '13px' }} />
                </div>
                <span className="skeleton-shimmer sk-box" style={{ width: '55px', height: '13px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Evolución Mensual */}
        <div className="chart-panel clean-card skeleton-card" style={{ marginBottom: 0 }}>
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '140px', height: '16px' }} />
            <span className="skeleton-shimmer sk-pill" style={{ width: '110px', height: '20px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="skeleton-shimmer sk-box" style={{ width: '100px', height: '13px' }} />
                <span className="skeleton-shimmer sk-box" style={{ width: '80px', height: '13px' }} />
              </div>
              <span className="skeleton-shimmer sk-box" style={{ width: '100%', height: '9px', borderRadius: '9999px' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="skeleton-shimmer sk-box" style={{ width: '110px', height: '13px' }} />
                <span className="skeleton-shimmer sk-box" style={{ width: '85px', height: '13px' }} />
              </div>
              <span className="skeleton-shimmer sk-box" style={{ width: '100%', height: '9px', borderRadius: '9999px' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '4px' }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span className="skeleton-shimmer sk-box" style={{ width: '70px', height: '11px', marginBottom: '6px' }} />
                <span className="skeleton-shimmer sk-box" style={{ width: '50px', height: '18px' }} />
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span className="skeleton-shimmer sk-box" style={{ width: '90px', height: '11px', marginBottom: '6px' }} />
                <span className="skeleton-shimmer sk-box" style={{ width: '65px', height: '18px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. FILA 3: MOVIMIENTOS RECIENTES Y ASESOR */}
      <div className="overview-grid-balanced">
        {/* Movimientos Recientes */}
        <div className="transactions-panel clean-card skeleton-card">
          <div className="panel-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '135px', height: '16px' }} />
            <span className="skeleton-shimmer sk-pill" style={{ width: '80px', height: '24px' }} />
          </div>

          {/* Desktop Table Skeleton */}
          <div className="desktop-only table-responsive">
            <table className="tx-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '96px', paddingRight: '14px' }}><span className="skeleton-shimmer sk-box" style={{ width: '45px', height: '12px' }} /></th>
                  <th style={{ paddingLeft: '6px' }}><span className="skeleton-shimmer sk-box" style={{ width: '110px', height: '12px' }} /></th>
                  <th className="text-right" style={{ width: '120px' }}><span className="skeleton-shimmer sk-box" style={{ width: '60px', height: '12px', marginLeft: 'auto' }} /></th>
                  <th className="text-right" style={{ width: '50px' }}><span className="skeleton-shimmer sk-box" style={{ width: '30px', height: '12px', marginLeft: 'auto' }} /></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td style={{ paddingRight: '14px' }}><span className="skeleton-shimmer sk-box" style={{ width: '55px', height: '13px' }} /></td>
                    <td style={{ paddingLeft: '6px' }}>
                      <span className="skeleton-shimmer sk-box" style={{ width: `${110 + (i % 3) * 35}px`, height: '14px', display: 'block', marginBottom: '4px' }} />
                      <span className="skeleton-shimmer sk-box" style={{ width: '65px', height: '10px' }} />
                    </td>
                    <td className="text-right"><span className="skeleton-shimmer sk-box" style={{ width: '65px', height: '14px', marginLeft: 'auto' }} /></td>
                    <td className="text-right"><span className="skeleton-shimmer sk-box" style={{ width: '38px', height: '20px', marginLeft: 'auto', borderRadius: '4px' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Feed Skeleton */}
          <div className="mobile-only mobile-tx-feed" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="mobile-tx-card"
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="skeleton-shimmer sk-circle" style={{ width: '36px', height: '36px', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <span className="skeleton-shimmer sk-box" style={{ width: `${110 + (i % 2) * 30}px`, height: '14px' }} />
                    <span className="skeleton-shimmer sk-box" style={{ width: '80px', height: '11px' }} />
                  </div>
                </div>
                <span className="skeleton-shimmer sk-box" style={{ width: '60px', height: '16px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Asesor de Tarjetas */}
        <div className="advisor-card clean-card skeleton-card">
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '160px', height: '16px' }} />
            <span className="skeleton-shimmer sk-pill" style={{ width: '75px', height: '20px' }} />
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="skeleton-shimmer sk-box" style={{ width: '130px', height: '14px' }} />
              <span className="skeleton-shimmer sk-pill" style={{ width: '80px', height: '18px' }} />
            </div>
            <span className="skeleton-shimmer sk-box" style={{ width: '90%', height: '12px' }} />
            <span className="skeleton-shimmer sk-box" style={{ width: '60%', height: '12px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="skeleton-shimmer sk-box" style={{ width: '120px', height: '11px', marginBottom: '2px' }} />
            {[1, 2].map(i => (
              <div
                key={i}
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
                <span className="skeleton-shimmer sk-box" style={{ width: '90px', height: '13px' }} />
                <span className="skeleton-shimmer sk-box" style={{ width: '70px', height: '13px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
