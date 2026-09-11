// Shared Gemini configuration for every AI route.
// The cascade is tried in order until a model returns a valid response.
// Override the list at runtime with the GEMINI_MODELS env var (comma-separated),
// so model choices can change without touching code.

const DEFAULT_GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest'
];

const envModels = (process.env.GEMINI_MODELS || '')
  .split(',')
  .map(m => m.trim())
  .filter(Boolean);

export const GEMINI_MODELS: string[] = envModels.length > 0 ? envModels : DEFAULT_GEMINI_MODELS;

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function geminiEndpoint(model: string, apiKey: string): string {
  return `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
}
