'use client';

import '@/styles/dashboard.css';
import { FinanceProvider } from '@/contexts/FinanceContext';
import { DashboardContent } from '@/components/DashboardContent';

export default function DashboardPage() {
  return (
    <FinanceProvider>
      <DashboardContent />
    </FinanceProvider>
  );
}
