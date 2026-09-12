// Fallback USD->PEN exchange rate used when a record has no stored rate.
// Centralized so the value lives in one place instead of being repeated inline.
export const FALLBACK_USD_PEN_RATE = 3.75;

// String forms for input defaults, "was it edited?" checks and display.
export const FALLBACK_USD_PEN_RATE_STR = FALLBACK_USD_PEN_RATE.toFixed(2); // '3.75'
export const FALLBACK_USD_PEN_RATE_STR4 = FALLBACK_USD_PEN_RATE.toFixed(4); // '3.7500'

// Paleta curada de colores para tarjetas/medios de pago (usada por los modales
// de crear y editar tarjeta). Centralizada para no duplicar la lista.
export const CARD_COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: 'Azul BCP / BBVA', hex: '#2563eb' },
  { label: 'Verde Interbank', hex: '#059669' },
  { label: 'Rojo Scotiabank', hex: '#dc2626' },
  { label: 'Azul Marino', hex: '#1e3a8a' },
  { label: 'Naranja Diners', hex: '#ea580c' },
  { label: 'Morado Fintech', hex: '#7c3aed' },
  { label: 'Celeste / Cyan', hex: '#0284c7' },
  { label: 'Grafito / Black Card', hex: '#1e293b' },
  { label: 'Dorado / Gold', hex: '#d97706' },
  { label: 'Rosa / Rose Gold', hex: '#db2777' }
];
