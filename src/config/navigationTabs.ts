import {
  PieChart,
  ListFilter,
  Coins,
  CreditCard,
  Users,
  BarChart3,
  CheckCheck,
  LucideIcon
} from 'lucide-react';
import { ActiveTab } from '@/hooks/useTabNavigation';

export interface TabConfig {
  id: ActiveTab;
  labelDesktop: string;
  labelMobile: string;
  icon: LucideIcon;
  mobilePlacement: 'bottom' | 'more';
  mobileSubtitle?: string;
  tooltip: string;
}

export const NAVIGATION_TABS: TabConfig[] = [
  {
    id: 'overview',
    labelDesktop: 'Visión General',
    labelMobile: 'Inicio',
    icon: PieChart,
    mobilePlacement: 'bottom',
    tooltip: 'Visión General: Resumen financiero y métricas clave'
  },
  {
    id: 'transactions',
    labelDesktop: 'Movimientos',
    labelMobile: 'Movimientos',
    icon: ListFilter,
    mobilePlacement: 'bottom',
    tooltip: 'Movimientos: Gastos, pagos de tarjeta, ingresos y pagos de deuda del mes'
  },
  {
    id: 'incomes',
    labelDesktop: 'Ingresos',
    labelMobile: 'Ingresos',
    icon: Coins,
    mobilePlacement: 'bottom',
    tooltip: 'Ingresos: Sueldos y otros ingresos'
  },
  {
    id: 'cards',
    labelDesktop: 'Tarjetas & Cuentas',
    labelMobile: 'Tarjetas',
    icon: CreditCard,
    mobilePlacement: 'bottom',
    tooltip: 'Tarjetas & Cuentas: Débito y líneas de crédito'
  },
  {
    id: 'receivables',
    labelDesktop: 'Préstamos & Deudas',
    labelMobile: 'Préstamos y Deudas',
    icon: Users,
    mobilePlacement: 'more',
    mobileSubtitle: 'Dinero prestado y deudas mías',
    tooltip: 'Préstamos & Deudas: Me Deben y Yo Debo'
  },
  {
    id: 'analysis',
    labelDesktop: 'Análisis',
    labelMobile: 'Análisis',
    icon: BarChart3,
    mobilePlacement: 'more',
    mobileSubtitle: 'Mes actual, tendencia y proyección de saldos',
    tooltip: 'Análisis: diagnóstico del mes, tendencia del año y proyección de saldos'
  },
  {
    id: 'reconciliation',
    labelDesktop: 'Conciliación',
    labelMobile: 'Conciliación Bancaria',
    icon: CheckCheck,
    mobilePlacement: 'more',
    mobileSubtitle: 'Comparar estado de cuenta con app',
    tooltip: 'Conciliación: Auditoría y cuadre de saldos'
  }
];

export const BOTTOM_NAV_TABS = NAVIGATION_TABS.filter(t => t.mobilePlacement === 'bottom');
export const MORE_MENU_TABS = NAVIGATION_TABS.filter(t => t.mobilePlacement === 'more');
