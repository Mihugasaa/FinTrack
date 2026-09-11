import { Category, PaymentMethod } from '@/types';

// Default category taxonomy seeded for every new account.
export const initialCategories: Category[] = [
  { id: 'cat-1', name: 'Seguros y Servicios Fijos', icon: 'ShieldCheck', color: '#0ea5e9' },
  { id: 'cat-2', name: 'Suscripciones y Streaming', icon: 'Tv', color: '#8b5cf6' },
  { id: 'cat-3', name: 'Comida y Restaurantes', icon: 'Utensils', color: '#f59e0b' },
  { id: 'cat-4', name: 'Transporte', icon: 'Car', color: '#10b981' },
  { id: 'cat-5', name: 'Compras y Shopping', icon: 'ShoppingBag', color: '#ec4899' },
  { id: 'cat-6', name: 'Entretenimiento y Ocio', icon: 'Gamepad2', color: '#a855f7' },
  { id: 'cat-7', name: 'Viajes', icon: 'Plane', color: '#06b6d4' },
  { id: 'cat-8', name: 'Salud', icon: 'HeartPulse', color: '#ef4444' },
  { id: 'cat-9', name: 'Hogar y Electrodomesticos', icon: 'Home', color: '#14b8a6' },
  { id: 'cat-10', name: 'Tecnologia', icon: 'Laptop', color: '#6366f1' },
  { id: 'cat-11', name: 'Regalos y Terceros', icon: 'Gift', color: '#f97316' },
  { id: 'cat-12', name: 'Otros / Por Clasificar', icon: 'HelpCircle', color: '#64748b' }
];

// Minimal generic payment methods for a fresh account. Each user's real
// cards are created in-app and loaded from Supabase.
export const initialPaymentMethods: PaymentMethod[] = [
  { id: 'pm-1', name: 'Débito', type: 'debit', color: '#10b981', icon: 'Banknote', isActive: true },
  { id: 'pm-2', name: 'Tarjeta de Crédito', type: 'credit', billingCloseDay: 25, paymentDueDay: 20, color: '#2563eb', icon: 'CreditCard', isActive: true, creditLimit: 3000 },
  { id: 'pm-3', name: 'Efectivo / Otro', type: 'cash', color: '#64748b', icon: 'Wallet', isActive: true }
];
