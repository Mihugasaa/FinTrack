// Fallback USD->PEN exchange rate used when a record has no stored rate.
// Centralized so the value lives in one place instead of being repeated inline.
export const FALLBACK_USD_PEN_RATE = 3.75;

// String forms for input defaults, "was it edited?" checks and display.
export const FALLBACK_USD_PEN_RATE_STR = FALLBACK_USD_PEN_RATE.toFixed(2); // '3.75'
export const FALLBACK_USD_PEN_RATE_STR4 = FALLBACK_USD_PEN_RATE.toFixed(4); // '3.7500'
