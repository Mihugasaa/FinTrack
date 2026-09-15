'use client';

import { useState, useEffect, useCallback } from 'react';

export type ActiveTab =
  | 'overview'
  | 'incomes'
  | 'transactions'
  | 'cards'
  | 'receivables'
  | 'analysis'
  | 'reconciliation';

export const VALID_TABS: ActiveTab[] = [
  'overview',
  'incomes',
  'transactions',
  'cards',
  'receivables',
  'analysis',
  'reconciliation'
];

// Los tabs 'annual' y 'analytics' se fusionaron en el hub 'analysis'. Remapeamos
// cualquier valor legacy guardado en la URL o en localStorage para no romper los
// enlaces ni la última pestaña recordada de sesiones anteriores.
const LEGACY_TAB_MAP: Record<string, ActiveTab> = {
  annual: 'analysis',
  analytics: 'analysis'
};

const normalizeTab = (raw: string | null): ActiveTab | null => {
  if (!raw) return null;
  const mapped = LEGACY_TAB_MAP[raw] || raw;
  return VALID_TABS.includes(mapped as ActiveTab) ? (mapped as ActiveTab) : null;
};

export function useTabNavigation(defaultTab: ActiveTab = 'overview') {
  const [activeTab, setActiveTabState] = useState<ActiveTab>(defaultTab);
  const [loanSubTab, setLoanSubTabState] = useState<'receivables' | 'payables'>('receivables');

  // Read URL query parameters and sync activeTab
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = normalizeTab(params.get('tab'));
      const subtabParam = params.get('subtab') as 'receivables' | 'payables' | null;

      if (tabParam) {
        setActiveTabState(tabParam);
        localStorage.setItem('fintrack_active_tab', tabParam);
        // Si la URL traía un valor legacy, lo reescribimos al canónico.
        if (params.get('tab') !== tabParam) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('tab', tabParam);
          window.history.replaceState(null, '', newUrl.toString());
        }
      } else {
        const savedTab = normalizeTab(localStorage.getItem('fintrack_active_tab'));
        if (savedTab) {
          setActiveTabState(savedTab);
          localStorage.setItem('fintrack_active_tab', savedTab);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('tab', savedTab);
          window.history.replaceState(null, '', newUrl.toString());
        }
      }

      if (subtabParam === 'receivables' || subtabParam === 'payables') {
        setLoanSubTabState(subtabParam);
      }
    };

    syncFromUrl();

    // Listen to browser Back/Forward navigation
    const handlePopState = () => {
      syncFromUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setTab = useCallback((tab: ActiveTab, subtab?: 'receivables' | 'payables') => {
    setActiveTabState(tab);
    if (subtab) {
      setLoanSubTabState(subtab);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('fintrack_active_tab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (tab === 'receivables' && subtab) {
        url.searchParams.set('subtab', subtab);
      } else {
        url.searchParams.delete('subtab');
      }
      window.history.pushState(null, '', url.toString());
    }
  }, []);

  const setLoanSubTab = useCallback((subtab: 'receivables' | 'payables') => {
    setLoanSubTabState(subtab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'receivables');
      url.searchParams.set('subtab', subtab);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  return {
    activeTab,
    setTab,
    loanSubTab,
    setLoanSubTab
  };
}
