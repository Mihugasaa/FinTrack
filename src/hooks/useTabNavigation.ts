'use client';

import { useState, useEffect, useCallback } from 'react';

export type ActiveTab =
  | 'overview'
  | 'incomes'
  | 'transactions'
  | 'cards'
  | 'receivables'
  | 'annual'
  | 'analytics'
  | 'reconciliation';

export const VALID_TABS: ActiveTab[] = [
  'overview',
  'incomes',
  'transactions',
  'cards',
  'receivables',
  'annual',
  'analytics',
  'reconciliation'
];

export function useTabNavigation(defaultTab: ActiveTab = 'overview') {
  const [activeTab, setActiveTabState] = useState<ActiveTab>(defaultTab);
  const [loanSubTab, setLoanSubTabState] = useState<'receivables' | 'payables'>('receivables');

  // Read URL query parameters and sync activeTab
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ActiveTab | null;
      const subtabParam = params.get('subtab') as 'receivables' | 'payables' | null;

      if (tabParam && VALID_TABS.includes(tabParam)) {
        setActiveTabState(tabParam);
        localStorage.setItem('fintrack_active_tab', tabParam);
      } else {
        const savedTab = localStorage.getItem('fintrack_active_tab') as ActiveTab | null;
        if (savedTab && VALID_TABS.includes(savedTab)) {
          setActiveTabState(savedTab);
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
